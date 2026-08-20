import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/utils/business-exception';
import { AuthService } from '../auth/auth.service';
import { CryptoService } from '../crypto/crypto.service';
import { UsersService } from '../users/users.service';
import { MiniLoginDto } from './dto';

interface Code2SessionResult {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

interface PhoneResult {
  errcode?: number;
  errmsg?: string;
  phone_info?: {
    phoneNumber: string;
    purePhoneNumber: string;
    countryCode: string;
  };
}

@Injectable()
export class WechatMiniService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly crypto: CryptoService,
    private readonly users: UsersService,
    @Inject('REDIS') private readonly redis: Redis
  ) {}

  verifyMessageSignature(signature: string, timestamp: string, nonce: string): boolean {
    const token =
      this.config.get<string>('MINI_MESSAGE_TOKEN') ||
      this.config.get<string>('OFFICIAL_ACCOUNT_TOKEN') ||
      '';
    const digest = [token, timestamp, nonce].sort().join('');
    return createHash('sha1').update(digest).digest('hex') === signature;
  }

  async handleMessagePush(_xml: string) {
    // 小程序消息推送主要用于客服消息和事件通知。本项目当前只需要通过验证并记录入口，
    // 挂号通知发送走小程序订阅消息 API，不依赖这里接收用户消息。
    return 'success';
  }

  async login(dto: MiniLoginDto) {
    const session = await this.code2Session(dto.code);
    let identity = await this.prisma.wechatIdentity.findUnique({
      where: { miniOpenId: session.openid },
      include: { user: true }
    });

    if (!identity && session.unionid) {
      identity = await this.prisma.wechatIdentity.findFirst({
        where: { unionId: session.unionid, miniOpenId: null },
        include: { user: true }
      });
    }

    if (!identity) {
      const user = await this.prisma.user.create({ data: { lastLoginAt: new Date() } });
      identity = await this.prisma.wechatIdentity.create({
        data: {
          userId: user.id,
          miniOpenId: session.openid,
          unionId: session.unionid,
          sessionKeyEncrypted: this.crypto.encryptText(session.session_key)
        },
        include: { user: true }
      });
    } else {
      identity = await this.prisma.wechatIdentity.update({
        where: { id: identity.id },
        data: {
          miniOpenId: identity.miniOpenId || session.openid,
          unionId: identity.unionId || session.unionid,
          sessionKeyEncrypted: this.crypto.encryptText(session.session_key),
          user: { update: { lastLoginAt: new Date() } }
        },
        include: { user: true }
      });
    }

    if (dto.bindToken) {
      identity = await this.bindTokenToIdentity(identity.userId, dto.bindToken);
    }

    const token = this.auth.signMini({ userId: identity.userId, miniOpenId: session.openid });
    return {
      token,
      userId: identity.userId,
      phoneMasked: identity.user.phoneMasked,
      hasPhone: Boolean(identity.user.phoneEncrypted),
      miniOpenId: session.openid
    };
  }

  async authorizePhone(userId: string, code: string) {
    const phone = await this.getPhoneNumber(code);
    if (!this.isMainlandMobile(phone)) {
      await this.redis.set(this.manualPhoneKey(userId), '1', 'EX', 600);
      return {
        token: this.auth.signMini({ userId }),
        phoneMasked: '',
        hasPhone: false,
        needManualPhone: true,
        message: '微信返回的手机号不是 11 位大陆手机号，请手动输入手机号'
      };
    }

    return this.attachPhoneToUser(userId, phone);
  }

  async submitManualPhone(userId: string, phone: string) {
    if (!this.isMainlandMobile(phone)) {
      throw new BusinessException(400104, '请输入 11 位大陆手机号');
    }
    const allowed = await this.redis.get(this.manualPhoneKey(userId));
    if (!allowed) {
      throw new BusinessException(403104, '请先点击手机号授权，微信返回异常时才可手动输入手机号', 403);
    }
    const result = await this.attachPhoneToUser(userId, phone);
    await this.redis.del(this.manualPhoneKey(userId));
    return result;
  }

  private async attachPhoneToUser(userId: string, phone: string) {
    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!current) {
      throw new BusinessException(404001, '用户不存在');
    }

    const existing = await this.users.findByPhone(phone);
    if (existing && existing.id !== userId) {
      await this.prisma.wechatIdentity.updateMany({
        where: { userId },
        data: { userId: existing.id }
      });
      if (!current.phoneEncrypted) {
        await this.prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
      }
      const token = this.auth.signMini({ userId: existing.id });
      return { token, phoneMasked: existing.phoneMasked, hasPhone: true };
    }

    const user = await this.users.attachPhone(userId, phone);
    const token = this.auth.signMini({ userId });
    return { token, phoneMasked: user.phoneMasked, hasPhone: true };
  }

  async bindOfficialAccount(userId: string, bindToken: string) {
    const identity = await this.bindTokenToIdentity(userId, bindToken);
    const token = this.auth.signMini({ userId: identity.userId, miniOpenId: identity.miniOpenId || undefined });
    return {
      token,
      bound: true,
      hasOfficialAccountOpenId: Boolean(identity.oaOpenId),
      unionId: identity.unionId
    };
  }

  async getAccessToken(): Promise<string> {
    const cacheKey = 'wechat:mini:access_token';
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return cached;
    }
    if (this.isMock()) {
      await this.redis.set(cacheKey, 'mock-mini-access-token', 'EX', 600);
      return 'mock-mini-access-token';
    }
    const { appid, secret } = this.getMiniCredentials();
    const response = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
      params: { grant_type: 'client_credential', appid, secret }
    });
    if (response.data.errcode) {
      throw new BusinessException(500101, `获取小程序 access_token 失败：${response.data.errmsg}`);
    }
    const token = response.data.access_token as string;
    await this.redis.set(cacheKey, token, 'EX', Number(response.data.expires_in || 7200) - 300);
    return token;
  }

  private async code2Session(code: string): Promise<Code2SessionResult> {
    if (this.isMock(code)) {
      return {
        openid: `mock-mini-openid-${code}`,
        session_key: `mock-session-key-${code}`,
        unionid: `mock-unionid-${code}`
      };
    }
    const { appid, secret } = this.getMiniCredentials();
    const response = await axios.get<Code2SessionResult>('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid,
        secret,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });
    if (response.data.errcode) {
      throw new BusinessException(400101, `小程序登录失败：${response.data.errmsg}`);
    }
    return response.data;
  }

  private async getPhoneNumber(code: string): Promise<string> {
    if (this.isMock(code)) {
      return '13800138000';
    }
    const accessToken = await this.getAccessToken();
    const response = await axios.post<PhoneResult>(
      `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
      { code }
    );
    if (response.data.errcode || !response.data.phone_info?.phoneNumber) {
      throw new BusinessException(400102, `手机号授权失败：${response.data.errmsg || '微信未返回手机号'}`);
    }
    return response.data.phone_info.phoneNumber;
  }

  private async bindTokenToIdentity(userId: string, bindToken: string) {
    const raw = await this.redis.get(`oa-bind:${bindToken}`);
    if (!raw) {
      throw new BusinessException(400103, '公众号绑定令牌已失效，请重新从公众号进入');
    }
    const payload = JSON.parse(raw) as { oaOpenId: string; unionId?: string };
    const identity = await this.prisma.wechatIdentity.findFirst({
      where: { userId },
      include: { user: true }
    });
    if (!identity) {
      throw new BusinessException(404002, '微信身份不存在');
    }
    await this.redis.del(`oa-bind:${bindToken}`);
    const oaIdentity = await this.prisma.wechatIdentity.findUnique({
      where: { oaOpenId: payload.oaOpenId },
      include: { user: true }
    });
    if (oaIdentity && oaIdentity.id !== identity.id) {
      await this.prisma.$transaction(async (tx) => {
        if (identity.miniOpenId) {
          await tx.wechatIdentity.update({
            where: { id: identity.id },
            data: { miniOpenId: null, sessionKeyEncrypted: null }
          });
        }
        if (identity.user.phoneEncrypted && !oaIdentity.user.phoneEncrypted) {
          await tx.user.update({
            where: { id: oaIdentity.userId },
            data: {
              phoneEncrypted: identity.user.phoneEncrypted,
              phoneHash: identity.user.phoneHash,
              phoneMasked: identity.user.phoneMasked
            }
          });
        }
        await tx.wechatIdentity.update({
          where: { id: oaIdentity.id },
          data: {
            miniOpenId: identity.miniOpenId,
            sessionKeyEncrypted: identity.sessionKeyEncrypted,
            unionId: oaIdentity.unionId || identity.unionId || payload.unionId,
            subscribedOfficialAccount: true
          }
        });
      });
      return this.prisma.wechatIdentity.findUniqueOrThrow({
        where: { id: oaIdentity.id },
        include: { user: true }
      });
    }
    return this.prisma.wechatIdentity.update({
      where: { id: identity.id },
      data: {
        oaOpenId: payload.oaOpenId,
        unionId: identity.unionId || payload.unionId,
        subscribedOfficialAccount: true
      },
      include: { user: true }
    });
  }

  private manualPhoneKey(userId: string) {
    return `mini:manual-phone:${userId}`;
  }

  private isMainlandMobile(phone: string): boolean {
    return /^1\d{10}$/.test(String(phone || ''));
  }

  private isMock(code?: string): boolean {
    const nodeEnv = this.config.get<string>('NODE_ENV');
    return nodeEnv === 'test' || (nodeEnv !== 'production' && Boolean(code?.startsWith('mock-')));
  }

  private getMiniCredentials() {
    const appid = this.config.get<string>('MINI_APP_ID') || '';
    const secret = this.config.get<string>('MINI_APP_SECRET') || '';
    if (!appid || !secret || appid.includes('your-mini') || secret.includes('your-mini')) {
      throw new BusinessException(500100, 'Mini program AppID/AppSecret are not configured');
    }
    return { appid, secret };
  }
}
