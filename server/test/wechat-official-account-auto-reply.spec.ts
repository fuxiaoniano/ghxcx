import axios from 'axios';
import { readFile } from 'fs/promises';
import { OfficialAutoReplyConfig } from '../src/modules/configs/configs.service';
import { WechatOfficialAccountService } from '../src/modules/wechat-official-account/wechat-official-account.service';

jest.mock('axios');
jest.mock('fs/promises');

describe('WechatOfficialAccountService auto reply', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const mockedReadFile = readFile as jest.MockedFunction<typeof readFile>;
  const subscribeXml = [
    '<xml>',
    '<ToUserName><![CDATA[gh_test]]></ToUserName>',
    '<FromUserName><![CDATA[oa_openid_1]]></FromUserName>',
    '<CreateTime>1700000000</CreateTime>',
    '<MsgType><![CDATA[event]]></MsgType>',
    '<Event><![CDATA[subscribe]]></Event>',
    '</xml>'
  ].join('');

  const textXml = [
    '<xml>',
    '<ToUserName><![CDATA[gh_test]]></ToUserName>',
    '<FromUserName><![CDATA[oa_openid_1]]></FromUserName>',
    '<CreateTime>1700000000</CreateTime>',
    '<MsgType><![CDATA[text]]></MsgType>',
    '<Content><![CDATA[我要挂号]]></Content>',
    '</xml>'
  ].join('');

  function autoReply(overrides: Partial<OfficialAutoReplyConfig> = {}): OfficialAutoReplyConfig {
    return {
      enabled: true,
      subscribeReplyEnabled: true,
      subscribeReply: '欢迎关注，这是原有文字回复。',
      subscribeMiniProgramEnabled: true,
      subscribeMiniProgramType: 'LINK',
      subscribeMiniProgramAppId: 'wx99b598314f56c2f1',
      subscribeMiniProgramPagePath: 'pages/home/home?source=oa_subscribe',
      subscribeMiniProgramLinkText: '点击进入小程序',
      subscribeMiniProgramCardTitle: '预约挂号',
      subscribeMiniProgramCoverUrl: 'https://api.example.com/uploads/enterprise-assets/card.jpg',
      messageReplyEnabled: true,
      messageReply: '已收到消息',
      keywordReplyEnabled: true,
      keywordRules: [
        {
          id: 'register',
          keyword: '挂号',
          matchMode: 'CONTAINS',
          replyContent: '关键词挂号回复',
          enabled: true
        }
      ],
      ...overrides
    };
  }

  function createService(replyConfig = autoReply()) {
    const values = new Map<string, string>();
    const redis = {
      get: jest.fn(async (key: string) => values.get(key) || null),
      set: jest.fn(async (key: string, value: string, ...args: Array<string | number>) => {
        if (args.includes('NX') && values.has(key)) {
          return null;
        }
        values.set(key, value);
        return 'OK';
      })
    };
    const prisma = {
      systemConfig: {
        findUnique: jest.fn().mockResolvedValue({ key: 'officialAutoReply', valueJson: replyConfig })
      },
      wechatIdentity: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'identity_1',
          userId: 'user_1',
          oaOpenId: 'oa_openid_1',
          unionId: null
        }),
        update: jest.fn().mockResolvedValue({})
      },
      adminUser: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      user: { create: jest.fn() }
    };
    const env: Record<string, string> = {
      NODE_ENV: 'production',
      SERVER_BASE_URL: 'https://api.example.com',
      MINI_APP_ID: 'wx99b598314f56c2f1',
      OFFICIAL_ACCOUNT_APP_ID: 'wx0dcd1f8bffc304a7',
      OFFICIAL_ACCOUNT_APP_SECRET: 'official-secret-test'
    };
    const config = { get: jest.fn((key: string) => env[key]) };
    return {
      service: new WechatOfficialAccountService(config as any, prisma as any, {} as any, redis as any),
      prisma,
      redis
    };
  }

  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedReadFile.mockReset();
  });

  it('keeps images already hosted by the official WeChat article CDN', async () => {
    const { service } = createService();
    const upload = jest.spyOn(service as any, 'uploadDraftArticleImage');
    const source = 'https://mmbiz.qpic.cn/mmbiz_png/example/0?wx_fmt=png';

    const html = await (service as any).convertDraftHtml(`<p>头部</p><img src="${source}">`, 'access-token');

    expect(html).toContain(source);
    expect(upload).not.toHaveBeenCalled();
  });

  it('sends the original subscribe text and a mini-program text link together', async () => {
    const { service } = createService();

    const reply = await service.handleMessage(subscribeXml);

    expect(reply).toContain('欢迎关注，这是原有文字回复。');
    expect(reply).toContain('data-miniprogram-appid="wx99b598314f56c2f1"');
    expect(reply).toContain('data-miniprogram-path="pages/home/home?source=oa_subscribe"');
    expect(reply).toContain('点击进入小程序');
  });

  it('keeps the text reply and schedules an additional mini-program card', async () => {
    const config = autoReply({ subscribeMiniProgramType: 'CARD' });
    const { service } = createService(config);
    const sendCard = jest.spyOn(service, 'sendSubscribeMiniProgramCard').mockResolvedValue({
      sent: true,
      messageType: 'miniprogrampage'
    });

    const reply = await service.handleMessage(subscribeXml);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(reply).toContain('欢迎关注，这是原有文字回复。');
    expect(reply).not.toContain('data-miniprogram-appid');
    expect(sendCard).toHaveBeenCalledWith('oa_openid_1', expect.objectContaining({
      subscribeMiniProgramType: 'CARD'
    }));
  });

  it('does not send the same subscribe card twice when WeChat retries one event', async () => {
    const config = autoReply({ subscribeMiniProgramType: 'CARD' });
    const { service } = createService(config);
    const sendCard = jest.spyOn(service, 'sendSubscribeMiniProgramCard').mockResolvedValue({
      sent: true,
      messageType: 'miniprogrampage'
    });

    await service.handleMessage(subscribeXml);
    await service.handleMessage(subscribeXml);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(sendCard).toHaveBeenCalledTimes(1);
  });

  it('sends a correctly shaped customer-service mini-program card', async () => {
    const config = autoReply({ subscribeMiniProgramType: 'CARD' });
    const { service } = createService(config);
    jest.spyOn(service, 'getAccessToken').mockResolvedValue('oa-access-token');
    jest.spyOn(service as any, 'getMiniProgramCardThumbMediaId').mockResolvedValue('thumb-media-id');
    mockedAxios.post.mockResolvedValue({ data: { errcode: 0, errmsg: 'ok' } });

    const result = await service.sendSubscribeMiniProgramCard('oa_openid_1', config);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=oa-access-token',
      {
        touser: 'oa_openid_1',
        msgtype: 'miniprogrampage',
        miniprogrampage: {
          title: '预约挂号',
          appid: 'wx99b598314f56c2f1',
          pagepath: 'pages/home/home?source=oa_subscribe',
          thumb_media_id: 'thumb-media-id'
        }
      },
      { timeout: 10000 }
    );
    expect(result).toEqual({ sent: true, messageType: 'miniprogrampage' });
  });

  it('uploads a local card cover once and reuses its cached media id', async () => {
    const { service, redis } = createService();
    jest.spyOn(service, 'getAccessToken').mockResolvedValue('oa-access-token');
    mockedReadFile.mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff, 0xd9]) as never);
    mockedAxios.post.mockResolvedValue({ data: { media_id: 'uploaded-media-id' } });
    const coverUrl = 'https://api.example.com/uploads/enterprise-assets/card.jpg';

    const first = await (service as any).getMiniProgramCardThumbMediaId(coverUrl);
    const second = await (service as any).getMiniProgramCardThumbMediaId(coverUrl);

    expect(first).toBe('uploaded-media-id');
    expect(second).toBe('uploaded-media-id');
    expect(mockedReadFile).toHaveBeenCalledTimes(1);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.weixin.qq.com/cgi-bin/media/upload?access_token=oa-access-token&type=image',
      expect.any(FormData),
      { timeout: 15000, maxBodyLength: 9 * 1024 * 1024 }
    );
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^wechat:oa:subscribe-card-thumb:/),
      'uploaded-media-id',
      'EX',
      2 * 24 * 60 * 60
    );
  });

  it('keeps existing keyword replies unchanged', async () => {
    const { service } = createService();

    const reply = await service.handleMessage(textXml);

    expect(reply).toContain('关键词挂号回复');
    expect(reply).not.toContain('data-miniprogram-appid');
  });
});
