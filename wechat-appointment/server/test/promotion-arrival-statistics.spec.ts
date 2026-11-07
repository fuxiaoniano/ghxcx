import { OperationsService } from '../src/modules/operations/operations.service';

describe('患者收费统计合并', () => {
  const account = { id: 'account-1', name: '腾讯01', accountNo: '10001', project: '重庆', platform: '腾讯营销' };

  function service(metrics: any[], patients: any[]) {
    const prisma = {
      promotionDailyMetric: { findMany: jest.fn().mockResolvedValue(metrics) },
      promotionArrivalPatient: { findMany: jest.fn().mockImplementation((args: any) => args?.select ? Promise.resolve([...patients].sort((a, b) => a.arrivalDate.getTime() - b.arrivalDate.getTime()).map(({ id, phoneHash }) => ({ id, phoneHash }))) : Promise.resolve(patients)) },
    };
    return { prisma, instance: new OperationsService(prisma as any, {} as any, {} as any, {} as any) };
  }

  it('在已有日报上叠加到院、成交、成交金额和实收', async () => {
    const date = new Date('2026-11-06T00:00:00.000Z');
    const { instance } = service([
      { id: 'metric-1', accountId: account.id, statDate: date, spend: 100, impressions: 10, clicks: 2, leads: 2, validLeads: 1, appointments: 0, transactions: 0, revenue: 0, customMetrics: null, isArchived: false, account },
    ], [
      { id: 'patient-1', phoneHash: 'hash-1', accountId: account.id, arrivalDate: date, transactionAmount: 800, receivedAmount: 500, createdAt: date, updatedAt: date, account },
      { id: 'patient-2', phoneHash: 'hash-2', accountId: account.id, arrivalDate: date, transactionAmount: 0, receivedAmount: 0, createdAt: date, updatedAt: date, account },
    ]);

    const rows = await instance.daily({ dateFrom: '2026-11-06', dateTo: '2026-11-06' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ appointments: 2, transactions: 1, transactionAmount: 800, revenue: 500, patientArrivalCount: 2, patientOnly: false });
    expect(rows[0].calculated.arrivalRate).toBe(1);
  });

  it('没有日报时仍生成可统计且不可伪装成日报的患者来源行', async () => {
    const date = new Date('2026-11-07T00:00:00.000Z');
    const { instance } = service([], [
      { id: 'patient-1', phoneHash: 'hash-1', accountId: account.id, arrivalDate: date, transactionAmount: 1200, receivedAmount: 900, createdAt: date, updatedAt: date, account },
    ]);
    const rows = await instance.daily({ dateFrom: '2026-11-07', dateTo: '2026-11-07' });
    expect(rows[0]).toMatchObject({ syncSource: 'ARRIVAL_PATIENTS', patientOnly: true, appointments: 1, transactions: 1, transactionAmount: 1200, revenue: 900 });
  });

  it('同一手机号只在最早收费记录统计一次人数，后续金额仍全部累计', async () => {
    const firstDate = new Date('2026-11-06T00:00:00.000Z');
    const secondDate = new Date('2026-11-07T00:00:00.000Z');
    const { instance } = service([], [
      { id: 'patient-first', phoneHash: 'same-phone', accountId: account.id, arrivalDate: firstDate, transactionAmount: 0, receivedAmount: 300, createdAt: firstDate, updatedAt: firstDate, account },
      { id: 'patient-second', phoneHash: 'same-phone', accountId: account.id, arrivalDate: secondDate, transactionAmount: 1000, receivedAmount: 600, createdAt: secondDate, updatedAt: secondDate, account },
    ]);
    const rows = await instance.daily({ dateFrom: '2026-11-06', dateTo: '2026-11-07' });
    expect(rows.find((row) => row.statDate === '2026-11-06')).toMatchObject({ appointments: 1, transactions: 1, transactionAmount: 0, revenue: 300 });
    expect(rows.find((row) => row.statDate === '2026-11-07')).toMatchObject({ appointments: 0, transactions: 0, transactionAmount: 1000, revenue: 600 });
  });
});
