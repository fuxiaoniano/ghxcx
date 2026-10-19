export type PromotionMaterialType = 'VIDEO' | 'IMAGE' | 'COPY' | 'LANDING_PAGE' | 'BRAND' | 'ACTION_BUTTON' | 'MINI_CARD_LINK' | 'TEXT_LINK' | 'FLOATING_ZONE' | 'LABEL' | 'SOCIAL_SKILL';

export type PromotionMaterialMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
};

export type PromotionMaterialInput = {
  id: string;
  type: PromotionMaterialType;
  name: string;
  status?: string | null;
  previewUrl?: string | null;
  metrics?: PromotionMaterialMetrics | null;
  attributionNote?: string;
  officialLowEfficiency?: boolean;
};

export type PromotionMaterialHealth = 'HEALTHY' | 'ATTENTION' | 'RISK' | 'UNASSESSED';

export function diagnosePromotionMaterial(item: PromotionMaterialInput) {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const metrics = item.metrics;

  if (item.officialLowEfficiency) {
    issues.push('平台已将该视频标记为低效素材');
    recommendations.push('优先替换开头画面、核心卖点和行动引导，并保留原素材作为对照组。');
  }
  if (/reject|audit_reject|invalid|delete|offline|disabled/i.test(item.status || '')) {
    issues.push('素材当前状态不可正常投放');
    recommendations.push('检查审核原因、素材合规性和投放状态，修复后再恢复投放。');
  }

  if (metrics) {
    const ctr = metrics.impressions > 0 ? metrics.clicks / metrics.impressions : null;
    const conversionRate = metrics.clicks > 0 ? metrics.conversions / metrics.clicks : null;
    const costPerConversion = metrics.conversions > 0 ? metrics.spend / metrics.conversions : null;
    if (metrics.impressions === 0) {
      issues.push('分析周期内没有曝光');
      recommendations.push('检查素材审核、计划状态、定向和预算，确认素材已进入有效投放。');
    } else if (metrics.impressions >= 1000 && (ctr ?? 0) < 0.005) {
      issues.push('点击率低于 0.50%');
      recommendations.push('优化首屏视觉、标题与利益点，制作差异化版本进行对照测试。');
    }
    if (metrics.clicks >= 20 && metrics.conversions === 0) {
      issues.push('已有点击但没有转化');
      recommendations.push('重点检查落地页加载、表单链路、转化组件和监测回传是否正常。');
    } else if (costPerConversion !== null && costPerConversion > 210) {
      issues.push(`单次转化成本为 ¥${costPerConversion.toFixed(2)}，高于当前运营基线`);
      recommendations.push('降低该素材预算或出价，并将流量转向转化成本更低的素材。');
    }
    const health: PromotionMaterialHealth = issues.some((issue) => issue.includes('没有转化') || issue.includes('不可正常') || issue.includes('低效'))
      ? 'RISK'
      : issues.length ? 'ATTENTION' : 'HEALTHY';
    return { health, issues, recommendation: recommendations.join(' ') || '当前指标未发现明显异常，建议继续观察并保留素材轮换。', calculated: { ctr, conversionRate, costPerConversion } };
  }

  const health: PromotionMaterialHealth = issues.length ? 'RISK' : 'UNASSESSED';
  return {
    health,
    issues: issues.length ? issues : ['平台未返回该类型的独立效果归因数据'],
    recommendation: recommendations.join(' ') || '已完成配置与状态检查；建议结合广告层级报表人工核对实际效果。',
    calculated: { ctr: null, conversionRate: null, costPerConversion: null },
  };
}
