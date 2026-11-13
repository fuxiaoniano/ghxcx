import { OperationsService } from '../src/modules/operations/operations.service';

describe('患者收费统计合并', () => {
  const account = { id: 'account-1', name: '腾讯01', accountNo: '10001', project: '重庆', platform: '腾讯营销' };

  function service(metrics: any[], patients: any[]) {
    const prisma = {
      promotionDailyMetric: { findMany: jest.fn().mockResolvedValue(metrics) },
      promotionArrivalPatient: { findMany: jest.fn().mockResolvedValue(patients) },
    };
    return { prisma, instance: new OperationsService(prisma as any, {} as any, {} as any, {} as any) };
  }

  it('已有日报保留人工人数，成交金额和实收只取患者收费', async () => {
    const date = new Date('2026-11-06T00:00:00.000Z');
    const { instance } = service([
      { id: 'metric-1', accountId: account.id, statDate: date, spend: 100, impressions: 10, clicks: 2, leads: 2, validLeads: 1, appointments: 4, transactions: 2, revenue: 100, customMetrics: null, isArchived: false, account },
    ], [
      { id: 'patient-1', phoneHash: 'hash-1', accountId: account.id, arrivalDate: date, transactionAmount: 800, receivedAmount: 500, createdAt: date, updatedAt: date, account },
      { id: 'patient-2', phoneHash: 'hash-2', accountId: account.id, arrivalDate: date, transactionAmount: 0, receivedAmount: 0, createdAt: date, updatedAt: date, account },
    ]);

    const rows = await instance.daily({ dateFrom: '2026-11-06', dateTo: '2026-11-06' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ appointments: 4, transactions: 2, transactionAmount: 800, revenue: 500, patientOnly: false });
    expect(rows[0].calculated.arrivalRate).toBe(2);
    expect((instance as any).prisma.promotionArrivalPatient.findMany).toHaveBeenCalledTimes(1);
  });

  it('没有患者收费明细时不再统计历史日统计的手填实收', async () => {
    const date = new Date('2026-11-08T00:00:00.000Z');
    const { instance } = service([
      { id: 'metric-legacy', accountId: account.id, statDate: date, spend: 100, impressions: 10, clicks: 2, leads: 2, validLeads: 1, appointments: 1, transactions: 1, revenue: 700, customMetrics: null, isArchived: false, account },
    ], []);
    const rows = await instance.daily({ dateFrom: '2026-11-08', dateTo: '2026-11-08' });
    expect(rows[0]).toMatchObject({ appointments: 1, transactions: 1, transactionAmount: 0, revenue: 0, patientOnly: false });
  });

  it('日统计写入忽略旧客户端提交的实收金额', () => {
    const { instance } = service([], []);
    const data = (instance as any).metricData({
      accountId: account.id, statDate: '2026-11-08', spend: 100, impressions: 10, clicks: 2,
      leads: 2, validLeads: 1, appointments: 1, transactions: 1, revenue: 999, customMetrics: {},
    });
    expect(data.revenue).toBe(0);
  });

  it('没有日报时只生成金额行，不根据收费明细伪造到院和成交人数', async () => {
    const date = new Date('2026-11-07T00:00:00.000Z');
    const { instance } = service([], [
      { id: 'patient-1', phoneHash: 'hash-1', accountId: account.id, arrivalDate: date, transactionAmount: 1200, receivedAmount: 900, createdAt: date, updatedAt: date, account },
    ]);
    const rows = await instance.daily({ dateFrom: '2026-11-07', dateTo: '2026-11-07' });
    expect(rows[0]).toMatchObject({ syncSource: 'ARRIVAL_PATIENTS', patientOnly: true, appointments: 0, transactions: 0, transactionAmount: 1200, revenue: 900 });
  });

  it('同一手机号的全部金额继续累计，但任何收费记录都不参与人数统计', async () => {
    const firstDate = new Date('2026-11-06T00:00:00.000Z');
    const secondDate = new Date('2026-11-07T00:00:00.000Z');
    const { instance } = service([], [
      { id: 'patient-first', phoneHash: 'same-phone', accountId: account.id, arrivalDate: firstDate, transactionAmount: 0, receivedAmount: 300, createdAt: firstDate, updatedAt: firstDate, account },
      { id: 'patient-second', phoneHash: 'same-phone', accountId: account.id, arrivalDate: secondDate, transactionAmount: 1000, receivedAmount: 600, createdAt: secondDate, updatedAt: secondDate, account },
    ]);
    const rows = await instance.daily({ dateFrom: '2026-11-06', dateTo: '2026-11-07' });
    expect(rows.find((row) => row.statDate === '2026-11-06')).toMatchObject({ appointments: 0, transactions: 0, transactionAmount: 0, revenue: 300 });
    expect(rows.find((row) => row.statDate === '2026-11-07')).toMatchObject({ appointments: 0, transactions: 0, transactionAmount: 1000, revenue: 600 });
  });
});
