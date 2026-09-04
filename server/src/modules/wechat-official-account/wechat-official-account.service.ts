import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import Redis from 'ioredis';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/utils/business-exception';
import { WechatMiniService } from '../wechat-mini/wechat-mini.service';
import {
  OfficialAutoReplyConfig,
  OfficialAccountMenuButton,
  OfficialAccountMenuConfig
} from '../configs/configs.service';

interface OauthTokenResult {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  openid?: string;
  scope?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

interface JsApiTicketResult {
  ticket?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

export interface OfficialOauthIdentity {
  oaOpenId: string;
  unionId?: string;
  subscribed: boolean;
}

export interface OfficialAccountJsSdkConfig {
  appId: string;
  timestamp: number;
  nonceStr: string;
  signature: string;
}

@Injectable()
export class WechatOfficialAccountService {
  private readonly parser = new XMLParser({ ignoreAttributes: false });

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mini: WechatMiniService,
    @Inject('REDIS') private readonly redis: Redis
  ) {}

  verifySignature(signature: string, timestamp: string, nonce: string): boolean {
    const token = this.config.get<string>('OFFICIAL_ACCOUNT_TOKEN') || '';
    const digest = [token, timestamp, nonce]
      .sort()
      .join('')
      .split('')
      .reduce((hash, char) => hash.update(char), createHash('sha1'))
      .digest('hex');
    return digest === signature;
  }

  verifyMessageSignature(signature: string, timestamp: string, nonce: string, encrypted: string): boolean {
    const token = this.config.get<string>('OFFICIAL_ACCOUNT_TOKEN') || '';
    const digest = [token, timestamp, nonce, encrypted].sort().join('');
    return createHash('sha1').update(digest).digest('hex') === signature;
  }

  extractEncrypt(xml: string): string | null {
    const parsed = this.parser.parse(xml) as { xml?: { Encrypt?: string } };
    return parsed.xml?.Encrypt || null;
  }

  decryptMessage(encrypted: string): string {
    const encodingAesKey = this.config.get<string>('OFFICIAL_ACCOUNT_ENCODING_AES_KEY') || '';
    if (encodingAesKey.length !== 43) {
      throw new BusinessException(400204, '公众号 EncodingAESKey 长度必须为 43 位');
    }
    const key = Buffer.from(`${encodingAesKey}=`, 'base64');
    const decipher = createDecipheriv('aes-256-cbc', key, key.subarray(0, 16));
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([decipher.update(encrypted, 'base64'), decipher.final()]);
    const pad = decrypted[decrypted.length - 1];
    const content = decrypted.subarray(0, decrypted.length - (pad >= 1 && pad <= 32 ? pad : 0));
    const messageLength = content.readUInt32BE(16);
    const message = content.subarray(20, 20 + messageLength).toString('utf8');
    const appid = content.subarray(20 + messageLength).toString('utf8');
    const expectedAppId = this.config.get<string>('OFFICIAL_ACCOUNT_APP_ID');
    if (expectedAppId && appid && appid !== expectedAppId) {
      throw new BusinessException(400205, '公众号加密消息 AppID 不匹配');
    }
    return message;
  }

