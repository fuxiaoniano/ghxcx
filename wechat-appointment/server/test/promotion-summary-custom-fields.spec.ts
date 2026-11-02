import { OperationsService } from '../src/modules/operations/operations.service';

describe('推广周月统计自定义字段', () => {
  it('汇总私信咨询数，不累计旧的咨询留资率', () => {
    const service = Object.create(OperationsService.prototype) as any;
    const account = { id: 'a', name: '测试账户', project: '测试', platform: '腾讯营销', accountNo: null };
    const summary = service.newSummary('2026-11-02', 'week', account);
    service.addToSummary(summary, { statDate: new Date('2026-11-02'), spend: 0, impressions: 0, clicks: 0, leads: 2, validLeads: 0, appointments: 0, transactions: 0, revenue: 0, customMetrics: { dm: 4 } });
    service.addToSummary(summary, { statDate: new Date('2026-11-03'), spend: 0, impressions: 0, clicks: 0, leads: 1, validLeads: 0, appointments: 0, transactions: 0, revenue: 0, customMetrics: { dm: 2 } });
    expect(summary.leads).toBe(3);
    expect(summary.customMetrics.dm).toBe(6);
  });
});
