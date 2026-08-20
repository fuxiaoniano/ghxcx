import { ConfigsService } from '../src/modules/configs/configs.service';

describe('ConfigsService', () => {
  it('returns landing page config with clinics and template ids', async () => {
    const prisma = {
      systemConfig: {
        findUnique: jest.fn().mockResolvedValue({
          valueJson: { brandName: '测试品牌', activityPrice: '后台价' }
        })
      }
    };
    const clinics = {
      findActive: jest.fn().mockResolvedValue([{ id: 'clinic_1', name: '门店 A', address: '地址', phone: '电话' }])
    };
    const env = {
      get: jest.fn((key: string) =>
        key === 'MINI_SUBSCRIBE_TEMPLATE_APPOINTMENT_SUCCESS' ? 'mini-template' : undefined
      )
    };
    const service = new ConfigsService(prisma as any, clinics as any, env as any);

    const result = await service.getLandingPage();

    expect(result.brandName).toBe('测试品牌');
    expect(result.activityPrice).toBe('后台价');
    expect(result.miniSubscribeTemplateId).toBe('mini-template');
    expect(result.clinics[0].name).toBe('门店 A');
  });
});