  encryptReplyMessage(replyXml: string, timestamp: string, nonce: string): string {
    const encodingAesKey = this.config.get<string>('OFFICIAL_ACCOUNT_ENCODING_AES_KEY') || '';
    if (encodingAesKey.length !== 43) {
      throw new BusinessException(400204, '公众号 EncodingAESKey 长度必须为 43 位');
    }
    const appid = this.config.get<string>('OFFICIAL_ACCOUNT_APP_ID') || '';
    const key = Buffer.from(`${encodingAesKey}=`, 'base64');
    const message = Buffer.from(replyXml, 'utf8');
    const messageLength = Buffer.alloc(4);
    messageLength.writeUInt32BE(message.length, 0);
    const raw = Buffer.concat([randomBytes(16), messageLength, message, Buffer.from(appid, 'utf8')]);
    const padded = this.pkcs7Pad(raw);
    const cipher = createCipheriv('aes-256-cbc', key, key.subarray(0, 16));
    cipher.setAutoPadding(false);
    const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]).toString('base64');
    const safeTimestamp = timestamp || `${Math.floor(Date.now() / 1000)}`;
    const safeNonce = nonce || randomBytes(8).toString('hex');
    const signature = this.messageSignature(encrypted, safeTimestamp, safeNonce);
    return `<xml><Encrypt><![CDATA[${encrypted}]]></Encrypt><MsgSignature><![CDATA[${signature}]]></MsgSignature><TimeStamp>${safeTimestamp}</TimeStamp><Nonce><![CDATA[${safeNonce}]]></Nonce></xml>`;
  }

  async handleMessage(xml: string): Promise<string | undefined> {
    if (!xml) {
      return;
    }
    const parsed = this.parser.parse(xml) as { xml?: Record<string, string> };
    const message = parsed.xml || {};
    const oaOpenId = message.FromUserName;
    const msgType = message.MsgType;
    const event = message.Event;
    if (!oaOpenId) {
      return;
    }

    if (msgType === 'event' && event === 'subscribe') {
      await this.upsertOfficialIdentity(oaOpenId, true);
      await this.prisma.adminUser.updateMany({
        where: { oaOpenId },
        data: { subscribedOfficialAccount: true }
      });
      const reply = await this.resolveAutoReply(message);
      return reply ? this.buildTextReply(message, reply) : undefined;
    }
    if (msgType === 'event' && event === 'unsubscribe') {
      await this.prisma.wechatIdentity.updateMany({
        where: { oaOpenId },
        data: { subscribedOfficialAccount: false }
      });
      await this.prisma.adminUser.updateMany({
        where: { oaOpenId },
        data: { subscribedOfficialAccount: false }
      });
      return;
    }
    const reply = await this.resolveAutoReply(message);
    return reply ? this.buildTextReply(message, reply) : undefined;
  }

  buildOauthUrl(state?: string, source?: string, pageKey?: string): string {
    const { appid } = this.getOfficialCredentials();
    const base = this.config.get<string>('SERVER_BASE_URL');
    const redirectUri = encodeURIComponent(`${base}/wechat/oa/oauth/callback`);
    const safeState = encodeURIComponent(this.encodeOauthState(state || 'landing', source, pageKey));
    return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appid}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&state=${safeState}#wechat_redirect`;
  }

  buildAdminOauthUrl(callbackPath: string, state: string): string {
    const { appid } = this.getOfficialCredentials();
    const base = (this.config.get<string>('SERVER_BASE_URL') || '').replace(/\/$/, '');
    const redirectUri = encodeURIComponent(`${base}${callbackPath}`);
    return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appid}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&state=${encodeURIComponent(
      state
    )}#wechat_redirect`;
  }

  async resolveOauthIdentity(code: string): Promise<OfficialOauthIdentity> {
    if (!code) {
      throw new BusinessException(400215, '微信授权缺少 code');
    }
    const oauth = await this.exchangeOauthCode(code);
    if (!oauth.openid) {
      throw new BusinessException(400216, '微信授权未返回 openid');
    }
    let subscribed = false;
    try {
      const accessToken = await this.getAccessToken();
      const response = await axios.get('https://api.weixin.qq.com/cgi-bin/user/info', {
        params: { access_token: accessToken, openid: oauth.openid, lang: 'zh_CN' }
      });
      subscribed = response.data?.subscribe === 1;
    } catch {
      // OAuth binding remains valid even when the optional subscription lookup fails.
    }
    return { oaOpenId: oauth.openid, unionId: oauth.unionid, subscribed };
  }

  async handleOauthCallback(code: string, state?: string): Promise<string> {
    if (!code) {
      throw new BusinessException(400201, '公众号 OAuth 缺少 code');
    }
    const oauth = await this.exchangeOauthCode(code);
    if (!oauth.openid) {
      throw new BusinessException(400202, '公众号 OAuth 未返回 openid');
    }
    const entry = this.parseOauthState(state);
    await this.upsertOfficialIdentity(oauth.openid, true, oauth.unionid);
    const bindToken = randomBytes(16).toString('hex');
    await this.redis.set(
      `oa-bind:${bindToken}`,
      JSON.stringify({
        oaOpenId: oauth.openid,
        unionId: oauth.unionid,
        state: entry.target,
        source: entry.source,
        pageKey: entry.pageKey
      }),
      'EX',
      600
    );
    return this.createMiniProgramLaunchUrl(bindToken, entry.target, entry.source, entry.pageKey);
  }

  async getAccessToken(): Promise<string> {
    const cacheKey = 'wechat:oa:access_token';
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return cached;
    }
    if (this.isMock()) {
      await this.redis.set(cacheKey, 'mock-oa-access-token', 'EX', 600);
      return 'mock-oa-access-token';
    }
    const { appid, secret } = this.getOfficialCredentials();
    const response = await axios.post('https://api.weixin.qq.com/cgi-bin/stable_token', {
      grant_type: 'client_credential',
      appid,
      secret,
      force_refresh: false
    });
    if (response.data.errcode) {
      throw new BusinessException(500201, `获取公众号 access_token 失败：${response.data.errmsg}`);
    }
    const token = response.data.access_token as string;
    await this.redis.set(cacheKey, token, 'EX', Number(response.data.expires_in || 7200) - 300);
    return token;
  }

  async getJsSdkConfig(url: string): Promise<OfficialAccountJsSdkConfig> {
    const signedUrl = this.validateJsSdkUrl(url);
    const ticket = await this.getJsApiTicket();
    const timestamp = Math.floor(Date.now() / 1000);
    const nonceStr = randomBytes(16).toString('hex');
    const signatureSource = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${signedUrl}`;
    return {
      appId: this.getOfficialCredentials().appid,
      timestamp,
      nonceStr,
      signature: createHash('sha1').update(signatureSource).digest('hex')
    };
  }

  async publishCustomMenu(menu: OfficialAccountMenuConfig) {
    this.validateMenu(menu);
    const accessToken = await this.getAccessToken();
    const response = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/menu/create?access_token=${accessToken}`,
      menu
    );
    if (response.data.errcode) {
      throw new BusinessException(500202, `发布公众号自定义菜单失败：${response.data.errmsg || response.data.errcode}`);
    }
    return {
      errcode: response.data.errcode || 0,
      errmsg: response.data.errmsg || 'ok'
    };
  }

  private async exchangeOauthCode(code: string): Promise<OauthTokenResult> {
    if (this.isMock(code)) {
      return {
        openid: `mock-oa-openid-${code}`,
        unionid: `mock-unionid-${code}`,
        access_token: 'mock-oauth-access-token'
      };
    }
    const { appid, secret } = this.getOfficialCredentials();
    const response = await axios.get<OauthTokenResult>('https://api.weixin.qq.com/sns/oauth2/access_token', {
      params: {
        appid,
        secret,
        code,
        grant_type: 'authorization_code'
      }
    });
    if (response.data.errcode) {
      throw new BusinessException(400203, `公众号 OAuth 失败：${response.data.errmsg}`);
    }
    return response.data;
  }

  private async getJsApiTicket(): Promise<string> {
    const cacheKey = 'wechat:oa:jsapi_ticket';
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return cached;
    }
    if (this.isMock()) {
      await this.redis.set(cacheKey, 'mock-oa-jsapi-ticket', 'EX', 600);
      return 'mock-oa-jsapi-ticket';
    }
    const accessToken = await this.getAccessToken();
    const response = await axios.get<JsApiTicketResult>('https://api.weixin.qq.com/cgi-bin/ticket/getticket', {
      params: { access_token: accessToken, type: 'jsapi' }
    });
    if (response.data.errcode || !response.data.ticket) {
      throw new BusinessException(
        500203,
        `获取公众号 jsapi_ticket 失败：${response.data.errmsg || response.data.errcode || 'empty ticket'}`
      );
    }
    const ticket = response.data.ticket;
    const ttl = Math.max(60, Number(response.data.expires_in || 7200) - 300);
    await this.redis.set(cacheKey, ticket, 'EX', ttl);
    return ticket;
  }

  private validateJsSdkUrl(value: string) {
    const url = String(value || '').split('#')[0];
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BusinessException(400217, '微信网页分享 URL 无效');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BusinessException(400217, '微信网页分享 URL 无效');
    }
    const serverBase = this.config.get<string>('SERVER_BASE_URL');
    if (serverBase) {
      try {
        if (parsed.origin !== new URL(serverBase).origin) {
          throw new BusinessException(400218, '微信网页分享 URL 不属于当前服务域名');
        }
      } catch (error) {
        if (error instanceof BusinessException) {
          throw error;
        }
        throw new BusinessException(500204, 'SERVER_BASE_URL 配置无效');
      }
    }
    return url;
  }

  private async createMiniProgramLaunchUrl(
    bindToken: string,
    state?: string,
    source?: string,
    pageKey?: string
  ): Promise<string> {
    if (this.isMock()) {
      return `weixin://dl/business/?t=mock-mini-program&bindToken=${bindToken}`;
    }
    const targetPath = state === 'my' || state === 'appointments'
      ? 'pages/appointments/appointments'
      : 'pages/landing/landing';
    const targetQuery = state === 'my' || state === 'appointments' ? 'my' : 'landing';
    const entrySource = this.normalizeSource(source) || 'oa_oauth';
    const safePageKey = this.normalizePageKey(pageKey);
    const pageQuery = targetQuery === 'landing' && safePageKey
      ? `&page=${encodeURIComponent(safePageKey)}`
      : '';
    try {
      const accessToken = await this.mini.getAccessToken();
      const response = await axios.post(
        `https://api.weixin.qq.com/wxa/generatescheme?access_token=${accessToken}`,
        {
          jump_wxa: {
            path: targetPath,
            query: `bindToken=${encodeURIComponent(bindToken)}&source=${encodeURIComponent(entrySource)}&target=${encodeURIComponent(targetQuery)}${pageQuery}`
          },
          is_expire: true,
          expire_time: Math.floor(Date.now() / 1000) + 600
        }
      );
      if (!response.data.errcode && response.data.openlink) {
        return response.data.openlink as string;
      }
    } catch {
      // 小程序未发布或微信接口临时失败时，兜底进入公开落地页，不能跳到管理后台。
    }
    const fallback = this.config.get<string>('SERVER_BASE_URL') || '';
    const fallbackPath = targetQuery === 'landing' && safePageKey ? `/landing/${safePageKey}` : '/';
    return `${fallback.replace(/\/$/, '')}${fallbackPath}?source=${encodeURIComponent(entrySource)}`;
  }

  private encodeOauthState(target: string, source?: string, pageKey?: string) {
    const safeTarget = target === 'my' || target === 'appointments' ? target : 'landing';
    const safeSource = this.normalizeSource(source);
    const safePageKey = safeTarget === 'landing' ? this.normalizePageKey(pageKey) : '';
    if (safePageKey) {
      return `${safeTarget}.${safeSource}.${safePageKey}`;
    }
    return safeSource ? `${safeTarget}.${safeSource}` : safeTarget;
  }

  private parseOauthState(state?: string) {
    const [rawTarget, rawSource, rawPageKey] = String(state || 'landing').split('.', 3);
    const target = rawTarget === 'my' || rawTarget === 'appointments' ? rawTarget : 'landing';
    const source = this.normalizeSource(rawSource);
    const pageKey = target === 'landing' ? this.normalizePageKey(rawPageKey) : '';
    return { target, source, pageKey };
  }

  private normalizeSource(source?: string) {
    return String(source || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
  }

  private normalizePageKey(pageKey?: string) {
    return String(pageKey || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);
  }

  private validateMenu(menu: OfficialAccountMenuConfig) {
    if (!Array.isArray(menu?.button) || menu.button.length === 0 || menu.button.length > 3) {
      throw new BusinessException(400206, '公众号一级菜单必须为 1-3 个');
    }
    menu.button.forEach((button) => this.validateMenuButton(button, true));
  }

  private validateMenuButton(button: OfficialAccountMenuButton, topLevel: boolean) {
    if (!button.name || button.name.length > 16) {
      throw new BusinessException(400207, '公众号菜单名称不能为空，且不能超过 16 个字符');
    }
    const children = button.sub_button || [];
    if (children.length > 0) {
      if (children.length > 5) {
        throw new BusinessException(400208, '公众号二级菜单不能超过 5 个');
      }
      children.forEach((child) => this.validateMenuButton(child, false));
      delete button.type;
      delete button.url;
      delete button.key;
      delete button.appid;
      delete button.pagepath;
      return;
    }
    if (!button.type) {
      throw new BusinessException(400209, `${topLevel ? '一级' : '二级'}菜单没有子菜单时必须选择类型`);
    }
    if (button.type === 'view' && !button.url) {
      throw new BusinessException(400210, '网页跳转菜单必须填写 URL');
    }
    if (button.type === 'click' && !button.key) {
      throw new BusinessException(400211, '点击事件菜单必须填写 key');
    }
    if (button.type === 'miniprogram' && (!button.appid || !button.pagepath || !button.url)) {
      throw new BusinessException(400212, '小程序菜单必须填写 AppID、页面路径和备用 URL');
    }
  }

  private async resolveAutoReply(message: Record<string, string>): Promise<string | undefined> {
    const autoReply = await this.getOfficialAutoReplyConfig();
    if (!autoReply.enabled) {
      return undefined;
    }
    const msgType = message.MsgType;
    const event = message.Event;
    if (msgType === 'event' && event === 'subscribe') {
      return autoReply.subscribeReplyEnabled ? this.cleanReply(autoReply.subscribeReply) : undefined;
    }
    if (msgType === 'text' && autoReply.keywordReplyEnabled) {
      const content = String(message.Content || '').trim();
      const matched = this.matchKeywordRule(content, autoReply.keywordRules);
      if (matched) {
        return this.cleanReply(matched.replyContent);
      }
    }
    if (msgType && msgType !== 'event' && autoReply.messageReplyEnabled) {
      return this.cleanReply(autoReply.messageReply);
    }
    return undefined;
  }

  private matchKeywordRule(content: string, rules: OfficialAutoReplyConfig['keywordRules']) {
    if (!content || !Array.isArray(rules)) {
      return undefined;
    }
    const normalized = content.toLowerCase();
    return rules.find((rule) => {
      if (!rule?.enabled || !rule.keyword || !rule.replyContent) {
        return false;
      }
      const keyword = String(rule.keyword).trim().toLowerCase();
      if (!keyword) {
        return false;
      }
      return rule.matchMode === 'EXACT' ? normalized === keyword : normalized.includes(keyword);
    });
  }

  private buildTextReply(message: Record<string, string>, content: string) {
    const toUser = this.cdata(message.FromUserName);
    const fromUser = this.cdata(message.ToUserName);
    const safeContent = this.cdata(content);
    return `<xml><ToUserName><![CDATA[${toUser}]]></ToUserName><FromUserName><![CDATA[${fromUser}]]></FromUserName><CreateTime>${Math.floor(
      Date.now() / 1000
    )}</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[${safeContent}]]></Content></xml>`;
  }

  private cleanReply(value?: string) {
    const text = String(value || '').trim();
    return text ? text.slice(0, 600) : undefined;
  }

  private cdata(value?: string) {
    return String(value || '').replace(/]]>/g, ']]]]><![CDATA[>');
  }

  private messageSignature(encrypted: string, timestamp: string, nonce: string) {
    const token = this.config.get<string>('OFFICIAL_ACCOUNT_TOKEN') || '';
    return createHash('sha1').update([token, timestamp, nonce, encrypted].sort().join('')).digest('hex');
  }

  private pkcs7Pad(buffer: Buffer) {
    const blockSize = 32;
    let padding = blockSize - (buffer.length % blockSize);
    if (padding === 0) {
      padding = blockSize;
    }
    return Buffer.concat([buffer, Buffer.alloc(padding, padding)]);
  }

  private async getOfficialAutoReplyConfig(): Promise<OfficialAutoReplyConfig> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'officialAutoReply' } });
    const value = row?.valueJson as unknown as Partial<OfficialAutoReplyConfig> | undefined;
    return {
      enabled: value?.enabled ?? true,
      subscribeReplyEnabled: value?.subscribeReplyEnabled ?? true,
      subscribeReply:
        value?.subscribeReply ||
        '欢迎关注！如需种植牙咨询或预约挂号，请点击公众号菜单“立即挂号”提交信息，工作人员会尽快联系您。',
      messageReplyEnabled: value?.messageReplyEnabled ?? true,
      messageReply:
        value?.messageReply ||
        '您好，已收到您的消息。如需预约挂号，请点击公众号菜单“立即挂号”；如需人工协助，工作人员会尽快查看并联系您。',
      keywordReplyEnabled: value?.keywordReplyEnabled ?? true,
      keywordRules: Array.isArray(value?.keywordRules)
        ? value.keywordRules
        : [
            {
              id: 'default-register',
              keyword: '挂号',
              matchMode: 'CONTAINS',
              replyContent: '您好，点击公众号菜单“立即挂号”即可提交预约信息，工作人员会尽快联系您。',
              enabled: true,
              createdAt: new Date(0).toISOString()
            }
          ]
    };
  }

  private async upsertOfficialIdentity(oaOpenId: string, subscribed: boolean, unionId?: string) {
    const existing = await this.prisma.wechatIdentity.findUnique({ where: { oaOpenId } });
    if (existing) {
      return this.prisma.wechatIdentity.update({
        where: { id: existing.id },
        data: {
          subscribedOfficialAccount: subscribed,
          unionId: existing.unionId || unionId
        }
      });
    }
    const user = await this.prisma.user.create({ data: {} });
    return this.prisma.wechatIdentity.create({
      data: {
        userId: user.id,
        oaOpenId,
        unionId,
        subscribedOfficialAccount: subscribed
      }
    });
  }

  private isMock(code?: string): boolean {
    const nodeEnv = this.config.get<string>('NODE_ENV');
    return nodeEnv === 'test' || (nodeEnv !== 'production' && Boolean(code?.startsWith('mock-')));
  }

  private getOfficialCredentials() {
    const appid = this.config.get<string>('OFFICIAL_ACCOUNT_APP_ID') || '';
    const secret = this.config.get<string>('OFFICIAL_ACCOUNT_APP_SECRET') || '';
    if (!appid || !secret || appid.includes('your-official') || secret.includes('your-official')) {
      throw new BusinessException(500200, 'Official account AppID/AppSecret are not configured');
    }
    return { appid, secret };
  }
}
