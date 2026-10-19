import { OperationsService } from '../src/modules/operations/operations.service';

describe('promotion summaries with multiple account numbers', () => {
  const account = (id: string, project = '重庆') => ({ id, name: '腾讯01', project, platform: '腾讯营销', accountNo: id, status: 'ACTIVE' });
  const metric = (id: string, date: string, spend: number, project = '重庆') => ({
    accountId: id, account: account(id, project), statDate: new Date(`${date}T00:00:00Z`),
    spend, impressions: 100, clicks: 10, leads: 2, validLeads: 1,
    appointments: 0, transactions: 0, revenue: 0,
  });
  const rows = [
    metric('a1', '2026-09-28', 100), metric('a2', '2026-09-28', 200),
    metric('a1', '2026-09-21', 50), metric('a2', '2026-09-21', 75),
    metric('a3', '2026-09-28', 300, '绵阳'),
  ];
  const prisma = { promotionDailyMetric: { findMany: jest.fn().mockResolvedValue(rows) } };
  const service = new OperationsService(prisma as never, {} as never, {} as never, {} as never);

  it('sums names within a project/channel, keeps projects separate and compares the prior week', async () => {
    const result = await service.summary({ dateFrom: '2026-09-28', dateTo: '2026-10-04' }, 'week');
    expect(result).toHaveLength(2);
    const chongqing = result.find((row) => row.account.project === '重庆')!;
    expect(chongqing).toMatchObject({ spend: 300, leads: 4, days: 1, previous: { spend: 125, leads: 4, days: 1 } });
    expect(result.find((row) => row.account.project === '绵阳')).toMatchObject({ spend: 300, leads: 2, days: 1 });
  });

  it('combines matching names in the natural monthly summary', async () => {
    const result = await service.summary({ dateFrom: '2026-09-01', dateTo: '2026-09-30' }, 'month');
    expect(result).toHaveLength(2);
    expect(result.find((row) => row.account.project === '重庆')).toMatchObject({ spend: 425, leads: 8, days: 2 });
  });
});
