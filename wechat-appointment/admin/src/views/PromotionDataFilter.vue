<template>
  <div class="page-heading">
    <div>
      <h1 class="page-title">数据筛选</h1>
      <p>按日期、项目、渠道、账户名称和户号组合筛选推广数据，结果按同项目同渠道的账户名称汇总。</p>
    </div>
    <div class="filter-actions">
      <el-select v-model="selectedProjects" class="project-picker" multiple collapse-tags collapse-tags-tooltip clearable placeholder="全部项目">
        <el-option v-for="item in projectOptions" :key="item" :label="item" :value="item" />
      </el-select>
      <el-select v-model="selectedChannels" class="channel-picker" multiple collapse-tags collapse-tags-tooltip clearable filterable placeholder="全部渠道">
        <el-option v-for="item in channelOptions" :key="item" :label="item" :value="item" />
      </el-select>
      <el-select v-model="selectedAccounts" class="account-picker" multiple collapse-tags collapse-tags-tooltip clearable filterable placeholder="全部账户名称">
        <el-option v-for="item in accountOptions" :key="promotionAccountKey(item)" :label="item.name" :value="promotionAccountKey(item)">
          <span>{{ item.name }}</span><small>{{ item.project }} · {{ item.platform }}</small>
        </el-option>
      </el-select>
      <el-select v-model="selectedAccountNos" class="account-picker" multiple collapse-tags collapse-tags-tooltip clearable filterable placeholder="全部户号">
        <el-option v-for="item in accountNoOptions" :key="item" :label="item" :value="item" />
      </el-select>
      <el-date-picker v-model="dateRange" class="day-range-picker" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" />
      <PromotionDateShortcuts mode="day" :model-value="dateRange" @select="selectQuickRange" />
      <el-button type="primary" :loading="loading" @click="load">查询</el-button>
      <el-button @click="resetFilters">重置</el-button>
    </div>
  </div>

  <div class="content-panel">
    <div class="result-note">所选周期共 {{ aggregatedRows.length }} 个账户汇总</div>
    <p class="mobile-scroll-hint">左右滑动查看完整筛选结果</p>
    <el-table :data="aggregatedRows" v-loading="loading" border show-summary :summary-method="summary" class="filter-table">
      <el-table-column prop="statDate" label="时间周期" width="190" class-name="period-cell">
        <template #default="{ row }">
          <span class="period-value" :title="row.statDate">
            <span>{{ periodParts(row.statDate).start }}</span>
            <span v-if="periodParts(row.statDate).end">至 {{ periodParts(row.statDate).end }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="account.project" label="项目" width="90" />
      <el-table-column prop="account.platform" label="渠道" width="110" show-overflow-tooltip />
      <el-table-column label="账户" width="140" show-overflow-tooltip><template #default="{ row }">{{ row.account.name }}</template></el-table-column>
      <template v-for="item in orderedDisplayFields" :key="item.field.id"><el-table-column v-if="item.column" :key="item.field.id" :prop="item.column.direct ? item.column.key : undefined" :label="item.field.label" :width="item.column.width">
        <template #default="{ row }">{{ display(row, item.column!) }}</template>
      </el-table-column>
      <el-table-column v-else :key="item.field.id" :label="item.field.label" width="110" show-overflow-tooltip>
        <template #default="{ row }">{{ row.customMetrics?.[item.field.key] ?? '—' }}</template>
      </el-table-column></template>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { getPromotionFilterData, type PromotionAccountItem, type PromotionDailyMetricItem, type PromotionMetricFieldItem } from '../api/admin';
import PromotionDateShortcuts from '../components/PromotionDateShortcuts.vue';
import { aggregatePromotionRows, promotionAccountKey } from '../utils/promotionMetrics';

type Column = { key: string; label: string; type: 'integer' | 'number' | 'rate'; direct?: boolean; width: number };
const columns: Column[] = [
  { key: 'spend', label: '消费', type: 'number', direct: true, width: 100 },
  { key: 'impressions', label: '展现', type: 'integer', direct: true, width: 100 },
  { key: 'clicks', label: '点击', type: 'integer', direct: true, width: 85 },
  { key: 'clickRate', label: '点击率', type: 'rate', width: 90 },
  { key: 'leads', label: '总表单', type: 'integer', direct: true, width: 90 },
  { key: 'validLeads', label: '有效表单', type: 'integer', direct: true, width: 100 },
  { key: 'validRate', label: '有效率', type: 'rate', width: 90 },
  { key: 'averageCost', label: '平均成本', type: 'number', width: 100 },
  { key: 'validCost', label: '有效成本', type: 'number', width: 100 },
  { key: 'appointments', label: '到院', type: 'integer', direct: true, width: 80 },
  { key: 'transactions', label: '成交', type: 'integer', direct: true, width: 80 },
  { key: 'conversionRate', label: '成交率', type: 'rate', width: 90 },
  { key: 'arrivalRate', label: '到诊率', type: 'rate', width: 90 },
  { key: 'validArrivalRate', label: '有效到诊率', type: 'rate', width: 110 },
  { key: 'arrivalCost', label: '到院成本', type: 'number', width: 100 },
  { key: 'revenue', label: '实收', type: 'number', direct: true, width: 100 },
  { key: 'roi', label: '投产比', type: 'number', width: 90 },
];

const dateText = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const dateRange = ref<string[]>([dateText(yesterday), dateText(yesterday)]);
const selectedProjects = ref<string[]>([]);
const selectedChannels = ref<string[]>([]);
const selectedAccounts = ref<string[]>([]);
const selectedAccountNos = ref<string[]>([]);
const sourceRows = ref<PromotionDailyMetricItem[]>([]);
const allAccounts = ref<PromotionAccountItem[]>([]);
const fields = ref<PromotionMetricFieldItem[]>([]);
const loading = ref(false);

const projectOptions = computed(() => [...new Set(allAccounts.value.map((account) => account.project))].sort((a, b) => a.localeCompare(b, 'zh-CN')));
const channelOptions = computed(() => [...new Set(allAccounts.value.filter((account) => !selectedProjects.value.length || selectedProjects.value.includes(account.project)).map((account) => account.platform))].sort((a, b) => a.localeCompare(b, 'zh-CN')));
const accountOptions = computed<PromotionAccountItem[]>(() => {
  const candidates = allAccounts.value
    .filter((account) => !selectedProjects.value.length || selectedProjects.value.includes(account.project))
    .filter((account) => !selectedChannels.value.length || selectedChannels.value.includes(account.platform))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  return [...new Map(candidates.map((account) => [promotionAccountKey(account), account])).values()];
});
const accountNoOptions = computed(() => [...new Set(allAccounts.value
  .filter((account) => !selectedProjects.value.length || selectedProjects.value.includes(account.project))
  .filter((account) => !selectedChannels.value.length || selectedChannels.value.includes(account.platform))
  .filter((account) => !selectedAccounts.value.length || selectedAccounts.value.includes(promotionAccountKey(account)))
  .map((account) => account.accountNo).filter((value): value is string => Boolean(value)))].sort());
const filteredRows = computed(() => sourceRows.value
  .filter((row) => !selectedProjects.value.length || selectedProjects.value.includes(row.account.project))
  .filter((row) => !selectedChannels.value.length || selectedChannels.value.includes(row.account.platform))
  .filter((row) => !selectedAccounts.value.length || selectedAccounts.value.includes(promotionAccountKey(row.account)))
  .filter((row) => !selectedAccountNos.value.length || selectedAccountNos.value.includes(row.account.accountNo || '')));
const selectedPeriod = computed(() => {
  const from = dateRange.value?.[0];
  const to = dateRange.value?.[1];
  return from && to ? (from === to ? from : `${from} 至 ${to}`) : '全部日期';
});
const aggregatedRows = computed<PromotionDailyMetricItem[]>(() => {
  return aggregatePromotionRows(filteredRows.value, fields.value, selectedPeriod.value)
    .sort((left, right) => left.account.project.localeCompare(right.account.project, 'zh-CN') || left.account.platform.localeCompare(right.account.platform, 'zh-CN') || left.account.name.localeCompare(right.account.name, 'zh-CN'));
});
const visibleSystemColumns = computed(() => columns.filter((column) => fields.value.find((field) => field.key === column.key)?.isVisible !== false).sort((a,b) => (fields.value.find((field) => field.key === a.key)?.sort ?? columns.indexOf(a)) - (fields.value.find((field) => field.key === b.key)?.sort ?? columns.indexOf(b))));
const visibleCustomFields = computed(() => fields.value.filter((field) => field.source === 'CUSTOM' && field.isVisible).sort((a,b) => a.sort - b.sort || a.key.localeCompare(b.key)));
const orderedDisplayFields = computed(() => fields.value.filter((field) => field.isVisible).sort((a,b) => a.sort - b.sort || a.key.localeCompare(b.key)).map((field) => ({ field, column: columns.find((column) => column.key === field.key) })).filter((item) => item.column || item.field.source === 'CUSTOM'));
const fieldLabel = (key: string, fallback: string) => fields.value.find((field) => field.key === key)?.label || fallback;
const periodParts = (value: string) => {
  const [start, end] = value.split(' 至 ');
  return { start, end: end || '' };
};

function rawValue(row: PromotionDailyMetricItem, column: Column) {
  return column.direct ? Number(row[column.key as keyof PromotionDailyMetricItem]) : row.calculated[column.key as keyof typeof row.calculated];
}
function format(value: number | null, type: Column['type']) {
  if (value === null || !Number.isFinite(value)) return '—';
  if (type === 'rate') return `${(value * 100).toFixed(2)}%`;
  if (type === 'integer') return String(value);
  return value.toFixed(2);
}
const display = (row: PromotionDailyMetricItem, column: Column) => format(rawValue(row, column), column.type);

function totals() {
  const sum = (key: 'spend' | 'impressions' | 'clicks' | 'leads' | 'validLeads' | 'appointments' | 'transactions' | 'revenue') => aggregatedRows.value.reduce((total, row) => total + row[key], 0);
  const base = { spend: sum('spend'), impressions: sum('impressions'), clicks: sum('clicks'), leads: sum('leads'), validLeads: sum('validLeads'), appointments: sum('appointments'), transactions: sum('transactions'), revenue: sum('revenue') };
  return { ...base, clickRate: base.impressions ? base.clicks / base.impressions : null, validRate: base.leads ? base.validLeads / base.leads : null, averageCost: base.leads ? base.spend / base.leads : null, validCost: base.validLeads ? base.spend / base.validLeads : null, conversionRate: base.appointments ? base.transactions / base.appointments : null, arrivalRate: base.leads ? base.appointments / base.leads : null, validArrivalRate: base.validLeads ? base.appointments / base.validLeads : null, arrivalCost: base.appointments ? base.spend / base.appointments : null, roi: base.spend ? base.revenue / base.spend : null };
}
function summary({ columns: tableColumns }: { columns: Array<{ label: string }> }) {
  const total = totals();
  return tableColumns.map((tableColumn, index) => {
    if (index === 0) return '合计';
    if (index < 4) return '';
    const column = visibleSystemColumns.value.find((item) => fieldLabel(item.key, item.label) === tableColumn.label);
    return column ? format(total[column.key as keyof typeof total] as number | null, column.type) : '';
  });
}

async function load() {
  loading.value = true;
  try {
    const result = await getPromotionFilterData({ dateFrom: dateRange.value?.[0] || '', dateTo: dateRange.value?.[1] || '' });
    sourceRows.value = result.rows;
    fields.value = result.fields;
    allAccounts.value = result.accounts;
  } finally {
    loading.value = false;
  }
}
async function selectQuickRange(value: [string, string]) {
  dateRange.value = value;
  await load();
}
function resetFilters() {
  selectedProjects.value = [];
  selectedChannels.value = [];
  selectedAccounts.value = [];
  selectedAccountNos.value = [];
}

load();
</script>

<style scoped>
.page-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:20px; }
.page-title { margin:0 0 6px; }
.page-heading p { margin:0; color:var(--admin-text-muted); }
.filter-actions { display:flex; flex:0 0 auto; align-items:center; justify-content:flex-end; gap:10px; flex-wrap:wrap; }
.project-picker { width:130px; }
.channel-picker { width:150px; }
.account-picker { width:190px; }
.day-range-picker { width:350px!important; flex:0 0 350px; }
.filter-actions small { float:right; margin-left:18px; color:var(--admin-text-muted); }
.filter-actions :deep(.el-button) { margin:0; }
.result-note { margin:8px 0 12px; color:var(--admin-text-muted); font-size:13px; }
.mobile-scroll-hint { display:none; }
.filter-table { width:100%; font-size:clamp(7px,.72vw,13px); }
.filter-table :deep(.el-table__body-wrapper),.filter-table :deep(.el-scrollbar__wrap) { overflow-x:auto!important; }
.filter-table :deep(.el-scrollbar__bar.is-horizontal) { display:block!important; }
.filter-table :deep(.el-table__cell) { padding:clamp(3px,.4vw,7px) 1px; text-align:center; }
.filter-table :deep(.cell) { padding:0 1px; white-space:normal; overflow-wrap:anywhere; word-break:break-word; text-align:center; }
.period-value { display:inline-flex; max-width:100%; align-items:center; justify-content:center; gap:4px; white-space:nowrap; }
.filter-table :deep(.period-cell .cell) { overflow:hidden; }
@media(max-width:1450px){.page-heading{flex-direction:column}.filter-actions{width:100%;justify-content:flex-start}}
@media(max-width:900px){.content-panel{padding:8px}.filter-table{font-size:7px}.filter-table :deep(.el-table__cell){padding:3px 0}.filter-table :deep(.cell){padding:0}}

@media(max-width:760px){.mobile-scroll-hint{display:block;margin:0 0 8px;color:var(--admin-text-muted);font-size:12px}.filter-actions{display:grid;width:100%;grid-template-columns:1fr 1fr}.project-picker,.channel-picker,.account-picker,.day-range-picker{width:100%!important;grid-column:1/-1;flex:auto}.filter-actions :deep(.el-button){width:100%;margin:0}.filter-table{min-width:1980px;font-size:12px}.filter-table :deep(.el-table__body-wrapper),.filter-table :deep(.el-scrollbar__wrap){overflow-x:auto!important}.filter-table :deep(.el-scrollbar__bar.is-horizontal){display:block!important}.filter-table :deep(.cell){padding:0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.period-value{display:flex;flex-direction:column;gap:0;line-height:1.45}.filter-table :deep(.period-cell .cell){white-space:normal}}
</style>
