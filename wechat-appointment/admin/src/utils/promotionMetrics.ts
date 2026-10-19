import type { PromotionAccountItem, PromotionDailyMetricItem, PromotionMetricFieldItem } from '../api/admin';

export type PromotionAggregateRow = PromotionDailyMetricItem & { details: PromotionDailyMetricItem[] };

export function promotionAccountKey(account: Pick<PromotionAccountItem, 'project' | 'platform' | 'name'>) {
  return JSON.stringify([account.project, account.platform, account.name]);
}

export function aggregatePromotionRows(
  source: PromotionDailyMetricItem[],
  fields: PromotionMetricFieldItem[],
  periodLabel?: string,
): PromotionAggregateRow[] {
  const groups = new Map<string, PromotionAggregateRow>();
  const numericCustomKeys = new Set(fields.filter((field) => field.source === 'CUSTOM' && field.dataType === 'NUMBER').map((field) => field.key));
  for (const row of source) {
    const key = JSON.stringify([periodLabel || row.statDate, promotionAccountKey(row.account)]);
    const current = groups.get(key) || {
      ...row,
      id: `summary-${key}`,
      statDate: periodLabel || row.statDate,
      spend: 0, impressions: 0, clicks: 0, leads: 0, validLeads: 0,
      appointments: 0, transactions: 0, revenue: 0, customMetrics: {}, details: [],
      calculated: { clickRate: null, validRate: null, averageCost: null, validCost: null, conversionRate: null, arrivalRate: null, validArrivalRate: null, arrivalCost: null, roi: null },
    };
    current.details.push(row);
    current.spend += Number(row.spend || 0);
    current.impressions += Number(row.impressions || 0);
    current.clicks += Number(row.clicks || 0);
    current.leads += Number(row.leads || 0);
    current.validLeads += Number(row.validLeads || 0);
    current.appointments += Number(row.appointments || 0);
    current.transactions += Number(row.transactions || 0);
    current.revenue += Number(row.revenue || 0);
    for (const [fieldKey, raw] of Object.entries(row.customMetrics || {})) {
      if (numericCustomKeys.has(fieldKey)) current.customMetrics[fieldKey] = Number(current.customMetrics[fieldKey] || 0) + Number(raw || 0);
      else if (raw !== '' && raw !== null && raw !== undefined) {
        const values = new Set(String(current.customMetrics[fieldKey] || '').split('、').filter(Boolean));
        values.add(String(raw));
        current.customMetrics[fieldKey] = [...values].join('、');
      }
    }
    groups.set(key, current);
  }
  return [...groups.values()].map((row) => {
    row.id = row.details.length === 1 ? row.details[0].id : row.id;
    row.isArchived = row.details.every((detail) => detail.isArchived);
    row.spend = Number(row.spend.toFixed(2));
    row.revenue = Number(row.revenue.toFixed(2));
    row.calculated = {
      clickRate: row.impressions ? row.clicks / row.impressions : null,
      validRate: row.leads ? row.validLeads / row.leads : null,
      averageCost: row.leads ? row.spend / row.leads : null,
      validCost: row.validLeads ? row.spend / row.validLeads : null,
      conversionRate: row.appointments ? row.transactions / row.appointments : null,
      arrivalRate: row.leads ? row.appointments / row.leads : null,
      validArrivalRate: row.validLeads ? row.appointments / row.validLeads : null,
      arrivalCost: row.appointments ? row.spend / row.appointments : null,
      roi: row.spend ? row.revenue / row.spend : null,
    };
    return row;
  });
}
