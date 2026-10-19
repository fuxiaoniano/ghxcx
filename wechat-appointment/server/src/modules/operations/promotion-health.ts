export type PromotionHealthMetricRow = {
  spend: unknown;
  impressions: number;
  clicks: number;
  leads: number;
  validLeads: number;
};

export type PromotionHealthTotals = {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  validLeads: number;
  clickRate: number | null;
  conversionRate: number | null;
  costPerLead: number | null;
  validRate: number | null;
  validCost: number | null;
};

export type PromotionHealthIssue = {
  key: string;
  level: 'RISK' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  recommendation: string;
};

export function aggregatePromotionHealth(rows: PromotionHealthMetricRow[]): PromotionHealthTotals {
  const totals = rows.reduce<Pick<PromotionHealthTotals, 'spend' | 'impressions' | 'clicks' | 'leads' | 'validLeads'>>((value, row) => ({
    spend: value.spend + Number(row.spend || 0),
    impressions: value.impressions + Number(row.impressions || 0),
    clicks: value.clicks + Number(row.clicks || 0),
    leads: value.leads + Number(row.leads || 0),
    validLeads: value.validLeads + Number(row.validLeads || 0),
  }), { spend: 0, impressions: 0, clicks: 0, leads: 0, validLeads: 0 });
  const money = (value: number) => Number(value.toFixed(2));
  return {
    ...totals,
    spend: money(totals.spend),
    clickRate: totals.impressions ? totals.clicks / totals.impressions : null,
    conversionRate: totals.clicks ? totals.leads / totals.clicks : null,
    costPerLead: totals.leads ? money(totals.spend / totals.leads) : null,
    validRate: totals.leads ? totals.validLeads / totals.leads : null,
    validCost: totals.validLeads ? money(totals.spend / totals.validLeads) : null,
  };
}

function decline(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous <= 0) return null;
  return (current - previous) / previous;
}

export function diagnosePromotionHealth(current: PromotionHealthTotals, previous: PromotionHealthTotals, recordedDays: number) {
  const issues: PromotionHealthIssue[] = [];
  if (!recordedDays || (!current.spend && !current.impressions && !current.clicks)) {
    return {
      status: 'INSUFFICIENT' as const,
      score: null,
      issues: [{
        key: 'NO_DATA', level: 'INFO' as const, title: '暂无可分析数据',
        description: '所选周期内没有同步到曝光、点击或消费数据，无法判断广告健康状态。',
        recommendation: '先检查平台授权、账户户号和同步设置，再同步所选周期数据。',
      }],
    };
  }

  if (current.impressions === 0) issues.push({ key: 'NO_IMPRESSIONS', level: 'RISK', title: '账户没有曝光', description: '所选周期有账户记录但曝光次数为 0，投放可能未生效或数据尚未回传。', recommendation: '检查账户、项目和广告启停状态、审核状态、余额、预算、排期与定向覆盖。' });
  else if (current.clicks === 0) issues.push({ key: 'NO_CLICKS', level: 'RISK', title: '有曝光但没有点击', description: `已产生 ${current.impressions} 次曝光但没有点击。`, recommendation: '优先检查素材首屏、标题卖点、落地页承接与定向人群，补充差异化素材进行测试。' });

  const ctrTrend = decline(current.clickRate, previous.clickRate);
  if (ctrTrend !== null && ctrTrend <= -0.2) issues.push({ key: 'CTR_DECLINE', level: ctrTrend <= -0.4 ? 'RISK' : 'WARNING', title: '点击率明显下降', description: `点击率较上一等长周期下降 ${Math.abs(ctrTrend * 100).toFixed(1)}%。`, recommendation: '按素材、版位和人群拆分排查，暂停持续衰退素材，并补充新素材测试；同时避免一次修改过多变量。' });

  if (current.clicks >= 20 && current.leads === 0) issues.push({ key: 'NO_CONVERSIONS', level: 'RISK', title: '点击后没有转化', description: `已有 ${current.clicks} 次点击但目标转化量为 0。`, recommendation: '核对转化事件和回传链路，检查落地页加载、表单可用性与广告承诺一致性，再排查流量意图。' });
  const conversionTrend = decline(current.conversionRate, previous.conversionRate);
  if (conversionTrend !== null && conversionTrend <= -0.2) issues.push({ key: 'CVR_DECLINE', level: conversionTrend <= -0.4 ? 'RISK' : 'WARNING', title: '转化率下降', description: `点击转化率较上一等长周期下降 ${Math.abs(conversionTrend * 100).toFixed(1)}%。`, recommendation: '检查落地页速度、表单路径、投放人群与搜索词/素材承诺，优先保留高意向流量。' });

  if (current.costPerLead !== null && current.costPerLead > 210) issues.push({ key: 'HIGH_CPA', level: current.costPerLead > 315 ? 'RISK' : 'WARNING', title: '表单成本偏高', description: `当前表单成本为 ¥${current.costPerLead.toFixed(2)}，高于内部运营基线 ¥210。`, recommendation: '降低低转化人群和素材消耗，把预算向高转化组合倾斜；调整后至少观察一个完整转化周期。' });
  const costTrend = decline(current.costPerLead, previous.costPerLead);
  if (costTrend !== null && costTrend >= 0.2) issues.push({ key: 'CPA_RISE', level: costTrend >= 0.4 ? 'RISK' : 'WARNING', title: '表单成本上涨', description: `表单成本较上一等长周期上涨 ${(costTrend * 100).toFixed(1)}%。`, recommendation: '比较两周期的点击率和转化率，先定位是获客流量变贵还是落地页转化变差，再针对性调整。' });

  if (current.validRate !== null && current.validRate < 0.5) issues.push({ key: 'LOW_VALID_RATE', level: current.validRate < 0.3 ? 'RISK' : 'WARNING', title: '有效率偏低', description: `当前有效线索率为 ${(current.validRate * 100).toFixed(1)}%，低于内部运营基线 50%。`, recommendation: '核对有效线索回传口径，收紧低质量人群与版位，并在素材和表单中明确地域、项目及服务条件。' });

  if (!issues.length) issues.push({ key: 'HEALTHY', level: 'INFO', title: '账户运行平稳', description: '核心漏斗指标未触发异常规则。', recommendation: '保持当前策略，继续观察素材疲劳、转化回传和成本趋势，避免频繁大幅调整。' });
  const deduction = issues.reduce((total, issue) => total + (issue.level === 'RISK' ? 25 : issue.level === 'WARNING' ? 12 : 0), 0);
  const score = Math.max(0, 100 - deduction);
  return { status: score >= 80 ? 'HEALTHY' as const : score >= 60 ? 'ATTENTION' as const : 'RISK' as const, score, issues };
}
