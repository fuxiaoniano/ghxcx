import { ContentStatus } from '@prisma/client';
import { ConfigsService } from '../src/modules/configs/configs.service';

describe('ConfigsService', () => {
  const defaultPage = {
    id: 'landing_default',
    pageKey: 'default',
    name: '默认页',
    configJson: { brandName: '测试品牌', activityPrice: '后台价' },
    status: ContentStatus.ACTIVE,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  function createService() {
    const prisma = {
      landingPage: {
        findFirst: jest.fn().mockResolvedValue(defaultPage),
        findUnique: jest.fn().mockImplementation(({ where }: { where: Record<string, string> }) => {
          if (where.id === 'page_2' || where.pageKey === 'page-two') {
            return Promise.resolve({
              ...defaultPage,
              id: 'page_2',
              pageKey: 'page-two',
              name: '第二页',
              isDefault: false,
              configJson: {
                brandName: '第二品牌',
                brandHtml: '<div onclick="bad()"><strong>第二页</strong><script>alert(1)</script></div>'
              }
            });
          }
          return Promise.resolve(defaultPage);
        }),
        findMany: jest.fn().mockResolvedValue([defaultPage]),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn()
      },
      systemConfig: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn()
    };
    const clinics = {
      findActive: jest.fn().mockResolvedValue([{ id: 'clinic_1', name: '门店 A', address: '地址', phone: '电话' }])
    };
    const env = {
      get: jest.fn((key: string) => {
        if (key === 'MINI_SUBSCRIBE_TEMPLATE_APPOINTMENT_SUCCESS') return 'mini-template';
        if (key === 'SERVER_BASE_URL') return 'https://api.example.com';
        return undefined;
      })
    };
    return { service: new ConfigsService(prisma as any, clinics as any, env as any), prisma };
  }

  it('returns the default landing page with clinics, metadata and template ids', async () => {
    const { service } = createService();
    const result = await service.getLandingPage();

    expect(result.pageKey).toBe('default');
    expect(result.brandName).toBe('测试品牌');
    expect(result.activityPrice).toBe('后台价');
    expect(result.miniSubscribeTemplateId).toBe('mini-template');
    expect(result.clinics[0].name).toBe('门店 A');
  });

  it('loads an independent page and sanitizes its HTML', async () => {
    const { service } = createService();
    const result = await service.getLandingPage('page-two');

    expect(result.pageKey).toBe('page-two');
    expect(result.brandName).toBe('第二品牌');
    expect(result.brandHtml).toContain('<strong>第二页</strong>');
    expect(result.brandHtml).not.toContain('script');
    expect(result.brandHtml).not.toContain('onclick');
  });

  it('returns permanent links for every managed page', async () => {
    const { service } = createService();
    const result = await service.listLandingPages();

    expect(result[0].links.h5).toBe('https://api.example.com/landing/default');
    expect(result[0].links.miniProgramPath).toBe('pages/landing/landing?page=default');
    expect(result[0].links.officialAccount).toContain('page=default');
  });
});
