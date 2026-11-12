import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContentStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import sanitizeHtml from 'sanitize-html';
import { BusinessException } from '../../common/utils/business-exception';
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
  pageId?: string;
  pageKey?: string;
  pageName?: string;
  brandName: string;
  brandHtml: string;
  activityTitle: string;
  activityHtml: string;
  originalPrice: string;
  activityPrice: string;
  subsidyText: string;
  includedItems: string[];
  filingNo: string;
  institutionName: string;
  privacyAgreement: string;
  customerServicePhone: string;
  footerText: string;
  shareTitle: string;
  shareImageUrl: string;
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

export interface LandingPageAdminItem {
  id: string;
  pageKey: string;
  name: string;
  status: ContentStatus;
  isDefault: boolean;
  appointmentCount: number;
  createdAt: Date;
  updatedAt: Date;
  links: {
    h5: string;
    miniProgramPath: string;
    officialAccount: string;
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
  assignmentEnabled?: boolean;
  assignmentTemplateId?: string;
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
  subscribeMiniProgramEnabled: boolean;
  subscribeMiniProgramType: 'LINK' | 'CARD';
  subscribeMiniProgramAppId: string;
  subscribeMiniProgramPagePath: string;
  subscribeMiniProgramLinkText: string;
  subscribeMiniProgramCardTitle: string;
  subscribeMiniProgramCoverUrl: string;
  messageReplyEnabled: boolean;
  messageReply: string;
  keywordReplyEnabled: boolean;
  keywordRules: OfficialAutoReplyKeywordRule[];
}

const defaultLandingPage: LandingPageConfig = {
  brandName: '安心口腔咨询',
  brandHtml:
    '<div style="padding:16px;text-align:center"><strong style="font-size:24px;color:#17324d">安心口腔咨询</strong><div style="margin-top:6px;color:#66788a">官方挂号咨询服务</div></div>',
  activityTitle: '种植牙咨询挂号服务',
  activityHtml:
    '<div style="padding:18px;text-align:center;background-color:#fff8f7"><div style="font-size:20px;font-weight:700;color:#c67818">名额有限，提交后以工作人员确认为准</div><div style="margin-top:12px;font-size:34px;font-weight:700;color:#e60012">活动详情以工作人员确认为准</div></div>',
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
  shareTitle: '种植牙咨询挂号服务',
  shareImageUrl: '',
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
  subscribeMiniProgramEnabled: false,
  subscribeMiniProgramType: 'LINK',
  subscribeMiniProgramAppId: '',
  subscribeMiniProgramPagePath: 'pages/home/home?source=oa_subscribe',
  subscribeMiniProgramLinkText: '点击进入傅小念口腔服务',
  subscribeMiniProgramCardTitle: '傅小念口腔预约挂号',
  subscribeMiniProgramCoverUrl: '',
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

  async getLandingPage(pageKey?: string) {
    const page = await this.resolvePublicLandingPage(pageKey);
    const value = page?.configJson as unknown as Partial<LandingPageConfig> | undefined;
    const legacyValue = page ? undefined : await this.getLegacyLandingPageValue();
    const config = this.normalizeLandingPageConfig(value || legacyValue);
    const clinicOptions = await this.clinics.findActive();
    return {
      ...config,
      pageId: page?.id,
      pageKey: page?.pageKey || 'default',
      pageName: page?.name || '默认挂号页',
      clinics: clinicOptions.map((clinic) => ({
        id: clinic.id,
        name: clinic.name,
        address: clinic.address,
        phone: clinic.phone
      }))
    };
  }

  async getLandingPageForAppointment(landingPageId?: string | null) {
    if (!landingPageId) {
      return this.getLandingPage();
    }
    const page = await this.prisma.landingPage.findUnique({ where: { id: landingPageId } });
    if (!page) {
      return this.getLandingPage();
    }
    return {
      ...this.normalizeLandingPageConfig(page.configJson as unknown as Partial<LandingPageConfig>),
      pageId: page.id,
      pageKey: page.pageKey,
      pageName: page.name
    };
  }

  async listLandingPages(): Promise<LandingPageAdminItem[]> {
    await this.ensureDefaultLandingPage();
    const pages = await this.prisma.landingPage.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: { _count: { select: { appointments: true } } }
    });
    return pages.map((page) => ({
      id: page.id,
      pageKey: page.pageKey,
      name: page.name,
      status: page.status,
      isDefault: page.isDefault,
      appointmentCount: page._count.appointments,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      links: this.landingPageLinks(page.pageKey)
    }));
  }

  async getLandingPageAdmin(id: string) {
    const page = await this.prisma.landingPage.findUnique({
      where: { id },
      include: { _count: { select: { appointments: true } } }
    });
    if (!page) {
      throw new BusinessException(404320, '落地页不存在', 404);
    }
    return {
      id: page.id,
      pageKey: page.pageKey,
      name: page.name,
      status: page.status,
      isDefault: page.isDefault,
      appointmentCount: page._count.appointments,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      links: this.landingPageLinks(page.pageKey),
      config: this.normalizeLandingPageConfig(page.configJson as unknown as Partial<LandingPageConfig>)
    };
  }

  async createLandingPage(name: string, cloneFromId?: string) {
    const clone = cloneFromId
      ? await this.prisma.landingPage.findUnique({ where: { id: cloneFromId } })
      : await this.ensureDefaultLandingPage();
    if (cloneFromId && !clone) {
      throw new BusinessException(404320, '用于复制的落地页不存在', 404);
    }
    const config = this.toStoredLandingPageConfig(
      (clone?.configJson as unknown as Partial<LandingPageConfig> | undefined) || {}
    ) as unknown as Prisma.InputJsonValue;
    const page = await this.prisma.landingPage.create({
      data: {
        pageKey: this.createLandingPageKey(),
        name: this.cleanPageName(name),
        configJson: config,
        status: ContentStatus.ACTIVE,
        isDefault: false
      }
    });
    return this.getLandingPageAdmin(page.id);
  }

  async updateLandingPage(
    id: string,
    value: { name?: string; status?: ContentStatus; config?: Record<string, unknown> }
  ) {
    const current = await this.prisma.landingPage.findUnique({ where: { id } });
    if (!current) {
      throw new BusinessException(404320, '落地页不存在', 404);
    }
    if (current.isDefault && value.status === ContentStatus.DISABLED) {
      throw new BusinessException(400320, '默认落地页不能停用');
    }
    await this.prisma.landingPage.update({
      where: { id },
      data: {
        ...(value.name !== undefined ? { name: this.cleanPageName(value.name) } : {}),
        ...(value.status !== undefined ? { status: value.status } : {}),
        ...(value.config !== undefined
          ? {
              configJson: this.toStoredLandingPageConfig(value.config) as unknown as Prisma.InputJsonValue
            }
          : {})
      }
    });
    return this.getLandingPageAdmin(id);
  }

  async setDefaultLandingPage(id: string) {
    const page = await this.prisma.landingPage.findUnique({ where: { id } });
    if (!page) {
      throw new BusinessException(404320, '落地页不存在', 404);
    }
    await this.prisma.$transaction([
      this.prisma.landingPage.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      this.prisma.landingPage.update({
        where: { id },
        data: { isDefault: true, status: ContentStatus.ACTIVE }
      })
    ]);
    return this.getLandingPageAdmin(id);
  }

  async deleteLandingPage(id: string) {
    const page = await this.prisma.landingPage.findUnique({
      where: { id },
      include: { _count: { select: { appointments: true } } }
    });
    if (!page) {
      throw new BusinessException(404320, '落地页不存在', 404);
    }

    const pageCount = await this.prisma.landingPage.count();
    if (pageCount <= 1) {
      throw new BusinessException(409320, '至少需要保留一个挂号落地页', 409);
    }

    let replacement: { id: string; name: string } | null = null;
    const operations: Prisma.PrismaPromise<unknown>[] = [];
    if (page.isDefault) {
      replacement =
        (await this.prisma.landingPage.findFirst({
          where: { id: { not: id }, status: ContentStatus.ACTIVE },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true }
        })) ||
        (await this.prisma.landingPage.findFirst({
          where: { id: { not: id } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true }
        }));

      if (!replacement) {
        throw new BusinessException(409320, '至少需要保留一个挂号落地页', 409);
      }
      operations.push(
        this.prisma.landingPage.updateMany({
          where: { isDefault: true },
          data: { isDefault: false }
        }),
        this.prisma.landingPage.update({
          where: { id: replacement.id },
          data: { isDefault: true, status: ContentStatus.ACTIVE }
        })
      );
    }

    // The foreign key uses ON DELETE SET NULL, so historical appointments remain intact.
    operations.push(this.prisma.landingPage.delete({ where: { id } }));
    await this.prisma.$transaction(operations);

    return {
      id: page.id,
      pageKey: page.pageKey,
      name: page.name,
      preservedAppointmentCount: page._count.appointments,
      newDefaultPage: replacement
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
        templateId: value?.templateId || this.env.get<string>('OFFICIAL_ACCOUNT_TEMPLATE_APPOINTMENT_SUCCESS'),
        assignmentEnabled: value?.assignmentEnabled ?? false,
        assignmentTemplateId: value?.assignmentTemplateId || ''
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
      subscribeMiniProgramEnabled: value?.subscribeMiniProgramEnabled === true,
      subscribeMiniProgramType: value?.subscribeMiniProgramType === 'CARD' ? 'CARD' : 'LINK',
      subscribeMiniProgramAppId:
        String(value?.subscribeMiniProgramAppId || this.env.get<string>('MINI_APP_ID') || '').trim(),
      subscribeMiniProgramPagePath:
        String(value?.subscribeMiniProgramPagePath || defaultOfficialAutoReply.subscribeMiniProgramPagePath).trim(),
      subscribeMiniProgramLinkText:
        String(value?.subscribeMiniProgramLinkText || defaultOfficialAutoReply.subscribeMiniProgramLinkText).trim(),
      subscribeMiniProgramCardTitle:
        String(value?.subscribeMiniProgramCardTitle || defaultOfficialAutoReply.subscribeMiniProgramCardTitle).trim(),
      subscribeMiniProgramCoverUrl: String(value?.subscribeMiniProgramCoverUrl || '').trim(),
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

  private async resolvePublicLandingPage(pageKey?: string) {
    await this.ensureDefaultLandingPage();
    if (pageKey) {
      const page = await this.prisma.landingPage.findUnique({ where: { pageKey } });
      if (!page || page.status !== ContentStatus.ACTIVE) {
        throw new BusinessException(404320, '落地页不存在或已停用', 404);
      }
      return page;
    }
    return (
      (await this.prisma.landingPage.findFirst({
        where: { isDefault: true, status: ContentStatus.ACTIVE },
        orderBy: { createdAt: 'asc' }
      })) ||
      this.prisma.landingPage.findFirst({
        where: { status: ContentStatus.ACTIVE },
        orderBy: { createdAt: 'asc' }
      })
    );
  }

  private async ensureDefaultLandingPage() {
    const current = await this.prisma.landingPage.findFirst({
      where: { isDefault: true },
      orderBy: { createdAt: 'asc' }
    });
    if (current) {
      return current;
    }
    const existing = await this.prisma.landingPage.findUnique({ where: { pageKey: 'default' } });
    if (existing) {
      return this.prisma.landingPage.update({
        where: { id: existing.id },
        data: { isDefault: true, status: ContentStatus.ACTIVE }
      });
    }
    const legacy = await this.getLegacyLandingPageValue();
    return this.prisma.landingPage.create({
      data: {
        pageKey: 'default',
        name: '默认挂号页',
        configJson: this.toStoredLandingPageConfig(legacy || {}) as unknown as Prisma.InputJsonValue,
        status: ContentStatus.ACTIVE,
        isDefault: true
      }
    });
  }

  private async getLegacyLandingPageValue() {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'landingPage' } });
    return row?.valueJson as unknown as Partial<LandingPageConfig> | undefined;
  }

  private normalizeLandingPageConfig(value?: Partial<LandingPageConfig>): LandingPageConfig {
    const text = {
      ...defaultLandingPage.text,
      ...(value?.text || {})
    };
    const formOptions = {
      ageRanges: this.normalizeTextList(value?.formOptions?.ageRanges, defaultLandingPage.formOptions.ageRanges),
      missingTeethTypes: this.normalizeTextList(
        value?.formOptions?.missingTeethTypes,
        defaultLandingPage.formOptions.missingTeethTypes
      )
    };
    const formTopImages = Array.isArray(value?.formTopImages)
      ? value.formTopImages.map((item) => this.text(item, 1000)).filter(Boolean)
      : defaultLandingPage.formTopImages;
    const brandHtmlSource = typeof value?.brandHtml === 'string' ? value.brandHtml : this.legacyBrandHtml(value);
    const activityHtmlSource =
      typeof value?.activityHtml === 'string' ? value.activityHtml : this.legacyActivityHtml(value, text);
    return {
      ...defaultLandingPage,
      ...(value || {}),
      brandHtml: this.sanitizeRichHtml(brandHtmlSource),
      activityHtml: this.sanitizeRichHtml(activityHtmlSource),
      shareTitle: this.text(value?.shareTitle || value?.activityTitle || value?.brandName || defaultLandingPage.shareTitle, 120),
      shareImageUrl: this.text(value?.shareImageUrl || formTopImages[0] || '', 1000),
      officialAccountTemplateId:
        value?.officialAccountTemplateId || this.env.get<string>('OFFICIAL_ACCOUNT_TEMPLATE_APPOINTMENT_SUCCESS'),
      miniSubscribeTemplateId:
        value?.miniSubscribeTemplateId || this.env.get<string>('MINI_SUBSCRIBE_TEMPLATE_APPOINTMENT_SUCCESS'),
      text,
      formOptions,
      formTopImages,
      display: {
        ...defaultLandingPage.display,
        ...(value?.display || {})
      }
    };
  }

  private toStoredLandingPageConfig(value: Record<string, unknown> | Partial<LandingPageConfig>) {
    const normalized = this.normalizeLandingPageConfig(value as Partial<LandingPageConfig>) as LandingPageConfig & {
      clinics?: unknown;
    };
    const { pageId: _pageId, pageKey: _pageKey, pageName: _pageName, clinics: _clinics, ...stored } = normalized;
    return stored;
  }

  private sanitizeRichHtml(value: unknown) {
    const spacing = /^(?:0|[0-9.]+(?:px|rpx|em|rem|%))(?:\s+(?:0|[0-9.]+(?:px|rpx|em|rem|%))){0,3}$/i;
    const color = /^(?:#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\)|[a-z]{3,20})$/i;
    return sanitizeHtml(String(value || '').slice(0, 30000), {
      allowedTags: [
        'div',
        'p',
        'span',
        'strong',
        'b',
        'em',
        'i',
        'u',
        's',
        'h1',
        'h2',
        'h3',
        'h4',
        'ul',
        'ol',
        'li',
        'br',
        'hr',
        'a',
        'img'
      ],
      allowedAttributes: {
        '*': ['style'],
        a: ['href', 'target', 'title'],
        img: ['src', 'alt', 'title', 'width', 'height']
      },
      allowedSchemes: ['http', 'https'],
      allowedSchemesByTag: { img: ['http', 'https'] },
      allowedStyles: {
        '*': {
          color: [color],
          'background-color': [color],
          'font-size': [/^(?:[1-9][0-9]{0,2})(?:px|rpx|em|rem|%)$/i],
          'font-weight': [/^(?:normal|bold|[1-9]00)$/i],
          'font-style': [/^(?:normal|italic)$/i],
          'text-align': [/^(?:left|right|center|justify)$/i],
          'text-decoration': [/^(?:none|underline|line-through)$/i],
          'line-height': [/^(?:normal|[0-9.]+(?:px|rpx|em|rem|%)?)$/i],
          margin: [spacing],
          'margin-top': [spacing],
          'margin-right': [spacing],
          'margin-bottom': [spacing],
          'margin-left': [spacing],
          padding: [spacing],
          'padding-top': [spacing],
          'padding-right': [spacing],
          'padding-bottom': [spacing],
          'padding-left': [spacing],
          'border-radius': [/^(?:0|[0-9.]+(?:px|rpx|em|rem|%))$/i],
          width: [/^(?:auto|[0-9.]+(?:px|rpx|em|rem|%))$/i],
          'max-width': [/^(?:none|[0-9.]+(?:px|rpx|em|rem|%))$/i],
          height: [/^(?:auto|[0-9.]+(?:px|rpx|em|rem|%))$/i],
          display: [/^(?:block|inline|inline-block)$/i]
        }
      },
      enforceHtmlBoundary: true
    });
  }

  private legacyBrandHtml(value?: Partial<LandingPageConfig>) {
    const name = this.escapeHtml(value?.brandName || defaultLandingPage.brandName);
    const subtitle = this.escapeHtml(value?.text?.brandSubtitle || defaultLandingPage.text.brandSubtitle);
    return `<div style="padding:16px;text-align:center"><strong style="font-size:24px;color:#17324d">${name}</strong><div style="margin-top:6px;color:#66788a">${subtitle}</div></div>`;
  }

  private legacyActivityHtml(value: Partial<LandingPageConfig> | undefined, text: LandingPageTextConfig) {
    const title = this.escapeHtml(value?.activityTitle || defaultLandingPage.activityTitle);
    const subsidy = this.escapeHtml(value?.subsidyText || defaultLandingPage.subsidyText);
    const originalPrice = this.escapeHtml(value?.originalPrice || '');
    const activityPrice = this.escapeHtml(value?.activityPrice || '');
    return `<div style="padding:18px;text-align:center;background-color:#fff8f7"><div style="font-size:20px;font-weight:700;color:#c67818">${subsidy}</div><div style="margin-top:10px;font-size:18px;font-weight:700;color:#17324d">${title}</div><div style="margin-top:12px"><s>${this.escapeHtml(text.originalPriceLabel)} ${originalPrice}</s> <strong style="font-size:34px;color:#e60012">${this.escapeHtml(text.activityPriceLabel)} ${activityPrice}</strong></div></div>`;
  }

  private normalizeTextList(value: unknown, fallback: string[]) {
    if (!Array.isArray(value)) {
      return [...fallback];
    }
    const list = value.map((item) => this.text(item, 64)).filter(Boolean).slice(0, 30);
    return list.length ? list : [...fallback];
  }

  private cleanPageName(value: unknown) {
    const name = this.text(value, 120);
    if (!name) {
      throw new BusinessException(400321, '请填写落地页名称');
    }
    return name;
  }

  private createLandingPageKey() {
    return `lp_${randomBytes(10).toString('hex')}`;
  }

  private landingPageLinks(pageKey: string) {
    const base = (this.env.get<string>('SERVER_BASE_URL') || '').replace(/\/$/, '');
    const encodedKey = encodeURIComponent(pageKey);
    return {
      h5: `${base}/landing/${encodedKey}`,
      miniProgramPath: `pages/landing/landing?page=${encodedKey}`,
      officialAccount: `${base}/wechat/oa/oauth?state=landing&source=landing_${encodedKey}&page=${encodedKey}`
    };
  }

  private escapeHtml(value: unknown) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  getDefaultOfficialAccountMenu(): OfficialAccountMenuConfig {
    const base = this.env.get<string>('SERVER_BASE_URL') || 'https://wechat.fuxiaonian.net';
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
