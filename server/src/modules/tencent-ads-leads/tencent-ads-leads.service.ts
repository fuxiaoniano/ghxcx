import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TencentAdLeadStatus } from '@prisma/client';
import dayjs from 'dayjs';
import { createHash, timingSafeEqual } from 'crypto';
import { AdminCurrentUser } from '../../common/decorators/current-user.decorator';
import { BusinessException } from '../../common/utils/business-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CryptoService } from '../crypto/crypto.service';
import { UpdateTencentAdLeadDto } from './dto';

type TencentPayload = Record<string, unknown>;

@Injectable()
export class TencentAdsLeadsService {
  private readonly logger = new Logger(TencentAdsLeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditLogsService
  ) {}

  async receive(payload: TencentPayload, signature?: string, signatureAlgorithm?: string) {
    const token = (this.config.get<string>('TENCENT_ADS_LEADS_TOKEN') || '').trim();
    const secret = (this.config.get<string>('TENCENT_ADS_LEADS_SECRET') || '').trim();
    if (!token || !secret) {
      return { code: 2001, message: '腾讯广告线索接收凭证未配置', data: {} };
    }
    if (!this.verifySignature(signature, signatureAlgorithm, token, secret)) {
      return { code: 2002, message: '签名校验失败', data: {} };
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { code: 2100, message: '请求体必须是 JSON 对象', data: {} };
    }

    const leadsId = this.text(payload.leads_id, 64);
    if (!leadsId) {
      return { code: 2101, message: '缺少 leads_id', data: {} };
    }

    try {
      const phone = this.text(payload.leads_tel, 32);
      const data = this.persistenceData(payload, phone);
      const lead = await this.prisma.tencentAdLead.upsert({
        where: { leadsId },
        create: {
          leadsId,
          ...data,
          status: this.initialStatus(this.text(payload.leads_follow_tag, 100))
        },
        update: data,
        select: { id: true, leadsId: true }
      });
      return { code: 0, message: 'success', data: { id: lead.id, leads_id: lead.leadsId } };
    } catch (error) {
      this.logger.error(`Tencent Ads lead ${leadsId} save failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      return { code: 1100, message: '线索保存失败', data: {} };
    }
  }

  async list(query: Record<string, string>) {
    const page = this.positiveInt(query.page, 1, 1000000);
    const pageSize = this.positiveInt(query.pageSize, 20, 100);
    const where: Prisma.TencentAdLeadWhereInput = {};
    if (query.status && Object.values(TencentAdLeadStatus).includes(query.status as TencentAdLeadStatus)) {
      where.status = query.status as TencentAdLeadStatus;
    }
    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [
        { leadsId: { contains: keyword } },
        { name: { contains: keyword } },
        { phoneMasked: { contains: keyword } },
        { campaignName: { contains: keyword } },
        { adName: { contains: keyword } }
      ];
      if (/^\+?\d{7,20}$/.test(keyword)) {
        where.OR.push({ phoneHash: this.crypto.hashPhone(keyword) });
      }
    }
    if (query.dateFrom || query.dateTo) {
      where.receivedAt = {};
      if (query.dateFrom) where.receivedAt.gte = dayjs(query.dateFrom).startOf('day').toDate();
      if (query.dateTo) where.receivedAt.lte = dayjs(query.dateTo).endOf('day').toDate();
    }
    const [total, rows] = await Promise.all([
      this.prisma.tencentAdLead.count({ where }),
      this.prisma.tencentAdLead.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);
    return { total, page, pageSize, list: rows.map((row) => this.listItem(row)) };
  }

  async detail(id: string) {
    const row = await this.prisma.tencentAdLead.findUnique({ where: { id } });
    if (!row) throw new BusinessException(404401, '腾讯广告线索不存在', 404);
    const { phoneEncrypted: _phoneEncrypted, phoneHash: _phoneHash, ...safe } = row;
    return { ...safe, statusText: this.statusText(row.status) };
  }

  async revealPhone(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    if (!this.canViewFullPhone(user)) {
      throw new BusinessException(403105, '无查看完整手机号权限', 403);
    }
    const row = await this.prisma.tencentAdLead.findUnique({ where: { id } });
    if (!row) throw new BusinessException(404401, '腾讯广告线索不存在', 404);
    const phone = row.phoneEncrypted ? this.crypto.decryptPhone(row.phoneEncrypted) : '';
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'REVEAL_TENCENT_AD_LEAD_PHONE',
      resourceType: 'tencent_ad_leads',
      resourceId: row.id,
      afterJson: { leadsId: row.leadsId, phoneMasked: row.phoneMasked },
      ip,
      userAgent: Array.isArray(userAgent) ? userAgent.join(',') : userAgent
    });
    return { phone };
  }

  async update(
    id: string,
    dto: UpdateTencentAdLeadDto,
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    const before = await this.prisma.tencentAdLead.findUnique({ where: { id } });
    if (!before) throw new BusinessException(404401, '腾讯广告线索不存在', 404);
    const updated = await this.prisma.tencentAdLead.update({
      where: { id },
      data: {
        status: dto.status,
        ineffectiveReason: dto.status === TencentAdLeadStatus.INVALID
          ? (dto.ineffectiveReason || null)
          : null,
        adminRemark: dto.adminRemark ?? before.adminRemark
      }
    });
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'UPDATE_TENCENT_AD_LEAD',
      resourceType: 'tencent_ad_leads',
      resourceId: id,
      beforeJson: {
        status: before.status,
        ineffectiveReason: before.ineffectiveReason,
        adminRemark: before.adminRemark
      },
      afterJson: {
        status: updated.status,
        ineffectiveReason: updated.ineffectiveReason,
        adminRemark: updated.adminRemark
      },
      ip,
      userAgent: Array.isArray(userAgent) ? userAgent.join(',') : userAgent
    });
    return this.detail(id);
  }

  receiverConfig() {
    const token = (this.config.get<string>('TENCENT_ADS_LEADS_TOKEN') || '').trim();
    const secret = (this.config.get<string>('TENCENT_ADS_LEADS_SECRET') || '').trim();
    const baseUrl = (this.config.get<string>('SERVER_BASE_URL') || '').replace(/\/$/, '');
    return {
      enabled: Boolean(token && secret),
      hasToken: Boolean(token),
      hasSecret: Boolean(secret),
      signatureAlgorithm: 'SHA1 / SHA256',
      webhookPath: '/api/tencent-ads/leads/push',
      webhookUrl: baseUrl ? `${baseUrl}/api/tencent-ads/leads/push` : '/api/tencent-ads/leads/push'
    };
  }

  private persistenceData(payload: TencentPayload, phone: string | null) {
    return {
      clickId: this.text(payload.click_id, 191),
      accountId: this.text(payload.account_id, 64),
      accountType: this.text(payload.account_type, 64),
      advertiserId: this.text(payload.advertiser_id, 64),
      campaignId: this.text(payload.campaign_id, 64),
      campaignName: this.text(payload.campaign_name, 255),
      adgroupId: this.text(payload.adgroup_id, 64),
      adgroupName: this.text(payload.adgroup_name, 255),
      adId: this.text(payload.ad_id, 64),
      adName: this.text(payload.ad_name, 255),
      adcreativeId: this.text(payload.adcreative_id, 64),
      adcreativeName: this.text(payload.adcreative_name, 255),
      pageId: this.text(payload.page_id, 64),
      pageName: this.text(payload.page_name, 255),
      pageUrl: this.text(payload.page_url, 1000),
      componentId: this.text(payload.component_id, 64),
      componentName: this.text(payload.component_name, 255),
      leadsType: this.text(payload.leads_type, 80),
      leadsSubType: this.text(payload.leads_sub_type, 100),
      leadsSource: this.text(payload.leads_source, 80),
      leadsSubSource: this.text(payload.leads_sub_source, 100),
      leadsFollowTag: this.text(payload.leads_follow_tag, 100),
      leadsTouchTag: this.text(payload.leads_touch_tag, 100),
      leadsTags: this.text(payload.leads_tags),
      potentialScore: this.text(payload.leads_potential_score, 32),
      name: this.text(payload.leads_name, 64),
      phoneEncrypted: phone ? this.crypto.encryptPhone(phone) : null,
      phoneHash: phone ? this.crypto.hashPhone(phone) : null,
      phoneMasked: phone ? this.crypto.maskPhone(phone) : null,
      telLocation: this.text(payload.tel_location, 120),
      area: this.text(payload.leads_area, 255),
      email: this.text(payload.leads_email, 255),
      qq: this.text(payload.leads_qq, 64),
      wechat: this.text(payload.leads_wechat, 128),
      gender: this.text(payload.leads_gender, 32),
      age: this.text(payload.age, 32),
      profession: this.text(payload.profession, 120),
      address: this.text(payload.address, 500),
      shopName: this.text(payload.shop_name, 255),
      shopAddress: this.text(payload.shop_address, 500),
      chatId: this.text(payload.chat_id, 128),
      chatRecordUrl: this.text(payload.chat_record_url, 1000),
      leadCreatedAt: this.date(payload.leads_create_time),
      leadActionAt: this.date(payload.leads_action_time),
      rawPayload: this.safePayload(payload) as Prisma.InputJsonValue
    };
  }

  private verifySignature(
    encodedSignature: string | undefined,
    rawAlgorithm: string | undefined,
    configuredToken: string,
    secret: string
  ) {
    if (!encodedSignature) return false;
    const algorithm = (rawAlgorithm || 'SHA1').toUpperCase();
    if (algorithm !== 'SHA1' && algorithm !== 'SHA256') return false;
    let decoded = '';
    try {
      decoded = Buffer.from(encodedSignature, 'base64').toString('utf8');
    } catch {
      return false;
    }
    const parts = decoded.split(',');
    if (parts.length !== 3) return false;
    const [token, timestampText, suppliedDigest] = parts;
    if (!this.safeEqual(token, configuredToken) || !/^\d{10}$/.test(timestampText)) return false;
    const configuredTolerance = Number(
      this.config.get<string>('TENCENT_ADS_LEADS_SIGNATURE_TOLERANCE_SECONDS') || 300
    );
    const tolerance = Number.isFinite(configuredTolerance)
      ? Math.min(3600, Math.max(1, configuredTolerance))
      : 300;
    if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestampText)) > tolerance) return false;
    const digest = createHash(algorithm.toLowerCase())
      .update(`${token}.${timestampText}.${secret}`)
      .digest('hex');
    return this.safeEqual(suppliedDigest.toLowerCase(), digest);
  }

  private safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private text(value: unknown, maxLength?: number): string | null {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    if (!text) return null;
    return maxLength ? text.slice(0, maxLength) : text;
  }

  private positiveInt(value: string | undefined, fallback: number, maximum: number) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return fallback;
    return Math.min(maximum, parsed);
  }

  private date(value: unknown): Date | null {
    const text = this.text(value);
    if (!text) return null;
    const parsed = dayjs(text);
    return parsed.isValid() ? parsed.toDate() : null;
  }

  private safePayload(payload: TencentPayload): TencentPayload {
    const phoneKeys = /^(leads_tel|call_middle_num|mobile|phone|tel|telephone|手机号|手机号码|联系电话|电话)$/i;
    const idKeys = /^(id_number|idcard|id_card|身份证|身份证号|身份证号码)$/i;
    const sanitize = (value: unknown, key = ''): unknown => {
      if (value === null || value === undefined) return value;
      if (phoneKeys.test(key)) {
        const phone = this.text(value);
        return phone ? this.crypto.maskPhone(phone) : '';
      }
      if (idKeys.test(key)) return this.text(value) ? '[已脱敏]' : '';
      if (Array.isArray(value)) return value.map((item) => sanitize(item));
      if (typeof value === 'object') {
        return Object.fromEntries(Object.entries(value as TencentPayload).map(([childKey, childValue]) => [
          childKey,
          sanitize(childValue, childKey)
        ]));
      }
      if (typeof value === 'string' && (value.trim().startsWith('{') || value.trim().startsWith('['))) {
        try {
          return JSON.stringify(sanitize(JSON.parse(value)));
        } catch {
          return value;
        }
      }
      return value;
    };
    return sanitize(payload) as TencentPayload;
  }

  private initialStatus(tag: string | null): TencentAdLeadStatus {
    if (!tag) return TencentAdLeadStatus.NEW;
    if (tag === 'LEADS_FOLLOW_TAG_VALID_HIGH_INTENTION') return TencentAdLeadStatus.HIGH_INTENT;
    if (tag === 'LEADS_FOLLOW_TAG_VALID_CONVERTED') return TencentAdLeadStatus.CONVERTED;
    if (tag === 'LEADS_FOLLOW_TAG_VALID') return TencentAdLeadStatus.POTENTIAL;
    if (tag.includes('INVALID')) return TencentAdLeadStatus.INVALID;
    if (tag === 'LEADS_FOLLOW_TAG_ASSIGNED' || tag === 'LEADS_FOLLOW_TAG_FOLLOWING') {
      return TencentAdLeadStatus.CONTACTED;
    }
    return TencentAdLeadStatus.NEW;
  }

  private listItem(row: {
    id: string;
    leadsId: string;
    name: string | null;
    phoneMasked: string | null;
    area: string | null;
    campaignName: string | null;
    adName: string | null;
    leadsType: string | null;
    leadsSource: string | null;
    status: TencentAdLeadStatus;
    leadActionAt: Date | null;
    receivedAt: Date;
  }) {
    return {
      id: row.id,
      leadsId: row.leadsId,
      name: row.name,
      phoneMasked: row.phoneMasked,
      area: row.area,
      campaignName: row.campaignName,
      adName: row.adName,
      leadsType: row.leadsType,
      leadsSource: row.leadsSource,
      status: row.status,
      statusText: this.statusText(row.status),
      leadActionAt: row.leadActionAt,
      receivedAt: row.receivedAt
    };
  }

  private statusText(status: TencentAdLeadStatus) {
    const labels: Record<TencentAdLeadStatus, string> = {
      NEW: '待联系',
      CONTACTED: '已联系',
      POTENTIAL: '潜在客户',
      HIGH_INTENT: '高意向客户',
      CONVERTED: '已成单',
      INVALID: '无效线索'
    };
    return labels[status];
  }

  private canViewFullPhone(user: AdminCurrentUser) {
    return user.role === 'SUPER_ADMIN' || user.permissions.includes('VIEW_FULL_PHONE');
  }
}
