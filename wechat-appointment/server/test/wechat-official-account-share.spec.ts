import { createHash } from 'crypto';
import axios from 'axios';
import { WechatOfficialAccountService } from '../src/modules/wechat-official-account/wechat-official-account.service';

jest.mock('axios');

describe('WechatOfficialAccountService H5 sharing', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  function createService() {
    const values = new Map<string, string>();
    const redis = {
      get: jest.fn(async (key: string) => values.get(key) || null),
      set: jest.fn(async (key: string, value: string) => {
        values.set(key, value);
        return 'OK';
      })
    };
    const env: Record<string, string> = {
      NODE_ENV: 'production',
      SERVER_BASE_URL: 'https://api.example.com',
      OFFICIAL_ACCOUNT_APP_ID: 'wx-official-test',
      OFFICIAL_ACCOUNT_APP_SECRET: 'official-secret-test'
    };
    const config = { get: jest.fn((key: string) => env[key]) };
    return {
      service: new WechatOfficialAccountService(config as any, {} as any, {} as any, redis as any),
      redis
    };
  }

  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
  });

  it('signs the exact page URL and caches the jsapi ticket', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { access_token: 'access-token', expires_in: 7200 }
    });
    mockedAxios.get.mockResolvedValue({
      data: { errcode: 0, errmsg: 'ok', ticket: 'jsapi-ticket', expires_in: 7200 }
    });
    const { service, redis } = createService();
    const url = 'https://api.example.com/landing/page-one?source=article';

    const first = await service.getJsSdkConfig(url);
    const second = await service.getJsSdkConfig(url);
    const expectedSignature = createHash('sha1')
      .update(
        `jsapi_ticket=jsapi-ticket&noncestr=${first.nonceStr}&timestamp=${first.timestamp}&url=${url}`
      )
      .digest('hex');

    expect(first.appId).toBe('wx-official-test');
    expect(first.signature).toBe(expectedSignature);
    expect(second.signature).toMatch(/^[a-f0-9]{40}$/);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith('wechat:oa:jsapi_ticket', 'jsapi-ticket', 'EX', 6900);
  });

  it('does not sign URLs from another domain', async () => {
    const { service } = createService();

    await expect(service.getJsSdkConfig('https://evil.example.com/landing/page-one')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 400218 })
    });
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
