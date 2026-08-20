import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClinicsService } from '../clinics/clinics.service';

export interface LandingPageTextConfig {
  logoText: string;
  brandSubtitle: string;
  brandBadgeText: string;
  originalPriceLabel: string;
  activityPriceLabel: string;
  nameLabel: string;
  namePlaceholder: string;
  phoneLabel: string;
  phoneAuthorizedPrefix: string;
  phoneAuthorizeButtonText: string;
  ageLabel: string;
  missingTeethLabel: string;
  clinicLabel: string;
  clinicPlaceholder: string;
  remarkLabel: string;
  remarkPlaceholder: string;
  privacyCheckboxText: string;
  submitButtonText: string;
  noticeText: string;
  myAppointmentsButtonText: string;
  authModalTitle: string;
  authModalDescription: string;
  authModalButtonText: string;
  authModalCancelText: string;
  customerServiceLabel: string;
}

export interface LandingPageDisplayConfig {
  brandSection: boolean;
  logo: boolean;
  brandName: boolean;
  brandSubtitle: boolean;
  brandBadge: boolean;
  bannerSection: boolean;
  subsidyText: boolean;
  priceCard: boolean;
  includedItems: boolean;
  formTopImages: boolean;
  formTitle: boolean;
  privacyAgreement: boolean;
  noticeText: boolean;
  footerSection: boolean;
  institutionName: boolean;
  filingNo: boolean;
  footerText: boolean;
  customerServicePhone: boolean;
  myAppointmentsButton: boolean;
}

export interface LandingPageConfig {
  brandName: string;
  activityTitle: string;
  originalPrice: string;
  activityPrice: string;
  subsidyText: string;
  includedItems: string[];
  filingNo: string;
  institutionName: string;
  privacyAgreement: string;
  customerServicePhone: string;
  footerText: string;
  formTopImages: string[];
  officialAccountTemplateId?: string;
  miniSubscribeTemplateId?: string;
  display: LandingPageDisplayConfig;
  text: LandingPageTextConfig;
  formOptions: {
    ageRanges: string[];
    missingTeethTypes: string[];
  };
}

export interface OfficialAccountMenuButton {
  name: string;
  type?: 'view' | 'click' | 'miniprogram';
  url?: string;
  key?: string;
  appid?: string;
  pagepath?: string;
  sub_button?: OfficialAccountMenuButton[];
}

export interface OfficialAccountMenuConfig {
  button: OfficialAccountMenuButton[];
}

export interface AppointmentNotifyConfig {
  enabled: boolean;
  templateId?: string;
}

export interface FollowupForwardConfig {
  enabled: boolean;
  url: string;
  authHeader: string;
  authScheme: string;
  authToken: string;
  timeoutMs: number;
  includeFullPhone: boolean;
  extraHeaders: Record<string, string>;
}

export interface OfficialAutoReplyKeywordRule {
  id: string;
  keyword: string;
  matchMode: 'CONTAINS' | 'EXACT';
  replyContent: string;
  enabled: boolean;
  createdAt?: string;
}

export interface OfficialAutoReplyConfig {
  enabled: boolean;
  subscribeReplyEnabled: boolean;
  subscribeReply: string;
  messageReplyEnabled: boolean;
  messageReply: string;
  keywordReplyEnabled: boolean;
  keywordRules: OfficialAutoReplyKeywordRule[];
}

const defaultLandingPage: LandingPageConfig = {
  brandName: '安心口腔咨询',
  activityTitle: '种植牙咨询挂号服务',
  originalPrice: '后台配置原价',
  activityPrice: '后台配置活动价',
  subsidyText: '名额有限，提交后以工作人员确认为准',
  includedItems: ['口腔情况咨询', '门店预约登记', '术前检查咨询'],
  filingNo: '请在后台填写备案号',
  institutionName: '请在后台填写机构名称',
  privacyAgreement:
    '我们仅收集挂号咨询所必需的信息，用于工作人员联系和预约服务，不作诊断承诺。',
  customerServicePhone: '请在后台填写客服电话',
  footerText: '本服务仅提供挂号咨询，不承诺诊断或治疗效果。',
  formTopImages: [],
  display: {
    brandSection: true,
    logo: true,
    brandName: true,
    brandSubtitle: true,
    brandBadge: true,
    bannerSection: true,
    subsidyText: true,
    priceCard: true,
    includedItems: true,
    formTopImages: true,
    formTitle: true,
    privacyAgreement: true,
    noticeText: true,
    footerSection: true,
    institutionName: true,
    filingNo: true,
    footerText: true,
    customerServicePhone: true,
    myAppointmentsButton: true
  },
  text: {
    logoText: '牙',
    brandSubtitle: '官方挂号咨询服务',
    brandBadgeText: '预约咨询',
    originalPriceLabel: '原价',
    activityPriceLabel: '活动价',
    nameLabel: '您的姓名',
    namePlaceholder: '请输入',
    phoneLabel: '您的电话',
    phoneAuthorizedPrefix: '已授权：',
    phoneAuthorizeButtonText: '点击授权手机号',
    ageLabel: '您的年龄',
    missingTeethLabel: '缺牙情况',
    clinicLabel: '期望门店',
    clinicPlaceholder: '请选择',
    remarkLabel: '备注',
    remarkPlaceholder: '可填写方便联系时间或其他需求',
    privacyCheckboxText: '我已阅读并同意隐私协议',
    submitButtonText: '点击丨领取种牙优惠名额',
    noticeText: '由于咨询人数较多，我们会在24小时内联系您。',
    myAppointmentsButtonText: '查看我的挂号',
    authModalTitle: '授权手机号',
    authModalDescription:
      '手机号优先通过微信授权获取并加密保存；如果微信返回的不是 11 位手机号，再按提示手动补录。',
    authModalButtonText: '授权手机号',
    authModalCancelText: '先浏览页面',
    customerServiceLabel: '客服电话'
  },
  formOptions: {
    ageRanges: ['40岁以下', '40-50岁', '50-60岁', '60岁以上'],
    missingTeethTypes: ['单颗缺失', '多颗缺失', '半口缺失', '全口缺失', '不确定']
  }
};

