import { validate } from 'class-validator';
import { PublicPageController } from '../src/public-page.controller';
import { CreatePublicAppointmentDto } from '../src/modules/appointments/dto';

describe('Public landing page', () => {
  const config = {
    pageKey: 'page-one',
    pageName: '测试页面',
    brandName: '测试品牌',
    brandHtml: '<div>测试品牌</div>',
    activityTitle: '测试活动',
    activityHtml: '<div>测试活动</div>',
    shareTitle: '测试分享',
    shareImageUrl: '',
    originalPrice: '',
    activityPrice: '',
    subsidyText: '',
    includedItems: [],
    formTopImages: [],
    privacyAgreement: '隐私说明',
    institutionName: '',
    filingNo: '',
    footerText: '',
    customerServicePhone: '',
    clinics: [],
    formOptions: { ageRanges: ['40岁以下'], missingTeethTypes: ['单颗缺失'] },
    display: {
      brandSection: true,
      bannerSection: true,
      formTopImages: true,
      formTitle: true,
      privacyAgreement: true,
      noticeText: true,
      footerSection: false,
      institutionName: false,
      filingNo: false,
      footerText: false,
      customerServicePhone: false,
      myAppointmentsButton: false
    },
    text: {
      nameLabel: '姓名',
      namePlaceholder: '请输入姓名',
      phoneLabel: '手机号',
      ageLabel: '年龄',
      missingTeethLabel: '缺牙情况',
      clinicLabel: '门店',
      clinicPlaceholder: '请选择',
      remarkLabel: '备注',
      remarkPlaceholder: '请输入备注',
      privacyCheckboxText: '同意隐私协议',
      submitButtonText: '提交',
      noticeText: '稍后联系',
      customerServiceLabel: '客服电话'
    }
  };

  const responseMock = () => ({
    setHeader: jest.fn(),
    type: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis()
  });

  const requestMock = (userAgent = 'Mozilla/5.0') => ({
    headers: { host: 'api.example.com', 'user-agent': userAgent },
    protocol: 'https',
    originalUrl: '/landing/page-one?source=article',
    url: '/landing/page-one?source=article',
    get: jest.fn().mockReturnValue('api.example.com')
  });

  it('renders an 11-digit phone form with a nonce-protected submit script', async () => {
    const configs = { getLandingPage: jest.fn().mockResolvedValue(config) };
    const officialAccount = { getJsSdkConfig: jest.fn() };
    const controller = new PublicPageController(configs as any, officialAccount as any);
    const response = responseMock();
    const request = requestMock();

    await controller.landingByKey('page-one', 'article', request as any, response as any);

    const html = response.send.mock.calls[0][0] as string;
    const csp = response.setHeader.mock.calls.find(([name]) => name === 'Content-Security-Policy')?.[1] as string;
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
    expect(configs.getLandingPage).toHaveBeenCalledWith('page-one');
    expect(html).toContain('type="tel"');
    expect(html).toContain('maxlength="11"');
    expect(html).toContain(String.raw`replace(/\D/g, '')`);
    expect(html).toContain(String.raw`/^1\d{10}$/`);
    expect(html).toContain('/api/public/landing-pages/page-one/appointments');
    expect(html).toContain('<meta property="og:title" content="测试分享" />');
    expect(html).toContain('<meta property="og:description" content="测试活动" />');
    expect(html).toContain('<meta property="og:url" content="https://api.example.com/landing/page-one?source=article" />');
    expect(officialAccount.getJsSdkConfig).not.toHaveBeenCalled();
    expect(nonce).toBeTruthy();
    expect(html).toContain(`script nonce="${nonce}"`);
  });

  it('configures a rich WeChat share card for WeChat browsers', async () => {
    const pageConfig = {
      ...config,
      shareImageUrl: '/uploads/landing-assets/share-cover.jpg'
    };
    const configs = { getLandingPage: jest.fn().mockResolvedValue(pageConfig) };
    const jsSdkConfig = {
      appId: 'wx-test',
      timestamp: 1700000000,
      nonceStr: 'nonce-value',
      signature: 'signature-value'
    };
    const officialAccount = { getJsSdkConfig: jest.fn().mockResolvedValue(jsSdkConfig) };
    const controller = new PublicPageController(configs as any, officialAccount as any);
    const response = responseMock();
    const request = requestMock('Mozilla/5.0 MicroMessenger/8.0.50');

    await controller.landingByKey('page-one', 'article', request as any, response as any);

    const html = response.send.mock.calls[0][0] as string;
    expect(officialAccount.getJsSdkConfig).toHaveBeenCalledWith(
      'https://api.example.com/landing/page-one?source=article'
    );
    expect(html).toContain(
      '<meta property="og:image" content="https://api.example.com/uploads/landing-assets/share-cover.jpg" />'
    );
    expect(html).toContain('https://res.wx.qq.com/open/js/jweixin-1.6.0.js');
    expect(html).toContain('window.wx.updateAppMessageShareData(shareData)');
    expect(html).toContain('"signature":"signature-value"');
  });

  it('keeps the landing page usable when WeChat share signing fails', async () => {
    const configs = { getLandingPage: jest.fn().mockResolvedValue(config) };
    const officialAccount = { getJsSdkConfig: jest.fn().mockRejectedValue(new Error('wechat unavailable')) };
    const controller = new PublicPageController(configs as any, officialAccount as any);
    const response = responseMock();

    await controller.landingByKey(
      'page-one',
      'article',
      requestMock('Mozilla/5.0 MicroMessenger/8.0.50') as any,
      response as any
    );

    const html = response.send.mock.calls[0][0] as string;
    expect(html).toContain('id="appointment-form"');
    expect(html).not.toContain('https://res.wx.qq.com/open/js/jweixin-1.6.0.js');
    expect(response.send).toHaveBeenCalledTimes(1);
  });

  it('rejects a phone number that is not 11 digits at DTO validation', async () => {
    const dto = Object.assign(new CreatePublicAppointmentDto(), {
      name: '测试用户',
      phone: '12345',
      ageRange: '40岁以下',
      missingTeethType: '单颗缺失',
      privacyAccepted: true
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'phone')).toBe(true);
  });
});
