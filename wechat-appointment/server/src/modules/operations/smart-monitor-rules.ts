export type CostEvidence = {
  targetCpa: number | null;
  actualCpa: number | null;
  costRatio: number | null;
  targetSource: string | null;
  targetUnit: 'CNY' | null;
  targetStatus: 'MAPPED_FROM_FIELD' | 'SOURCE_UNCONFIRMED' | 'NOT_APPLICABLE';
};

type AdgroupBid = Record<string, unknown>;

function moneyFromCents(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const cents = Number(value);
  return Number.isFinite(cents) && cents > 0 ? Number((cents / 100).toFixed(2)) : null;
}

/** A CPC/CPM bid is not a CPA target. Ambiguous platform modes remain unknown. */
export function resolveAdgroupTargetCpa(adgroup: AdgroupBid): Pick<CostEvidence, 'targetCpa' | 'targetSource' | 'targetUnit' | 'targetStatus'> {
  const bidMode = String(adgroup.bid_mode || '').toUpperCase();
  const goal = String(adgroup.optimization_goal || '').toUpperCase();
  const deepBid = moneyFromCents(adgroup.deep_conversion_behavior_bid);
  if (deepBid !== null && goal.includes('DEEP')) return { targetCpa: deepBid, targetSource: 'deep_conversion_behavior_bid', targetUnit: 'CNY', targetStatus: 'MAPPED_FROM_FIELD' };
  const bid = moneyFromCents(adgroup.bid_amount);
  if (bid === null) return { targetCpa: null, targetSource: null, targetUnit: null, targetStatus: 'SOURCE_UNCONFIRMED' };
  if (bidMode.includes('OCPA') || bidMode.includes('OCPC') || bidMode.includes('OCPM') || bidMode.endsWith('_CPA')) {
    return { targetCpa: bid, targetSource: 'bid_amount', targetUnit: 'CNY', targetStatus: 'MAPPED_FROM_FIELD' };
  }
  if (bidMode.includes('CPC') || bidMode.includes('CPM')) return { targetCpa: null, targetSource: 'bid_amount', targetUnit: 'CNY', targetStatus: 'NOT_APPLICABLE' };
  return { targetCpa: null, targetSource: 'bid_amount', targetUnit: 'CNY', targetStatus: 'SOURCE_UNCONFIRMED' };
}

export function actualCpa(spendYuan: number, conversions: number): number | null {
  return Number.isFinite(spendYuan) && Number.isFinite(conversions) && spendYuan >= 0 && conversions > 0
    ? Number((spendYuan / conversions).toFixed(2)) : null;
}

export type MonitorThresholds = {
  spendThreshold: number;
  emptySpendThreshold: number;
  cpaThreshold: number;
  maxReportAgeMinutes: number;
};

/** Thresholds are absolute Yuan amounts; zero conversions never invents a CPA. */
export function assessMonitorThresholds(input: MonitorThresholds & {
  spend: number; conversions: number; targetCpa: number | null; reportAgeMinutes: number;
}): { state: 'INSUFFICIENT' | 'NORMAL' | 'WARNING'; evidence: string; ratio: number | null } {
  const actual = actualCpa(input.spend, input.conversions);
  const ratio = actual !== null && input.targetCpa !== null && input.targetCpa > 0
    ? Number((actual / input.targetCpa).toFixed(4)) : null;
  if (input.reportAgeMinutes > input.maxReportAgeMinutes)
    return { state: 'INSUFFICIENT', evidence: `报表延迟 ${Math.round(input.reportAgeMinutes)} 分钟，超过保护阈值`, ratio };
  if (!Number.isFinite(input.spend) || !Number.isFinite(input.conversions) || input.spend < 0 || input.conversions < 0)
    return { state: 'INSUFFICIENT', evidence: '消费或转化数据缺失，暂不能判断', ratio: null };
  const issues: string[] = [];
  if (input.conversions === 0 && input.emptySpendThreshold > 0 && input.spend >= input.emptySpendThreshold)
    issues.push(`空耗：消费 ¥${input.spend.toFixed(2)}、零转化，达到空耗阈值 ¥${input.emptySpendThreshold.toFixed(2)}`);
  if (input.spendThreshold > 0 && input.spend >= input.spendThreshold)
    issues.push(`消费 ¥${input.spend.toFixed(2)} 达到阈值 ¥${input.spendThreshold.toFixed(2)}`);
  if (actual !== null && input.cpaThreshold > 0 && actual >= input.cpaThreshold)
    issues.push(`实际转化成本 ¥${actual.toFixed(2)} 达到阈值 ¥${input.cpaThreshold.toFixed(2)}`);
  return issues.length
    ? { state: 'WARNING', evidence: issues.join('；'), ratio }
    : { state: 'NORMAL', evidence: `消费 ¥${input.spend.toFixed(2)}；${actual === null ? '零转化，暂无实际转化成本' : `实际转化成本 ¥${actual.toFixed(2)}`}，未达到异常阈值`, ratio };
}

export function assessCost(input: {
  spend: number; conversions: number; targetCpa: number | null; reportAgeMinutes: number;
  minSpend: number; minConversions: number; maxReportAgeMinutes: number; ratioThreshold: number;
}): { state: 'INSUFFICIENT' | 'NORMAL' | 'WARNING'; evidence: string; ratio: number | null } {
  const actual = actualCpa(input.spend, input.conversions);
  if (input.targetCpa === null || input.targetCpa <= 0) return { state: 'INSUFFICIENT', evidence: '当前营销单元目标成本缺失或来源待核实', ratio: null };
  if (input.reportAgeMinutes > input.maxReportAgeMinutes) return { state: 'INSUFFICIENT', evidence: `报表延迟 ${Math.round(input.reportAgeMinutes)} 分钟，超过保护阈值`, ratio: null };
  if (input.spend < input.minSpend || input.conversions < input.minConversions || actual === null) {
    return { state: 'INSUFFICIENT', evidence: `样本不足：消费 ¥${input.spend.toFixed(2)}（最低 ¥${input.minSpend.toFixed(2)}） / ${input.conversions} 次转化（最低 ${input.minConversions} 次）`, ratio: null };
  }
  const ratio = Number((actual / input.targetCpa).toFixed(4));
  return {
    state: ratio > input.ratioThreshold ? 'WARNING' : 'NORMAL', ratio,
    evidence: `实际成本 ¥${actual.toFixed(2)} / 目标成本 ¥${input.targetCpa.toFixed(2)} = ${(ratio * 100).toFixed(1)}%；阈值 ${(input.ratioThreshold * 100).toFixed(0)}%`,
  };
}
