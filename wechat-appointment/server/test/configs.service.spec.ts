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
        findMany: jest.fn().mockResolvedValue([{ ...defaultPage, _count: { appointments: 3 } }]),
        count: jest.fn().mockResolvedValue(2),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn().mockResolvedValue(defaultPage)
      },
      systemConfig: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation((operations: Array<Promise<unknown>>) => Promise.all(operations))
    };
    const clinics = {
      findActive: jest.fn().mockResolvedValue([{ id: 'clinic_1', name: '门店 A', address: '地址', phone: '电话' }])
    };
    const env = {
      get: jest.fn((key: string) => {
        if (key === 'MINI_SUBSCRIBE_TEMPLATE_APPOINTMENT_SUCCESS') return 'mini-template';
        if (key === 'MINI_APP_ID') return 'wx99b598314f56c2f1';
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

  it('returns backward-compatible official auto reply defaults with the mini-program entry disabled', async () => {
    const { service } = createService();

    const result = await service.getOfficialAutoReplyConfig();

    expect(result.subscribeReplyEnabled).toBe(true);
    expect(result.subscribeMiniProgramEnabled).toBe(false);
    expect(result.subscribeMiniProgramType).toBe('LINK');
    expect(result.subscribeMiniProgramAppId).toBe('wx99b598314f56c2f1');
    expect(result.subscribeMiniProgramPagePath).toBe('pages/home/home?source=oa_subscribe');
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
    expect(result[0].appointmentCount).toBe(3);
  });

  it('deletes a non-default page while reporting preserved appointments', async () => {
    const { service, prisma } = createService();
    prisma.landingPage.findUnique.mockResolvedValueOnce({
      ...defaultPage,
      id: 'page_2',
      pageKey: 'page-two',
      name: '第二页',
      isDefault: false,
      _count: { appointments: 4 }
    });

    const result = await service.deleteLandingPage('page_2');

    expect(prisma.landingPage.delete).toHaveBeenCalledWith({ where: { id: 'page_2' } });
    expect(prisma.landingPage.updateMany).not.toHaveBeenCalled();
    expect(result.preservedAppointmentCount).toBe(4);
    expect(result.newDefaultPage).toBeNull();
  });

  it('promotes another page before deleting the default page', async () => {
    const { service, prisma } = createService();
    prisma.landingPage.findUnique.mockResolvedValueOnce({
      ...defaultPage,
      _count: { appointments: 2 }
    });
    prisma.landingPage.findFirst.mockResolvedValueOnce({ id: 'page_2', name: '第二页' });

    const result = await service.deleteLandingPage(defaultPage.id);

    expect(prisma.landingPage.update).toHaveBeenCalledWith({
      where: { id: 'page_2' },
      data: { isDefault: true, status: ContentStatus.ACTIVE }
    });
    expect(prisma.landingPage.delete).toHaveBeenCalledWith({ where: { id: defaultPage.id } });
    expect(result.newDefaultPage).toEqual({ id: 'page_2', name: '第二页' });
  });

  it('does not delete the final landing page', async () => {
    const { service, prisma } = createService();
    prisma.landingPage.findUnique.mockResolvedValueOnce({
      ...defaultPage,
      _count: { appointments: 1 }
    });
    prisma.landingPage.count.mockResolvedValueOnce(1);

    await expect(service.deleteLandingPage(defaultPage.id)).rejects.toThrow('至少需要保留一个挂号落地页');
    expect(prisma.landingPage.delete).not.toHaveBeenCalled();
  });
});