const defaultOfficialAutoReply: OfficialAutoReplyConfig = {
  enabled: true,
  subscribeReplyEnabled: true,
  subscribeReply:
    '欢迎关注！如需种植牙咨询或预约挂号，请点击公众号菜单“立即挂号”提交信息，工作人员会尽快联系您。',
  messageReplyEnabled: true,
  messageReply:
    '您好，已收到您的消息。如需预约挂号，请点击公众号菜单“立即挂号”；如需人工协助，工作人员会尽快查看并联系您。',
  keywordReplyEnabled: true,
  keywordRules: [
    {
      id: 'default-register',
      keyword: '挂号',
      matchMode: 'CONTAINS',
      replyContent: '您好，点击公众号菜单“立即挂号”即可提交预约信息，工作人员会尽快联系您。',
      enabled: true,
      createdAt: new Date(0).toISOString()
    },
    {
      id: 'default-phone',
      keyword: '电话',
      matchMode: 'CONTAINS',
      replyContent: '您好，客服电话可在挂号页面底部查看。也可以直接在公众号留言，工作人员会尽快回复。',
      enabled: true,
      createdAt: new Date(0).toISOString()
    }
  ]
};

@Injectable()
export class ConfigsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clinics: ClinicsService,
    private readonly env: ConfigService
  ) {}

  async getLandingPage() {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'landingPage' } });
    const value = row?.valueJson as unknown as Partial<LandingPageConfig> | undefined;
    const clinicOptions = await this.clinics.findActive();
    return {
      ...defaultLandingPage,
      ...(value || {}),
      officialAccountTemplateId:
        value?.officialAccountTemplateId || this.env.get<string>('OFFICIAL_ACCOUNT_TEMPLATE_APPOINTMENT_SUCCESS'),
      miniSubscribeTemplateId:
        value?.miniSubscribeTemplateId || this.env.get<string>('MINI_SUBSCRIBE_TEMPLATE_APPOINTMENT_SUCCESS'),
      text: {
        ...defaultLandingPage.text,
        ...(value?.text || {})
      },
      formOptions: {
        ...defaultLandingPage.formOptions,
        ...(value?.formOptions || {})
      },
      formTopImages: Array.isArray(value?.formTopImages) ? value.formTopImages.filter(Boolean) : [],
      display: {
        ...defaultLandingPage.display,
        ...(value?.display || {})
      },
      clinics: clinicOptions.map((clinic) => ({
        id: clinic.id,
        name: clinic.name,
        address: clinic.address,
        phone: clinic.phone
      }))
    };
  }

  async getOfficialAccountMenu() {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'officialAccountMenu' } });
    return (row?.valueJson as unknown as OfficialAccountMenuConfig | undefined) || this.getDefaultOfficialAccountMenu();
  }

  async getAppointmentNotifyConfig(): Promise<AppointmentNotifyConfig> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'appointmentNotify' } });
    const value = row?.valueJson as unknown as Partial<AppointmentNotifyConfig> | undefined;
    return {
      enabled: value?.enabled ?? true,
      templateId: value?.templateId || this.env.get<string>('OFFICIAL_ACCOUNT_TEMPLATE_APPOINTMENT_SUCCESS')
    };
  }

  async getFollowupForwardConfig(): Promise<FollowupForwardConfig> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'followupForward' } });
    const value = row?.valueJson as unknown as Partial<FollowupForwardConfig> | undefined;
    return this.normalizeFollowupForwardConfig(value);
  }

  async updateFollowupForwardConfig(value: Partial<FollowupForwardConfig>): Promise<FollowupForwardConfig> {
    const before = await this.getFollowupForwardConfig();
    const next = this.normalizeFollowupForwardConfig({
      ...before,
      ...value,
      authToken: value.authToken === undefined ? before.authToken : value.authToken
    });
    await this.prisma.systemConfig.upsert({
      where: { key: 'followupForward' },
      create: {
        key: 'followupForward',
        valueJson: next as unknown as Prisma.InputJsonValue,
        description: '院内回访系统预约接收接口配置'
      },
      update: {
        valueJson: next as unknown as Prisma.InputJsonValue,
        description: '院内回访系统预约接收接口配置'
      }
    });
    return next;
  }

  async getOfficialAutoReplyConfig(): Promise<OfficialAutoReplyConfig> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'officialAutoReply' } });
    const value = row?.valueJson as unknown as Partial<OfficialAutoReplyConfig> | undefined;
    return {
      ...defaultOfficialAutoReply,
      ...(value || {}),
      keywordRules: Array.isArray(value?.keywordRules) ? value.keywordRules : defaultOfficialAutoReply.keywordRules
    };
  }

  async getAll() {
    return this.prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
  }

  async updateMany(configs: Array<{ key: string; valueJson: Prisma.InputJsonValue; description?: string }>) {
    const updates = configs.map((item) =>
      this.prisma.systemConfig.upsert({
        where: { key: item.key },
        create: {
          key: item.key,
          valueJson: item.valueJson,
          description: item.description || ''
        },
        update: {
          valueJson: item.valueJson,
          description: item.description
        }
      })
    );
    return this.prisma.$transaction(updates);
  }

  getDefaultLandingPage() {
    return defaultLandingPage;
  }

  getDefaultOfficialAccountMenu(): OfficialAccountMenuConfig {
    const base = this.env.get<string>('SERVER_BASE_URL') || 'https://zbsfxn.cqzbskq.com';
    const fallbackBase = base.replace(/\/$/, '');
    const miniAppId = this.env.get<string>('MINI_APP_ID') || 'wx99b598314f56c2f1';
    return {
      button: [
        {
          name: '立即挂号',
          type: 'miniprogram',
          appid: miniAppId,
          pagepath: 'pages/landing/landing?source=official_menu',
          url: `${fallbackBase}/wechat/oa/oauth?state=landing&source=official_menu`
        },
        {
          name: '我的挂号',
          type: 'miniprogram',
          appid: miniAppId,
          pagepath: 'pages/appointments/appointments?source=official_menu',
          url: `${fallbackBase}/wechat/oa/oauth?state=my&source=official_menu`
        },
        {
          name: '联系客服',
          type: 'click',
          key: 'CONTACT_STAFF'
        }
      ]
    };
  }

  getDefaultOfficialAutoReply() {
    return defaultOfficialAutoReply;
  }

  private normalizeFollowupForwardConfig(value?: Partial<FollowupForwardConfig>): FollowupForwardConfig {
    const url = this.text(value?.url ?? this.env.get<string>('FOLLOWUP_FORWARD_URL'), 500);
    const authToken = this.text(value?.authToken ?? this.env.get<string>('FOLLOWUP_FORWARD_AUTH_TOKEN'), 500);
    return {
      enabled: value?.enabled ?? this.booleanEnv('FOLLOWUP_FORWARD_ENABLED', Boolean(url)),
      url,
      authHeader: this.text(value?.authHeader ?? this.env.get<string>('FOLLOWUP_FORWARD_AUTH_HEADER'), 80) || 'Authorization',
      authScheme:
        value?.authScheme === undefined
          ? this.text(this.env.get<string>('FOLLOWUP_FORWARD_AUTH_SCHEME') ?? 'Bearer', 40)
          : this.text(value.authScheme, 40),
      authToken,
      timeoutMs: this.positiveInt(value?.timeoutMs ?? this.env.get<string>('FOLLOWUP_FORWARD_TIMEOUT_MS'), 5000, 1000, 60000),
      includeFullPhone: value?.includeFullPhone ?? this.booleanEnv('FOLLOWUP_FORWARD_INCLUDE_FULL_PHONE', true),
      extraHeaders: this.normalizeHeaders(value?.extraHeaders ?? this.envHeaders('FOLLOWUP_FORWARD_EXTRA_HEADERS'))
    };
  }

  private text(value: unknown, max: number) {
    return String(value ?? '').trim().slice(0, max);
  }

  private positiveInt(value: unknown, fallback: number, min: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, Math.floor(parsed)));
  }

  private booleanEnv(key: string, fallback: boolean) {
    const value = this.env.get<string>(key);
    if (value === undefined || value === '') {
      return fallback;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private envHeaders(key: string) {
    const raw = this.env.get<string>(key);
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private normalizeHeaders(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([name, item]) => Boolean(name.trim()) && (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'))
        .slice(0, 30)
        .map(([name, item]) => [name.trim().slice(0, 120), String(item).slice(0, 500)])
    );
  }
}
