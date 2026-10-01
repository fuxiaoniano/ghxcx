import { PromotionDataSyncService } from '../src/modules/operations/promotion-data-sync.service';

describe('PromotionDataSyncService zero-data handling', () => {
  const createService = (metrics: { spend: number; impressions: number; clicks: number; leads: number; validLeads?: number }) => {
    const prisma = {
      promotionDataSyncConfig: {
        findUnique: jest.fn().mockResolvedValue({ id: 'config_1', provider: 'TENCENT_ADS', enabled: true, reportUrl: 'https://api.e.qq.com/v3.0/daily_reports/get', accessTokenCipher: 'encrypted', extraConfig: {} }),
        update: jest.fn().mockResolvedValue({}),
      },
      promotionAccount: {
        findMany: jest.fn().mockResolvedValue([{ id: 'account_1', name: '腾讯01', accountNo: '10001', status: 'ACTIVE', platform: '腾讯营销' }]),
      },
      promotionDailyMetric: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const crypto = { decryptText: jest.fn().mockReturnValue('token') };
    const service = new PromotionDataSyncService(prisma as never, crypto as never) as any;
    service.fetchMetrics = jest.fn().mockResolvedValue(metrics);
    return { service, prisma };
  };

  it('does not create a Tencent daily metric when every synced value is zero', async () => {
    const { service, prisma } = createService({ spend: 0, impressions: 0, clicks: 0, leads: 0, validLeads: 0 });

    const [result] = await service.sync('2026-09-28', 'TENCENT_ADS');

    expect(result).toMatchObject({ synced: 0, noData: 1 });
    expect(prisma.promotionDailyMetric.upsert).not.toHaveBeenCalled();
  });

  it('keeps the existing Tencent write path when any synced value is non-zero', async () => {
    const { service, prisma } = createService({ spend: 0, impressions: 1, clicks: 0, leads: 0, validLeads: 0 });

    const [result] = await service.sync('2026-09-28', 'TENCENT_ADS');

    expect(result).toMatchObject({ synced: 1, noData: 0 });
    expect(prisma.promotionDailyMetric.upsert).toHaveBeenCalledTimes(1);
  });

  it('does not interpret an explicit empty permitted-account list as all accounts', async () => {
    const { service, prisma } = createService({ spend: 1, impressions: 1, clicks: 1, leads: 1 });

    const [result] = await service.sync('2026-09-28', 'TENCENT_ADS', []);

    expect(result).toMatchObject({ synced: 0, errors: ['当前数据范围内没有可同步的推广账户'] });
    expect(prisma.promotionAccount.findMany).not.toHaveBeenCalled();
    expect(prisma.promotionDailyMetric.upsert).not.toHaveBeenCalled();
  });
});
