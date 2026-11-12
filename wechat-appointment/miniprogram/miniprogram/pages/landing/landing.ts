import { miniLogin, authorizePhone, submitManualPhone } from '../../api/auth';
import { createAppointment } from '../../api/appointments';
import { getLandingPageConfig } from '../../api/config';
import { LandingPageConfig } from '../../api/types';

const DEFAULT_HERO_IMAGE = '/assets/landing-hero.jpg';
const SUBMIT_BUTTON_TEXT = '点击丨领取种牙优惠名额';

const defaultAgeRanges = ['40岁以下', '40-50岁', '50-60岁', '60岁以上'];
const defaultMissingTeethTypes = ['单颗缺失', '多颗缺失', '半口缺失', '全口缺失', '不确定'];

const emptyConfig: LandingPageConfig = {
  pageKey: 'default',
  brandName: '傅小念口腔',
  brandHtml: '',
  activityTitle: '舒适化种牙咨询',
  activityHtml: '',
  originalPrice: '',
  activityPrice: '',
  subsidyText: '',
  includedItems: [],
  filingNo: '',
  institutionName: '',
  privacyAgreement: '我已阅读并同意隐私协议，提交信息仅用于挂号咨询和工作人员联系。',
  customerServicePhone: '',
  footerText: '',
  shareTitle: '傅小念口腔预约咨询',
  shareImageUrl: '',
  formTopImages: [DEFAULT_HERO_IMAGE],
  display: {
    brandSection: false,
    logo: false,
    brandName: false,
    brandSubtitle: false,
    brandBadge: false,
    bannerSection: false,
    subsidyText: false,
    priceCard: false,
    includedItems: false,
    formTopImages: true,
    formTitle: false,
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
    submitButtonText: SUBMIT_BUTTON_TEXT,
    noticeText: '由于咨询人数较多，我们会在24小时内联系您。',
    myAppointmentsButtonText: '查看我的挂号',
    authModalTitle: '授权手机号',
    authModalDescription: '手机号优先通过微信授权获取并加密保存；如果微信返回的不是 11 位手机号，再按提示手动补录。',
    authModalButtonText: '授权手机号',
    authModalCancelText: '先浏览页面',
    customerServiceLabel: '客服电话'
  },
  formOptions: {
    ageRanges: defaultAgeRanges,
    missingTeethTypes: defaultMissingTeethTypes
  },
  clinics: []
};

function isAppointmentsTarget(target?: string) {
  let value = String(target || '').trim();
  try {
    value = decodeURIComponent(value).trim();
  } catch {
    value = String(target || '').trim();
  }
  return value === 'my' || value === 'appointments' || value.indexOf('pages/appointments/appointments') >= 0;
}

function buildAppointmentsUrl(bindToken?: string, source?: string) {
  const query: string[] = [];
  if (bindToken) {
    query.push(`bindToken=${encodeURIComponent(bindToken)}`);
  }
  if (source) {
    query.push(`source=${encodeURIComponent(source)}`);
  }
  return `/pages/appointments/appointments${query.length ? `?${query.join('&')}` : ''}`;
}

function isMainlandMobile(phone: string) {
  return /^1\d{10}$/.test(String(phone || ''));
}

function normalizePhoneNumber(phone: string) {
  return String(phone || '').replace(/[^\d+]/g, '');
}

function normalizeList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const list = value.map((item) => String(item || '').trim()).filter(Boolean);
  return list.length ? list : fallback;
}

function normalizeLandingConfig(config?: Partial<LandingPageConfig>): LandingPageConfig {
  const text = {
    ...emptyConfig.text,
    ...(config?.text || {})
  };
  if (!text.submitButtonText || text.submitButtonText === '免费挂号' || text.submitButtonText === '点击领丨取种牙优惠名额') {
    text.submitButtonText = SUBMIT_BUTTON_TEXT;
  }

  const merged: LandingPageConfig = {
    ...emptyConfig,
    ...(config || {}),
    display: {
      ...emptyConfig.display,
      ...(config?.display || {})
    },
    text,
    formOptions: {
      ageRanges: normalizeList(config?.formOptions?.ageRanges, defaultAgeRanges),
      missingTeethTypes: normalizeList(config?.formOptions?.missingTeethTypes, defaultMissingTeethTypes)
    },
    formTopImages: normalizeList(config?.formTopImages, [DEFAULT_HERO_IMAGE]),
    clinics: Array.isArray(config?.clinics) ? config.clinics : []
  };

  return merged;
}

