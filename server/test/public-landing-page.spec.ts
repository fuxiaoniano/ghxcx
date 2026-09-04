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

  it('renders an 11-digit phone form with a nonce-protected submit script', async () => {
    const configs = { getLandingPage: jest.fn().mockResolvedValue(config) };
    const controller = new PublicPageController(configs as any);
    const response = {
      setHeader: jest.fn(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    await controller.landingByKey('page-one', 'article', response as any);

    const html = response.send.mock.calls[0][0] as string;
    const csp = response.setHeader.mock.calls.find(([name]) => name === 'Content-Security-Policy')?.[1] as string;
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
    expect(configs.getLandingPage).toHaveBeenCalledWith('page-one');
    expect(html).toContain('type="tel"');
    expect(html).toContain('maxlength="11"');
    expect(html).toContain(String.raw`replace(/\D/g, '')`);
    expect(html).toContain(String.raw`/^1\d{10}$/`);
    expect(html).toContain('/api/public/landing-pages/page-one/appointments');
    expect(nonce).toBeTruthy();
    expect(html).toContain(`script nonce="${nonce}"`);
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
