import { actualCpa, assessCost, assessMonitorThresholds, resolveAdgroupTargetCpa } from '../src/modules/operations/smart-monitor-rules';

describe('smart monitor cost semantics', () => {
  it('keeps a CPC bid separate from target CPA', () => {
    expect(resolveAdgroupTargetCpa({ bid_mode: 'BID_MODE_CPC', bid_amount: 12000 }).targetCpa).toBeNull();
  });
  it('converts an explicit oCPA bid from cents to yuan', () => {
    expect(resolveAdgroupTargetCpa({ bid_mode: 'BID_MODE_OCPA', bid_amount: 12000 })).toEqual({ targetCpa: 120, targetSource: 'bid_amount', targetUnit: 'CNY', targetStatus: 'MAPPED_FROM_FIELD' });
  });
  it('does not infer a target from ambiguous or zero values', () => {
    expect(resolveAdgroupTargetCpa({ bid_amount: 5000 }).targetCpa).toBeNull();
    expect(resolveAdgroupTargetCpa({ bid_mode: 'BID_MODE_OCPA', bid_amount: 0 }).targetCpa).toBeNull();
    expect(resolveAdgroupTargetCpa({ optimization_goal: 'OPTIMIZATION_GOAL_DEEP_CONVERSION', deep_conversion_behavior_bid: 6400 }).targetCpa).toBe(64);
  });
  it('does not produce actual CPA with zero conversions', () => {
    expect(actualCpa(100, 0)).toBeNull();
  });
  it('protects stale or insufficient reports from warning actions', () => {
    const input = { spend: 300, conversions: 3, targetCpa: 50, reportAgeMinutes: 10, minSpend: 100, minConversions: 2, maxReportAgeMinutes: 120, ratioThreshold: 1.3 };
    expect(assessCost(input).state).toBe('WARNING');
    expect(assessCost({ ...input, reportAgeMinutes: 180 }).state).toBe('INSUFFICIENT');
    expect(assessCost({ ...input, conversions: 0 }).state).toBe('INSUFFICIENT');
  });
  it('flags zero-conversion waste once the channel empty-spend threshold is met', () => {
    const input = { spend: 200, conversions: 0, targetCpa: null, reportAgeMinutes: 20,
      spendThreshold: 1000, emptySpendThreshold: 200, cpaThreshold: 300, maxReportAgeMinutes: 360 };
    expect(assessMonitorThresholds(input)).toMatchObject({ state: 'WARNING', ratio: null });
    expect(assessMonitorThresholds({ ...input, spend: 199 }).state).toBe('NORMAL');
  });
  it('checks absolute spend and actual CPA without a minimum conversion count or target CPA', () => {
    const input = { spend: 350, conversions: 1, targetCpa: null, reportAgeMinutes: 20,
      spendThreshold: 1000, emptySpendThreshold: 200, cpaThreshold: 300, maxReportAgeMinutes: 360 };
    expect(assessMonitorThresholds(input).evidence).toContain('实际转化成本 ¥350.00');
    expect(assessMonitorThresholds(input).state).toBe('WARNING');
    expect(assessMonitorThresholds({ ...input, conversions: 2 }).state).toBe('NORMAL');
    expect(assessMonitorThresholds({ ...input, spend: 1000, conversions: 10 }).evidence).toContain('消费 ¥1000.00 达到阈值');
    expect(assessMonitorThresholds({ ...input, reportAgeMinutes: 400 }).state).toBe('INSUFFICIENT');
  });
});
