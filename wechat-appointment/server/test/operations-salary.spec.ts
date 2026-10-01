import { OperationsService } from '../src/modules/operations/operations.service';

describe('OperationsService promotion salary calculation', () => {
  it('calculates the monthly salary tier from each region metrics', async () => {
    const prisma = {
      promotionDailyMetric: {
        findMany: jest.fn().mockResolvedValue([
          { statDate: new Date('2025-08-01T00:00:00.000Z'), leads: 60, validLeads: 36, spend: 9000, account: { project: '重庆' } },
          { statDate: new Date('2025-08-01T00:00:00.000Z'), leads: 31, validLeads: 20, spend: 4650, account: { project: '绵阳' } },
        ]),
      },
      systemConfig: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new OperationsService(prisma as never, {} as never, {} as never, {} as never);

    const result = await service.salary('2025-08');

    expect(result.currentSalary).toBe(8000);
    expect(result.regions).toEqual(expect.arrayContaining([
      expect.objectContaining({ project: '重庆', averageDailyLeads: 1.94, validRate: 0.6, averageCost: 150 }),
      expect.objectContaining({ project: '绵阳', averageDailyLeads: 1, averageCost: 150 }),
    ]));
    expect(result.tiers.map((item) => item.achieved)).toEqual([true, false, false]);
  });

  it('uses saved editable salary rules', async () => {
    const prisma = {
      promotionDailyMetric: { findMany: jest.fn().mockResolvedValue([]) },
      systemConfig: { findUnique: jest.fn().mockResolvedValue({ valueJson: { baseSalary: 7000, recentDays: 5, tiers: [{ salary: 9000, chongqing: { minDailyLeads: 2, minValidRate: 0.6, maxAverageCost: 180 }, mianyang: { minDailyLeads: 1, minValidRate: 0.55, maxAverageCost: 190 } }] } }) },
    };
    const service = new OperationsService(prisma as never, {} as never, {} as never, {} as never);

    const result = await service.salary('2025-08');

    expect(result.currentSalary).toBe(7000);
    expect(result.config).toMatchObject({ baseSalary: 7000, recentDays: 5 });
    expect(result.config.tiers[0].chongqing).toMatchObject({ minDailyLeads: 2, minValidRate: 0.6, maxAverageCost: 180 });
  });
});