Page({
  data: {
    config: emptyConfig,
    pageKey: 'default',
    heroImageUrl: DEFAULT_HERO_IMAGE,
    clinicNames: [emptyConfig.text.clinicPlaceholder],
    bindToken: '',
    source: 'mini_program',
    phoneMasked: '',
    hasPhone: false,
    showAuthModal: false,
    manualPhoneMode: false,
    manualPhone: '',
    manualPhoneSaving: false,
    submitting: false,
    ageIndex: 0,
    missingIndex: 0,
    clinicIndex: 0,
    form: {
      name: '',
      remark: '',
      privacyAccepted: false
    }
  },

  async onLoad(options: Record<string, string | undefined>) {
    const bindToken = options.bindToken || '';
    const source = options.source || 'mini_program';
    const pageKey = options.page || '';
    this.setData({ bindToken, source, pageKey });
    wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
    if (isAppointmentsTarget(options.target || options.targetPath)) {
      wx.redirectTo({ url: buildAppointmentsUrl(bindToken, source) });
      return;
    }
    await this.loadConfig(pageKey);
    await this.login(bindToken);
  },

  async loadConfig(pageKey?: string) {
    try {
      const config = normalizeLandingConfig(await getLandingPageConfig(pageKey));
      this.applyConfig(config);
    } catch (error) {
      // 配置接口被微信合法域名拦截时，仍用本地默认配置展示完整表单，避免用户看到技术报错。
      console.warn('landing page config load failed', error);
      this.applyConfig(normalizeLandingConfig());
    }
  },

  applyConfig(config: LandingPageConfig) {
    const heroImageUrl = config.display.formTopImages ? (config.formTopImages[0] || DEFAULT_HERO_IMAGE) : '';
    const clinicNames = [config.text.clinicPlaceholder, ...config.clinics.map((clinic) => clinic.name)];
    this.setData({
      config,
      pageKey: config.pageKey || this.data.pageKey || 'default',
      heroImageUrl,
      clinicNames,
      ageIndex: 0,
      missingIndex: 0,
      clinicIndex: 0
    });
  },

  onHeroImageError() {
    if (this.data.heroImageUrl && this.data.heroImageUrl !== DEFAULT_HERO_IMAGE) {
      this.setData({ heroImageUrl: DEFAULT_HERO_IMAGE });
      return;
    }
    this.setData({ heroImageUrl: '' });
  },

  async login(bindToken?: string) {
    try {
      const result = await miniLogin(bindToken);
      this.setData({
        phoneMasked: result.phoneMasked || '',
        hasPhone: result.hasPhone,
        manualPhoneMode: Boolean(result.needManualPhone),
        showAuthModal: false
      });
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : '登录失败', icon: 'none' });
    }
  },

  onNameInput(event: WechatMiniprogram.Input) {
    this.setData({ 'form.name': event.detail.value });
  },

  onRemarkInput(event: WechatMiniprogram.Input) {
    this.setData({ 'form.remark': event.detail.value });
  },

  onAgeChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ ageIndex: Number(event.detail.value) });
  },

  onMissingChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ missingIndex: Number(event.detail.value) });
  },

  onClinicChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ clinicIndex: Number(event.detail.value) });
  },

  togglePrivacy() {
    this.setData({ 'form.privacyAccepted': !this.data.form.privacyAccepted });
  },

  closeAuthModal() {
    this.setData({ showAuthModal: false });
  },

  async onGetPhoneNumber(event: WechatMiniprogram.ButtonGetPhoneNumber) {
    if (!event.detail.code) {
      wx.showToast({ title: '您暂未授权手机号', icon: 'none' });
      return;
    }
    try {
      const result = await authorizePhone(event.detail.code);
      if (result.needManualPhone) {
        this.setData({
          phoneMasked: '',
          hasPhone: false,
          manualPhoneMode: true,
          manualPhone: '',
          showAuthModal: false
        });
        wx.showToast({ title: result.message || '请输入 11 位手机号', icon: 'none' });
        return;
      }
      this.setData({
        phoneMasked: result.phoneMasked,
        hasPhone: true,
        manualPhoneMode: false,
        manualPhone: '',
        showAuthModal: false
      });
      wx.showToast({ title: '授权成功', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : '手机号授权失败', icon: 'none' });
    }
  },

  onManualPhoneInput(event: WechatMiniprogram.Input) {
    this.setData({ manualPhone: String(event.detail.value || '').replace(/\D/g, '').slice(0, 11) });
  },

  async saveManualPhone() {
    const phone = String(this.data.manualPhone || '').trim();
    if (!isMainlandMobile(phone)) {
      wx.showToast({ title: '请输入 11 位手机号', icon: 'none' });
      return;
    }
    if (this.data.manualPhoneSaving) return;
    this.setData({ manualPhoneSaving: true });
    try {
      const result = await submitManualPhone(phone);
      this.setData({
        phoneMasked: result.phoneMasked,
        hasPhone: true,
        manualPhoneMode: false,
        manualPhone: '',
        showAuthModal: false
      });
      wx.showToast({ title: '手机号已保存', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : '手机号保存失败', icon: 'none' });
    } finally {
      this.setData({ manualPhoneSaving: false });
    }
  },

  async requestSubscribe() {
    const templateId = this.data.config.miniSubscribeTemplateId;
    if (!templateId) {
      return;
    }
    await new Promise<void>((resolve) => {
      wx.requestSubscribeMessage({
        tmplIds: [templateId],
        complete: () => resolve()
      });
    });
  },

  async submit() {
    if (this.data.submitting) return;
    if (!this.data.form.name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!this.data.hasPhone) {
      this.setData({ showAuthModal: !this.data.manualPhoneMode });
      wx.showToast({
        title: this.data.manualPhoneMode ? '请先填写 11 位手机号' : '请先授权手机号后再提交挂号',
        icon: 'none'
      });
      return;
    }
    if (!this.data.form.privacyAccepted) {
      wx.showToast({ title: '请先勾选隐私协议', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await this.requestSubscribe();
      const clinic = this.data.config.clinics[this.data.clinicIndex - 1];
      const appointment = await createAppointment({
        name: this.data.form.name.trim(),
        ageRange: this.data.config.formOptions.ageRanges[this.data.ageIndex] || defaultAgeRanges[0],
        missingTeethType: this.data.config.formOptions.missingTeethTypes[this.data.missingIndex] || defaultMissingTeethTypes[0],
        clinicId: clinic?.id,
        remark: this.data.form.remark,
        source: this.data.source,
        privacyAccepted: this.data.form.privacyAccepted,
        landingPageKey: this.data.pageKey || undefined
      });
      wx.redirectTo({ url: `/pages/success/success?id=${appointment.id}` });
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  goMyAppointments() {
    wx.navigateTo({ url: buildAppointmentsUrl('', this.data.source) });
  },

  callCustomerService() {
    const phoneNumber = normalizePhoneNumber(this.data.config.customerServicePhone);
    if (!phoneNumber) {
      wx.showToast({ title: '客服电话未配置', icon: 'none' });
      return;
    }
    wx.makePhoneCall({
      phoneNumber,
      fail: () => this.copyCustomerServicePhone()
    });
  },

  copyCustomerServicePhone() {
    const phoneNumber = normalizePhoneNumber(this.data.config.customerServicePhone);
    if (!phoneNumber) {
      wx.showToast({ title: '客服电话未配置', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: phoneNumber,
      success: () => wx.showToast({ title: '电话已复制', icon: 'success' })
    });
  },

  onShareAppMessage() {
    const pageKey = this.data.pageKey || 'default';
    const result: WechatMiniprogram.Page.ICustomShareContent = {
      title: this.data.config.shareTitle || this.data.config.activityTitle || '挂号咨询',
      path: `/pages/landing/landing?page=${encodeURIComponent(pageKey)}&source=share`
    };
    if (this.data.config.shareImageUrl) {
      result.imageUrl = this.data.config.shareImageUrl;
    }
    return result;
  },

  onShareTimeline() {
    const pageKey = this.data.pageKey || 'default';
    return {
      title: this.data.config.shareTitle || this.data.config.activityTitle || '挂号咨询',
      query: `page=${encodeURIComponent(pageKey)}&source=timeline`,
      imageUrl: this.data.config.shareImageUrl || undefined
    };
  }
});
