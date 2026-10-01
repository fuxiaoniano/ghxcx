import { OperationsService } from '../src/modules/operations/operations.service';

describe('OperationsService report account diagnosis', () => {
  const service = new OperationsService({} as never, {} as never, {} as never, {} as never) as any;

  it('marks an account normal when valid rate is above 50% and form cost is not above 210', () => {
    const totals = { conversions: 10, invalidRate: 0.4, conversionCost: 210 };
    expect(service.autoProblem(totals)).toBe('账户正常');
    expect(service.autoAdjustment(totals)).toBe('保持当前投放策略，持续观察账户表现');
  });

  it('marks form cost high when valid rate is above 50% but form cost is above 210', () => {
    const totals = { conversions: 10, invalidRate: 0.4, conversionCost: 210.01 };
    expect(service.autoProblem(totals)).toBe('表单成本过高');
    expect(service.autoAdjustment(totals)).toContain('降低表单成本');
  });

  it('reports both problems when valid rate is not above 50% and form cost is high', () => {
    const totals = { conversions: 10, invalidRate: 0.5, conversionCost: 260 };
    expect(service.autoProblem(totals)).toBe('有效率偏低且表单成本过高');
    expect(service.autoAdjustment(totals)).toContain('优化线索质量');
  });

  it('calculates account daily conversions from distinct recorded dates', () => {
    const rows = [
      { accountId: 'a1', accountName: '账户1', accountNo: '1001', statDate: '2026-09-01', conversions: 4, spend: 100, invalid: 1 },
      { accountId: 'a1', accountName: '账户1', accountNo: '1001', statDate: '2026-09-03', conversions: 6, spend: 200, invalid: 2 },
    ];
    expect(service.mergeReportAccounts(rows)[0]).toMatchObject({ conversions: 10, recordedDays: 2, averageDailyConversions: 5 });
  });

  it('calculates channel and project daily conversions without counting the same date twice', () => {
    const rows = [
      { statDate: '2026-09-01', conversions: 4, spend: 100, invalid: 1 },
      { statDate: '2026-09-01', conversions: 2, spend: 50, invalid: 0 },
      { statDate: '2026-09-03', conversions: 6, spend: 200, invalid: 2 },
    ];
    expect(service.reportTotals(rows)).toMatchObject({ conversions: 12, recordedDays: 2, averageDailyConversions: 6 });
  });
});
