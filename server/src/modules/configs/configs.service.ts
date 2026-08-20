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
  brandName: 'å®‰å¿ƒå£è…”å’¨è¯¢',
  activityTitle: 'ç§æ¤ç‰™å’¨è¯¢æŒ‚å·æœåŠ¡',
  originalPrice: 'åå°é…ç½®åŸä»·',
  activityPrice: 'åå°é…ç½®æ´»åŠ¨ä»·',
  subsidyText: 'åé¢æœ‰é™ï¼Œæäº¤åä»¥å·¥ä½œäººå‘˜ç¡®è®¤ä¸ºå‡†',
  includedItems: ['å£è…”æƒ…å†µå’¨è¯¢', 'é—¨åº—é¢„çº¦ç™»è®°', 'æœ¯å‰æ£€æŸ¥å’¨è¯¢'],
  filingNo: 'è¯·åœ¨åå°å¡«å†™å¤‡æ¡ˆå·',
  institutionName: 'è¯·åœ¨åå°å¡«å†™æœºæ„åç§°',
  privacyAgreement:
    'æˆ‘ä»¬ä»…æ”¶é›†æŒ‚å·å’¨è¯¢æ‰€å¿…éœ€çš„ä¿¡æ¯ï¼Œç”¨äºå·¥ä½œäººå‘˜è”ç³»å’Œé¢„çº¦æœåŠ¡ï¼Œä¸ä½œè¯Šæ–­æ‰¿è¯ºã€‚',
  customerServicePhone: 'è¯·åœ¨åå°å¡«å†™å®¢æœç”µè¯',
  footerText: 'æœ¬æœåŠ¡ä»…æä¾›æŒ‚å·å’¨è¯¢ï¼Œä¸æ‰¿è¯ºè¯Šæ–­æˆ–æ²»ç–—æ•ˆæœã€‚',
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
    logoText: 'ç‰™',
    brandSubtitle: 'å®˜æ–¹æŒ‚å·å’¨è¯¢æœåŠ¡',
    brandBadgeText: 'é¢„çº¦å’¨è¯¢',
    originalPriceLabel: 'åŸä»·',
    activityPriceLabel: 'æ´»åŠ¨ä»·',
    nameLabel: 'æ‚¨çš„å§“å',
    namePlaceholder: 'è¯·è¾“å…¥',
    phoneLabel: 'æ‚¨çš„ç”µè¯',
    phoneAuthorizedPrefix: 'å·²æˆæƒï¼š',
    phoneAuthorizeButtonText: 'ç‚¹å‡»æˆæƒæ‰‹æœºå·',
    ageLabel: 'æ‚¨çš„å¹´é¾„',
    missingTeethLabel: 'ç¼ºç‰™æƒ…å†µ',
    clinicLabel: 'æœŸæœ›é—¨åº—',
    clinicPlaceholder: 'è¯·é€‰æ‹©',
    remarkLabel: 'å¤‡æ³¨',
    remarkPlaceholder: 'å¯å¡«å†™æ–¹ä¾¿è”ç³»æ—¶é—´æˆ–å…¶ä»–éœ€æ±‚',
    privacyCheckboxText: 'æˆ‘å·²é˜…è¯»å¹¶åŒæ„éšç§åè®®',
    submitButtonText: 'ç‚¹å‡»ä¸¨é¢†å–ç§ç‰™ä¼˜æƒ åé¢',
    noticeText: 'ç”±äºå’¨è¯¢äººæ•°è¾ƒå¤šï¼Œæˆ‘ä»¬ä¼šåœ¨24å°æ—¶å†…è”ç³»æ‚¨ã€‚',
    myAppointmentsButtonText: 'æŸ¥çœ‹æˆ‘çš„æŒ‚å·',
    authModalTitle: 'æˆæƒæ‰‹æœºå·',
    authModalDescription:
      'æ‰‹æœºå·ä¼˜å…ˆé€šè¿‡å¾®ä¿¡æˆæƒè·å–å¹¶åŠ å¯†ä¿å­˜ï¼›å¦‚æœå¾®ä¿¡è¿”å›çš„ä¸æ˜¯ 11 ä½æ‰‹æœºå·ï¼Œå†æŒ‰æç¤ºæ‰‹åŠ¨è¡¥å½•ã€‚',
    authModalButtonText: 'æˆæƒæ‰‹æœºå·',
    authModalCancelText: 'å…ˆæµè§ˆé¡µé¢',
    customerServiceLabel: 'å®¢æœç”µè¯'
  },
  formOptions: {
    ageRanges: ['40å²ä»¥ä¸‹', '40-50å²', '50-60å²', '60å²ä»¥ä¸Š'],
    missingTeethTypes: ['å•é¢—ç¼ºå¤±', 'å¤šé¢—ç¼ºå¤±', 'åŠå£ç¼ºå¤±', 'å…¨å£ç¼ºå¤±', 'ä¸ç¡®å®š']
  }
};

const defaultOfficialAutoReply: OfficialAutoReplyConfig = {
  enabled: true,
  subscribeReplyEnabled: true,
  subscribeReply:
    'æ¬¢è¿å…³æ³¨ï¼å¦‚éœ€ç§æ¤ç‰™å’¨è¯¢æˆ–é¢„çº¦æŒ‚å·ï¼Œè¯·ç‚¹å‡»å…¬ä¼—å·èœå•â€œç«‹å³æŒ‚å·â€æäº¤ä¿¡æ¯ï¼Œå·¥ä½œäººå‘˜ä¼šå°½å¿«è”ç³»æ‚¨ã€‚',
  messageReplyEnabled: true,
  messageReply:
    'æ‚¨å¥½ï¼Œå·²æ”¶åˆ°æ‚¨çš„æ¶ˆæ¯ã€‚å¦‚éœ€é¢„çº¦æŒ‚å·ï¼Œè¯·ç‚¹å‡»å…¬ä¼—å·èœå•â€œç«‹å³æŒ‚å·â€ï¼›å¦‚éœ€äººå·¥ååŠ©ï¼Œå·¥ä½œäººå‘˜ä¼šå°½å¿«æŸ¥çœ‹å¹¶è”ç³»æ‚¨ã€‚',
  keywordReplyEnabled: true,
  keywordRules: [
    {
      id: 'default-register',
      keyword: 'æŒ‚å·',
      matchMode: 'CONTAINS',
      replyContent: 'æ‚¨å¥½ï¼Œç‚¹å‡»å…¬ä¼—å·èœå•â€œç«‹å³æŒ‚å·â€å³å¯æäº¤é¢„çº¦ä¿¡æ¯ï¼Œå·¥ä½œäººå‘˜ä¼šå°½å¿«è”ç³»æ‚¨ã€‚',
      enabled: true,
      createdAt: new Date(0).toISOString()
    },
    {
      id: 'default-phone',
      keyword: 'ç”µè¯',
      matchMode: 'CONTAINS',
      replyContent: 'æ‚¨å¥½ï¼Œå®¢æœç”µè¯å¯åœ¨æŒ‚å·é¡µé¢åº•éƒ¨æŸ¥çœ‹ã€‚ä¹Ÿå¯ä»¥ç›´æ¥åœ¨å…¬ä¼—å·ç•™è¨€ï¼Œå·¥ä½œäººå‘˜ä¼šå°½å¿«å›å¤ã€‚',
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
        description: 'é™¢å†…å›è®¿ç³»ç»Ÿé¢„çº¦æ¥æ”¶æ¥å£é…ç½®'
      },
      update: {
        valueJson: next as unknown as Prisma.InputJsonValue,
        description: 'é™¢å†…å›è®¿ç³»ç»Ÿé¢„çº¦æ¥æ”¶æ¥å£é…ç½®'
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
        }ïù¶‰ËkºwµçGDfÆÆ&6²€¢ö–çFÖVçBÀ¢&V6—–VçBæö÷Vä–BÇÂrrÀ¢fÆÆ&6µFW‡BÀ¢t…EEôU%$õ"rÀ¢W'&÷"–ç7Fæ6VöbW'&÷"òW'&÷"æÖW76vR¢~[z^KÙÎK«®Yikš(N{ªn˜	®yú^Xù˜[È.[‹‚p¢“°¢–b†fÆÆ&6²ÓÓÒæ÷F–f–6F–öå7FGW2å5T44U52’7V66W72³Ò°¢VÇ6Rf–ÆVB³Ò°¢Ğ¢Ğ¢&WGW&â²F÷FÃ¢&V6—–VçG2æÆVæwF‚Â7V66W72Âf–ÆVBÂ6¶—VC¢Ó°¢Ğ ¢7–æ2&WG'”æ÷F–f–6F–öâ†Æöt–C¢7G&–ær’°¢6öç7BÆörÒv—BF†—2ç&—6Öææ÷F–f–6F–öäÆöræf–æEVæ—VR‡²v†W&S¢²–C¢Æöt–BÒÒ“°¢–b‚ÆörÇÂÆöræö–çFÖVçD–B’°¢F‡&÷ræWr'W6–æW74W†6WF–öâƒCC"Â~˜	®yú^Šë[Ù^KˆŞZÙYÊh‰nizk9^˜xŞŠùRr“°¢Ğ¢v—BF†—2ç&—6Öææ÷F–f–6F–öäÆörçWFFR‡°¢v†W&S¢²–C¢Æöræ–BÒÀ¢FF¢²&WG'”6÷VçC¢²–æ7&VÖVçC¢ÒĞ¢Ò“°¢6öç7B–ÆöBÒÆörç–ÆöD§6öâ2&V6÷&CÇ7G&–ærÂç“âÂçVÆÃ°¢–b€¢–ÆöCòæ¶–æBÓÓÒu5Ddeôô”åDÔTåEôäõD”4RrÇÀ¢–ÆöCòæ¶–æBÓÓÒu5Ddeôô”åDÔTåEôäõD”4Uô5U5DôÕõDU…BrÇÀ¢–ÆöCòæFFòæf—'7CòçfÇVRÓÓÒ~iÈiky¨Nš(N{ªnKúhòp¢’°¢&WGW&âF†—2ç6VæE7Ffdö–çFÖVçDæ÷F–6R†Æöræö–çFÖVçD–B“°¢Ğ¢&WGW&âF†—2ç6VæDö–çFÖVçE7V66W72†Æöræö–çFÖVçD–B“°¢Ğ ¢&—fFR7–æ26VæDöff–6–Ä66÷VçEFV×ÆFR€¢ö–çFÖVçC¢&—6Öäö–çFÖVçDvWE–ÆöCÇ²–æ6ÇVFS¢²6Æ–æ–3¢G'VS²W6W#¢²–æ6ÇVFS¢²–FVçF—F–W3¢G'VRÒÒÒÓà¢’°¢6öç7BvT6öæf–rÒv—BF†—2æ6öæf–w2ævWDÆæF–æuvR‚“°¢6öç7BFV×ÆFT–BĞ¢F†—2æ6öæf–rævWCÇ7G&–æsâ‚tôdd”4”Åô44õTåEõDTÕÄDUôô”åDÔTåEõ5T44U52r’ÇÀ¢vT6öæf–ræöff–6–Ä66÷VçEFV×ÆFT–C°¢6öç7Bö÷Vä–BÒö–çFÖVçBçW6W"æ–FVçF—F–W2æf–æB‚†—FVÒ’Óâ—FVÒæö÷Vä–B“òæö÷Vä–C°¢6öç7B–ÆöBÒF†—2æ'V–ÆDöff–6–Å–ÆöB†ö–çFÖVçBÂö÷Vä–BÇÂrrÂFV×ÆFT–BÇÂrr“°¢–b‚ö÷Vä–B’°¢v—BF†—2æ7&VFTÆör‡°¢ö–çFÖVçBÀ¢6†ææVÃ¢æ÷F–f–6F–öä6†ææVÂäôdd”4”Åô44õTåEõDTÕÄDRÀ¢F&vWD÷Vä–C¢çVÆÂÀ¢FV×ÆFT–BÀ¢–ÆöD§6öã¢–ÆöBÀ¢7FGW3¢æ÷F–f–6F–öå7FGW2äd”ÄTBÀ¢W'&÷$6öFS¢täõôôôõTä”BrÀ¢W'&÷$ÖW76vS¢~yJh‹~iÊ®{¹Zé®XZÎKÉ~Xûr÷Væ–NûÈÎizk9^Xù˜XZÎKÉ~Xû~jŠiÛşkhhòp¢Ò“°¢&WGW&âæ÷F–f–6F–öå7FGW2äd”ÄTC°¢Ğ¢–b‚FV×ÆFT–B’°¢v—BF†—2æ7&VFTÆör‡°¢ö–çFÖVçBÀ¢6†ææVÃ¢æ÷F–f–6F–öä6†ææVÂäôdd”4”Åô44õTåEõDTÕÄDRÀ¢F&vWD÷Vä–C¢ö÷Vä–BÀ¢FV×ÆFT–BÀ¢–ÆöD§6öã¢–ÆöBÀ¢7FGW3¢æ÷F–f–6F–öå7FGW2äd”ÄTBÀ¢W'&÷$6öFS¢täõõDTÕÄDUô”BrÀ¢W'&÷$ÖW76vS¢~iÊ®˜XŞ{ÚîXZÎKÉ~Xû~jŠiÛşkhhò”Bp¢Ò“°¢&WGW&âæ÷F–f–6F–öå7FGW2äd”ÄTC°¢Ğ¢G'’°¢–b‡F†—2æ—4Öö6²‚’’°¢v—BF†—2æ7&VFTÆör‡°¢ö–çFÖVçBÀ¢6†ææVÃ¢æ÷F–f–6F–öä6†ææVÂäôdd”4”Åô44õTåEõDTÕÄDRÀ¢F&vWD÷Vä–C¢ö÷Vä–BÀ¢FV×ÆFT–BÀ¢–ÆöD§6öã¢–ÆöBÀ¢7FGW3¢æ÷F–f–6F–öå7FGW2å5T44U50¢Ò“°¢&WGW&âæ÷F–f–6F–öå7FGW2å5T44U53°¢Ğ¢6öç7B66W75Fö¶VâÒv—BF†—2æöff–6–ÂævWD66W75Fö¶Vâ‚“°¢6öç7B&W7öç6RÒv—B†–÷2ç÷7B€¢‡GG3¢òö’çvV—†–âçæ6öÒö6v’Ö&–âöÖW76vR÷FV×ÆFR÷6VæCö66W75÷Fö¶VãÒG¶66W75Fö¶VçÖÀ¢–Æö@¢“°¢6öç7Bö²Ò&W7öç6RæFFæW'&6öFRÓÓÒ°¢v—BF†—2æ7&VFTÆör‡°¢ö–çFÖVçBÀ¢6†ææVÃ¢æ÷F–f–6F–öä6†ææVÂäôdd”4”Åô44õTåEõDTÕÄDRÀ¢F&vWD÷Vä–C¢ö÷Vä–BÀ¢FV×ÆFT–BÀ¢–ÆöD§6öã¢–ÆöBÀ¢7FGW3¢ö²òæ÷F–f–6F–öå7FGW2å5T44U52¢æ÷F–f–6F–öå7FGW2äd”ÄTBÀ¢W'&÷$6öFS¢ö²òVæFVf–æVB¢7G&–ær‡&W7öç6RæFFæW'&6öFR’À¢W'&÷$ÖW76vS¢ö²òVæFVf–æVB¢&W7öç6RæFFæW'&×6p¢Ò“°¢&WGW&âö²òæ÷F–f–6F–öå7FGW2å5T44U52¢æ÷F–f–6F–öå7FGW2äd”ÄTC°¢Ò6F6‚†W'&÷"’°¢v—BF†—2æ7&VFTÆör‡°¢ö–çFÖVçBÀ¢6†ææVÃ¢æ÷F–f–6F–öä6†ææVÂäôdd”4”Åô44õTåEõDTÕÄDRÀ¢F&vWD÷Vä–C¢ö÷Vä–BÀ¢FV×ÆFT–BÀ¢–ÆöD§6öã¢–ÆöBÀ¢7FGW3¢æ÷F–f–6F–öå7FGW2äd”ÄTBÀ¢W'&÷$6öFS¢t…EEôU%$õ"rÀ¢W'&÷$ÖW76vS¢W'&÷"–ç7Fæ6VöbW'&÷"òW'&÷"æÖW76vR¢~XZÎKÉ~Xû~jŠiÛşkhhşXù˜[È.[‹‚p¢Ò“°¢&WGW&âæ÷F–f–6F–öå7FGW2äd”ÄTC°¢Ğ¢Ğ ¢&—fFR7–æ26VæDÖ–æ•7V'67&–&R€¢ö–çFÖVçC¢&—6Öäö–çFÖVçDvWE–ÆöCÇ²–æ6ÇVFS¢²6Æ–æ–3¢G'VS²W6W#¢²–æ6ÇVFS¢²–FVçF—F–W3¢G'VRÒÒÒÓà¢’°¢6öç7BvT6öæf–rÒv—BF†—2æ6öæf–w2ævWDÆæF–æuvR‚“°¢6öç7BFV×ÆFT–BĞ¢F†—2æ6öæf–rævWCÇ7G&–æsâ‚tÔ”ä•õ5T%45$”$UõDTÕÄDUôô”åDÔTåEõ5T44U52r’ÇÀ¢vT6öæf–ræÖ–æ•7V'67&–&UFV×ÆFT–C°¢6öç7BÖ–æ”÷Vä–BÒö–çFÖVçBçW6W"æ–FVçF—F–W2æf–æB‚†—FVÒ’Óâ—FVÒæÖ–æ”÷Vä–B“òæÖ–æ”÷Vä–C°¢6öç7B–ÆöBÒF†—2æ'V–ÆDÖ–æ•–ÆöB†ö–çFÖVçBÂÖ–æ”÷Vä–BÇÂrrÂFV×ÆFT–BÇÂrr“°¢–b‚Ö–æ”÷Vä–B’°¢v—BF†—2æ7&VFTÆör‡°¢ö–çFÖVçBÀ¢6†ææVÃ¢æ÷F–f–6F–öä6†ææVÂäÔ”ä•õ$ôu$Õõ5T%45$”$RÀ¢F&vWD÷Vä–C¢çVÆÂÀ¢FV×ÆFT–BÀ¢–ÆöD§6öã¢–ÆöBÀ¢7FGW3¢æ÷F–f–6F–öå7FGW2äd”ÄTBÀ¢W'&÷$6öFS¢täõôÔ”ä•ôõTä”BrÀ¢W'&÷$ÖW76vS¢~yJh‹~k*iÈ[şzˆ¾[¨ò÷Væ–NûÈÎizk9^Xù˜Šê.™ˆ^khhòp¢Ò“°¢&WGW&âæ÷F–f–6F–öå7FGW2äd”ÄTC°¢Ğ¢–b‚FV×ÆFT–B’°¢v—BF†—2æ7&VFTÆör‡°¢ö–çFÖVçBÀ¢6†ææVÃ¢æ÷F–f–6F–öä6†ææVÂäÔ”ä•õ$ôu$Õõ5T%45$”$RÀ¢F&vWD÷Vä–C¢Ö–æ”÷Vä–BÀ¢FV×ÆFT–BÀ¢–ÆöD§6öã¢–ÆöBÀ¢7FGW3¢æ÷F–f–6F–öå7FGW2äd”ÄTBÀ¢W'&÷$6öFS¢täõõDTÕÄDUô”BrÀ¢W'&÷$ÖW76vS¢~iÊ®˜XŞ{Úî[şzˆ¾[¨şŠê.™ˆ^khhşjŠiÛò”Bp¢Ò“°¢&WGW&âæ÷F–f–6F–öå7FGW2äd”ÄTC°¢Ğ¢G'’°¢–b‡F†—2æ—4Öö6²‚’’°¢v—BF†—2æ7&VFTÆör‡°¢ö–çFÖVçBÀ¢6†ææVÃ¢æ÷F–f–6F–öä6†ææVÂäÔ”ä•õ$ôu$Õõ5T%45$”$RÀ¢F&vWD÷Vä–C¢Ö–æ”÷Vä–BÀ¢FV×ÆFT–BÀ¢–ÆöD§6öã¢–ÆöBÀ¢7FGW3¢æ÷F–f–6F–öå7FGW2å5T44U50¢Ò“°¢&WGW&âæ÷F–f–6F–öå7FGW2å5T44U53°¢Ğ¢6öç7B66W75Fö¶VâÒv—BF†—2æÖ–æ’ævWD66W75Fö¶Vâ‚“°¢6öç7B&W7öç6RÒv—B†–÷2ç÷7B€¢‡GG3¢òö’çvV—†–âçæ6öÒö6v’Ö&–âöÖW76vR÷7V'67&–&R÷6VæCö66W75÷Fö¶VãÒG¶66W75Fö¶VçÖÀ¢–Æö@¢“°¢6öç7B6¶—VBÒ&W7öç6RæFFæW'&6öFRÓÓÒC3°¢6öç7Bö²Ò&W7öç6RæFFæW'&6öFRÓÓÒ°¢v—BF†—2æ7&VFTÆör‡°¢ö–çFÖVçBÀ¢6†ææVÃ¢æ÷F–f–6F–öä6†ææVÂäÔ”ä•õ$ôu$Õõ5T%45$”$RÀ¢F&vWD÷Vä–C¢Ö–æ”÷Vä–BÀ¢FV×ÆFT–BÀ¢–ÆöD§6öã¢–ÆöBÀ¢7FGW3¢ö²òæ÷F–f–6F–öå7FGW2å5T44U52¢6¶—VBòæ÷F–f–6F–öå7FGW2å4´•TB¢æ÷F–f–6F–öå7FGW2äd”ÄTBÀ¢W'&÷$6öFS¢ö²òVæFVf–æVB¢7G&–ær‡&W7öç6RæFFæW'&6öFR’À¢W'&÷$ÖW76vS¢ö²òVæFVf–æVB¢&W7öç6RæFFæW'&×6p¢Ò“°¢&WGW&âö²òæ÷F–f–6F–öå7FGW2å5T44U52¢6¶—VBòæ÷F–f–6F–öå7FGW2å4´•TB¢æ÷F–f–6F–öå7FGW2äd”ÄTC°¢Ò6F6‚†W'&÷"’°¢v—BF†—2æ7&VFTÆör‡°¢ö–çFÖVçBÀ¢6†ææVÃ¢æ÷F–f–6F–öä6†ææVÂäÔ”ä•õ$ôu$Õõ5T%45$”$RÀ¢F&vWD÷Vä–C¢Ö–æ”÷Vä–BÀ¢FV×ÆFT–BÀ¢–ÆöD§6öã¢–ÆöBÀ¢7FGW3¢æ÷F–f–6F–öå7FGW2äd”ÄTBÀ¢W'&÷$6öFS¢t…EEôU%$õ"rÀ¢W'&÷$ÖW76vS¢W'&÷"–ç7Fæ6VöbW'&÷"òW'&÷"æÖW76vR¢~[şzˆ¾[¨şŠê.™ˆ^khhşXù˜[È.[‹‚p¢Ò“°¢&WGW&âæ÷F–f–6F–öå7FGW2äd”ÄTC°¢Ğ¢Ğ ¢&—fFR'V–ÆDöff–6–Å–ÆöB€¢ö–çFÖVçC¢&—6Öäö–çFÖVçDvWE–ÆöCÇ²–æ6ÇVFS¢²6Æ–æ–3¢G'VS²W6W#¢²–æ6ÇVFS¢²–FVçF—F–W3¢G'VRÒÒÒÓâÀ¢ö÷Vä–C¢7G&–ærÀ¢FV×ÆFT–C¢7G&–æp¢’°¢6öç7B7V&Ö—GFVDBÒF–§2†ö–çFÖVçBæ7&VFVDB’æf÷&ÖB‚u•••’ÔÔÒÔDB„ƒ¦ÖÒr“°¢6öç7B6öçFVçBÒ°¢hÈ.Xû~h‰X©şûÈÎ{ÉnXû~ûÉ¢G¶ö–çFÖVçBæö–çFÖVçDæ÷ÖÀ¢Zy>YŞûÉ¢G¶ö–çFÖVçBææÖWÖÀ¢š(N{ªnšyºîûÉ¢G¶ö–çFÖVçBæÖ—76–æuFVWF…G—WÖÀ¢hùKªNi{n™{NûÉ¢G·7V&Ö—GFVDGÖÀ¢~[z^KÙÎK«®Y[nYÊ‚#B[şi{nXh^ˆN{;¾h*ûÈÎŠû~KùŞhÈyK^ŠùŞyX^˜	®8"p¢Òæ¦ö–â‚uÆâr“° ¢&WGW&â°¢F÷W6W#¢ö÷Vä–BÀ¢FV×ÆFUö–C¢FV×ÆFT–BÀ¢Ö–æ—&öw&Ó¢°¢–C¢F†—2æ6öæf–rævWCÇ7G&–æsâ‚tÔ”ä•ôô”Br’À¢vWFƒ¢vW2÷7V66W72÷7V66W73ö–CÒG¶ö–çFÖVçBæ–GÖ ¢ÒÀ¢FF¢°¢6öçFVçC¢²fÇVS¢6öçFVçBÒÀ¢f—'7C¢²fÇVS¢~hÈ.Xû~h‰X©òrÒÀ¢¶W—v÷&C¢²fÇVS¢ö–çFÖVçBæö–çFÖVçDæòÒÀ¢¶W—v÷&C#¢²fÇVS¢ö–çFÖVçBææÖRÒÀ¢¶W—v÷&C3¢²fÇVS¢ö–çFÖVçBæÖ—76–æuFVWF…G—RÒÀ¢¶W—v÷&CC¢²fÇVS¢7V&Ö—GFVDBÒÀ¢&VÖ&³¢²fÇVS¢~[z^KÙÎK«®Y[nYÊ‚#B[şi{nXh^ˆN{;¾h*ûÈÎŠû~KùŞhÈyK^ŠùŞyX^˜	®8"rĞ¢Ğ¢Ó°¢Ğ ¢&—fFR'V–ÆE7Ffdöff–6–Å–ÆöB€¢ö–çFÖVçC¢&—6Öäö–çFÖVçDvWE–ÆöCÇ²–æ6ÇVFS¢²6Æ–æ–3¢G'VS²W6W#¢²–æ6ÇVFS¢²–FVçF—F–W3¢G'VRÒÒÒÓâÀ¢ö÷Vä–C¢7G&–ærÀ¢FV×ÆFT–C¢7G&–ærÀ¢&V6—–VçDæÖS¢7G&–æp¢’°¢6öç7B7V&Ö—GFVDBÒF–§2†ö–çFÖVçBæ7&VFVDB’æf÷&ÖB‚u•••’ÔÔÒÔDB„ƒ¦ÖÒr“°¢6öç7B6Æ–æ–4æÖRÒö–çFÖVçBæ6Æ–æ–3òææÖRÇÂ~iÊ®˜hº™z[©rs°¢6öç7B6öçFVçBÒF†—2æ'V–ÆE7Ffdæ÷F–6UFW‡B†ö–çFÖVçBÂ&V6—–VçDæÖR“° ¢&WGW&â°¢¶–æC¢u5Ddeôô”åDÔTåEôäõD”4RrÀ¢F÷W6W#¢ö÷Vä–BÀ¢FV×ÆFUö–C¢FV×ÆFT–BÀ¢FF¢°¢6öçFVçC¢²fÇVS¢6öçFVçBÒÀ¢f—'7C¢²fÇVS¢~iÈiky¨Nš(N{ªnKúhòrÒÀ¢¶W—v÷&C¢²fÇVS¢ö–çFÖVçBæö–çFÖVçDæòÒÀ¢¶W—v÷&C#¢²fÇVS¢ö–çFÖVçBææÖRÒÀ¢¶W—v÷&C3¢²fÇVS¢ö–çFÖVçBæÖ—76–æuFVWF…G—RÒÀ¢¶W—v÷&CC¢²fÇVS¢7V&Ö—GFVDBÒÀ¢†öæUöçVÖ&W#3¢²fÇVS¢ö–çFÖVçBç†öæTÖ6¶VBÒÀ¢F†–æs#¢²fÇVS¢F†—2çFV×ÆFUF†–ær†ö–çFÖVçBææÖRÇÂ~š(N{ªnZê.h‹rr’ÒÀ¢F†–æsS¢²fÇVS¢F†—2çFV×ÆFUF†–ær†ö–çFÖVçBæÖ—76–æuFVWF…G—RÇÂ~zxŞx™Y*Šú"r’ÒÀ¢&VÖ&³¢²fÇVS¢h˜¾iË®Xû~ûÉ¢G¶ö–çFÖVçBç†öæTÖ6¶VGŞûÉ¾™z[©~ûÉ¢G¶6Æ–æ–4æÖWÖĞ¢Ğ¢Ó°¢Ğ ¢&—fFR'V–ÆDÖ–æ•–ÆöB€¢ö–çFÖVçC¢&—6Öäö–çFÖVçDvWE–ÆöCÇ²–æ6ÇVFS¢²6Æ–æ–3¢G'VS²W6W#¢²–æ6ÇVFS¢²–FVçF—F–W3¢G'VRÒÒÒÓâÀ¢Ö–æ”÷Vä–C¢7G&–ærÀ¢FV×ÆFT–C¢7G&–æp¢’°¢&WGW&â°¢F÷W6W#¢Ö–æ”÷Vä–BÀ¢FV×ÆFUö–C¢FV×ÆFT–BÀ¢vS¢vW2÷7V66W72÷7V66W73ö–CÒG¶ö–çFÖVçBæ–GÖÀ¢FF¢°¢F†–æs¢²fÇVS¢ö–çFÖVçBæÖ—76–æuFVWF…G—Rç6Æ–6RƒÂ#’ÒÀ¢‡&6S#¢²fÇVS¢uÇSVcƒUÇSƒSEÇSv6f"rÒÀ¢6†&7FW%÷7G&–æs#¢²fÇVS¢ö–çFÖVçBæö–çFÖVçDæòç6Æ–6RƒÂ3"’ÒÀ¢F–ÖS3¢²fÇVS¢F–§2†ö–çFÖVçBæ7&VFVDB’æf÷&ÖB‚u•••’ÔÔÒÔDB„ƒ¦ÖÒr’ÒÀ¢‡&6SC¢²fÇVS¢uÇSVcƒUÇSƒSEÇSv6f"rĞ¢Ğ¢Ó°¢Ğ ¢&—fFR'V–ÆE7Ffdæ÷F–6UFW‡B€¢ö–çFÖVçC¢&—6Öäö–çFÖVçDvWE–ÆöCÇ²–æ6ÇVFS¢²6Æ–æ–3¢G'VS²W6W#¢²–æ6ÇVFS¢²–FVçF—F–W3¢G'VRÒÒÒÓâÀ¢&V6—–VçDæÖS¢7G&–æp¢’°¢6öç7B7V&Ö—GFVDBÒF–§2†ö–çFÖVçBæ7&VFVDB’æf÷&ÖB‚u•••’ÔÔÒÔDB„ƒ¦ÖÒr“°¢6öç7B6Æ–æ–4æÖRÒö–çFÖVçBæ6Æ–æ–3òææÖRÇÂ~iÊ®˜hº™z[©rs°¢&WGW&â°¢ikš(N{ªnhù˜i.ûÉ¢G¶ö–çFÖVçBæö–çFÖVçDæ÷ÖÀ¢hê^iKnK«®ûÉ¢G·&V6—–VçDæÖWÖÀ¢Zy>YŞûÉ¢G¶ö–çFÖVçBææÖWÖÀ¢h˜¾iË®Xû~ûÉ¢G¶ö–çFÖVçBç†öæTÖ6¶VGÖÀ¢[›N›èNjë^ûÉ¢G¶ö–çFÖVçBævU&ævWÖÀ¢{Ë®x™h8^Xk^ûÉ¢G¶ö–çFÖVçBæÖ—76–æuFVWF…G—WÖÀ¢iÉşiÉ¾™z[©~ûÉ¢G¶6Æ–æ–4æÖWÖÀ¢iÚ^k©ûÉ¢G¶ö–çFÖVçBç6÷W&6RÇÂ~iÊ®yúRwÖÀ¢hùKªNi{n™{NûÉ¢G·7V&Ö—GFVDGÖÀ¢ö–çFÖVçBç&VÖ&²òZH~k:ûÉ¢G¶ö–çFÖVçBç&VÖ&·Ö¢rp¢Òæf–ÇFW"„&ööÆVâ’æ¦ö–â‚uÆâr“°¢Ğ ¢&—fFRFV×ÆFUF†–ær‡fÇVS¢7G&–ær’°¢&WGW&â7G&–ær‡fÇVRÇÂrr’ç6Æ–6RƒÂ#“°¢Ğ ¢&—fFR7–æ26VæE7Ffd7W7FöÕFW‡DfÆÆ&6²€¢ö–çFÖVçC¢&—6Öäö–çFÖVçDvWE–ÆöCÇ²–æ6ÇVFS¢²6Æ–æ–3¢G'VS²W6W#¢²–æ6ÇVFS¢²–FVçF—F–W3¢G'VRÒÒÒÓâÀ¢ö÷Vä–C¢7G&–ærÀ¢6öçFVçC¢7G&–ærÀ¢&V6öä6öFSó¢7G&–ærÀ¢&V6öäÖW76vSó¢7G&–æp¢’°¢6öç7B–ÆöBÒ°¢¶–æC¢u5Ddeôô”åDÔTåEôäõD”4Uô5U5DôÕõDU…BrÀ¢F÷W6W#¢ö÷Vä–BÀ¢×6wG—S¢wFW‡BrÀ¢FW‡C¢²6öçFVçBÒÀ¢fÆÆ&6´g&öÓ¢°¢6†ææVÃ¢tôdd”4”Åô44õTåEõDTÕÄDRrÀ¢W'&÷$6öFS¢&V6öä6öFRÀ¢W'&÷$ÖW76vS¢&V6öäÖW76vP¢Ğ¢Ó°¢G'’°¢–b‡F†—2æ—4Öö6²‚’’°¢v—BF†—2æ7&VFTÆör‡°¢ö–çFÖVçBÀ¢6†ææVÃ¢æ÷F–f–6F–öä6†ææVÂäôdd”4”Åô44õTåEõDTÕÄDRÀ¢F&vWD÷Vä–C¢ö÷Vä–BÇÂçVÆÂÀ¢FV×ÆFT–C¢t5U5DôÕõDU…EôdÄÄ$4²rÀ¢–ÆöD§6öã¢–ÆöBÀ¢7FGW3¢æ÷F–f–6F–öå7FGW2å5T44U50¢Ò“°¢&WGW&âæ÷F–f–6F–öå7FGW2å5T44U53°¢Ğ¢6öç7B66W75Fö¶VâÒv—BF†—2æöff–6–ÂævWD66W75Fö¶Vâ‚“°¢6öç7B&W7öç6RÒv—B†–÷2ç÷7B€¢‡GG3¢òö’çvV—†–âçæ6öÒö6v’Ö&–âöÖW76vRö7W7FöÒ÷6VæCö66W75÷Fö¶VãÒG¶66W75Fö¶VçÖÀ¢°¢F÷W6W#¢ö÷Vä–BÀ¢×6wG—S¢wFW‡BrÀ¢FW‡C¢²6öçFVçBĞ¢Ğ¢“°¢6öç7Bö²Ò&W7öç6RæFFæW'&6öFRÓÓÒ°¢v—BF†—2æ7&VFTÆör‡°¢ö–çFÖVçBÀ¢6†ææVÃ¢æ÷F–f–6F–öä6†ææVÂäôdd”4”Åô44õTåEõDTÕÄDRÀ¢F&vWD÷Vä–C¢ö÷Vä–BÇÂçVÆÂÀ¢FV×ÆFT–C¢t5U5DôÕõDU…EôdÄÄ$4²rÀ¢–ÆöD§6öã¢–ÆöBÀ¢7FGW3¢ö²òæ÷F–f–6F–öå7FGW2å5T44U52¢æ÷F–f–6F–öå7FGW2äd”ÄTBÀ¢W'&÷$6öFS¢ö²òVæFVf–æVB¢7G&–ær‡&W7öç6RæFFæW'&6öFR’À¢W'&÷$ÖW76vS¢ö²òVæFVf–æVB¢&W7öç6RæFFæW'&×6p¢Ò“°¢&WGW&âö²òæ÷F–f–6F–öå7FGW2å5T44U52¢æ÷F–f–6F–öå7FGW2äd”ÄTC°¢Ò6F6‚†W'&÷"’°¢v—BF†—2æ7&VFTÆör‡°¢ö–çFÖVçBÀ¢6†ææVÃ¢æ÷F–f–6F–öä6†ææVÂäôdd”4”Åô44õTåEõDTÕÄDRÀ¢F&vWD÷Vä–C¢ö÷Vä–BÇÂçVÆÂÀ¢FV×ÆFT–C¢t5U5DôÕõDU…EôdÄÄ$4²rÀ¢–ÆöD§6öã¢–ÆöBÀ¢7FGW3¢æ÷F–f–6F–öå7FGW2äd”ÄTBÀ¢W'&÷$6öFS¢t5U5DôÕõDU…Eô…EEôU%$õ"rÀ¢W'&÷$ÖW76vS¢W'&÷"–ç7Fæ6VöbW'&÷"òW'&÷"æÖW76vR¢~[z^KÙÎK«®YZê.iÈŞih~iÊÎkhhşXù˜[È.[‹‚p¢Ò“°¢&WGW&âæ÷F–f–6F–öå7FGW2äd”ÄTC°¢Ğ¢Ğ ¢&—fFR7&VFTÆör†–çWC¢°¢ö–çFÖVçC¢&—6Öäö–çFÖVçDvWE–ÆöCÇ²–æ6ÇVFS¢²6Æ–æ–3¢G'VS²W6W#¢²–æ6ÇVFS¢²–FVçF—F–W3¢G'VRÒÒÒÓã°¢6†ææVÃ¢æ÷F–f–6F–öä6†ææVÃ°¢F&vWD÷Vä–C¢7G&–ærÂçVÆÃ°¢FV×ÆFT–Có¢7G&–æs°¢–ÆöD§6öã¢&—6Öä–çWD§6öåfÇVS°¢7FGW3¢æ÷F–f–6F–öå7FGW3°¢W'&÷$6öFSó¢7G&–æs°¢W'&÷$ÖW76vSó¢7G&–æs°¢Ò’°¢&WGW&âF†—2ç&—6Öææ÷F–f–6F–öäÆöræ7&VFR‡°¢FF¢°¢W6W$–C¢–çWBæö–çFÖVçBçW6W$–BÀ¢ö–çFÖVçD–C¢–çWBæö–çFÖVçBæ–BÀ¢6†ææVÃ¢–çWBæ6†ææVÂÀ¢F&vWD÷Vä–C¢–çWBçF&vWD÷Vä–BÀ¢FV×ÆFT–C¢–çWBçFV×ÆFT–BÀ¢–ÆöD§6öã¢–çWBç–ÆöD§6öâÀ¢7FGW3¢–çWBç7FGW2À¢W'&÷$6öFS¢–çWBæW'&÷$6öFRÀ¢W'&÷$ÖW76vS¢–çWBæW'&÷$ÖW76vRÀ¢6VçDC¢–çWBç7FGW2ÓÓÒæ÷F–f–6F–öå7FGW2å5T44U52òæWrFFR‚’¢VæFVf–æV@¢Ğ¢Ò“°¢Ğ ¢&—fFR—4Öö6²‚“¢&ööÆVâ°¢6öç7BVçbÒF†—2æ6öæf–rævWCÇ7G&–æsâ‚täôDUôTåbr“°¢&WGW&âVçbÓÓÒwFW7Bs°¢Ğ§Ğ 