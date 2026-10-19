<template>
  <section>
    <div class="page-heading">
      <div>
        <h1 class="page-title">{{ isMaterialPage ? '素材分析' : '账户健康' }}</h1>
        <p>{{ isMaterialPage ? '分析视频、图片、标题、落地页和转化组件，并给出针对性的优化建议。' : '连接投放平台数据，诊断账户广告健康状态并给出可执行的优化建议。' }}</p>
      </div>
      <div class="heading-side">
        <div v-if="isMaterialPage && canOpenCreativeBatch" class="creative-entry-actions">
          <el-button type="primary" @click="openCreativeBatch(false)">新建创意</el-button>
          <el-button @click="openCreativeBatch(true)">批量创建记录</el-button>
        </div>
        <div class="connection-list">
          <div v-for="item in connections" :key="item.provider" class="connection-pill" :class="{ connected: item.connected }">
            <span class="connection-dot" />
            <div><strong>{{ providerName(item.provider) }}</strong><small>{{ item.connected ? '已连接' : item.enabled ? '凭证未就绪' : '未启用' }}</small></div>
          </div>
        </div>
      </div>
    </div>

    <div class="content-panel control-panel" v-loading="loadingOptions">
      <div class="control-grid">
        <label v-if="!isMaterialPage" class="field-block account-field">
          <span>选择账户（支持多选）</span>
          <el-select v-model="selectedAccountIds" multiple collapse-tags collapse-tags-tooltip filterable placeholder="请选择需要分析的账户">
            <el-option v-for="account in accounts" :key="account.id" :value="account.id" :label="`${account.name} · ${account.accountNo || '未填户号'} · ${account.project}/${account.platform}`" />
          </el-select>
        </label>
        <label v-else class="field-block scope-field">
          <span>分析范围</span>
          <el-radio-group v-model="materialScope">
            <el-radio-button value="BUSINESS_UNIT">业务单元整体</el-radio-button>
            <el-radio-button value="ACCOUNT">单账户</el-radio-button>
          </el-radio-group>
        </label>
        <label v-if="isMaterialPage && materialScope === 'BUSINESS_UNIT'" class="field-block account-field">
          <span>选择业务单元</span>
          <el-select v-model="materialProvider" placeholder="请选择需要整体分析的业务单元">
            <el-option v-for="unit in businessUnits" :key="unit.provider" :value="unit.provider" :disabled="unit.accountCount === 0" :label="`${unit.label} · ${unit.accountCount} 个可分析账户`" />
          </el-select>
        </label>
        <label v-else-if="isMaterialPage" class="field-block account-field">
          <span>选择账户</span>
          <el-select v-model="materialAccountId" filterable placeholder="请选择需要分析的账户">
            <el-option v-for="account in accounts" :key="account.id" :value="account.id" :disabled="!account.accountNo" :label="`${account.name} · ${account.accountNo || '未填户号'} · ${account.project}/${account.platform}`" />
          </el-select>
        </label>
        <label class="field-block date-field">
          <span>分析周期</span>
          <el-date-picker v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" :clearable="false" />
        </label>
        <div class="field-block quick-field">
          <span>快捷周期</span>
          <el-button-group>
            <el-button v-for="days in [3, 7, 15, 30]" :key="days" :type="activeDays === days ? 'primary' : 'default'" @click="setRecentDays(days)">近{{ days }}天</el-button>
          </el-button-group>
        </div>
      </div>
      <div class="control-actions">
        <el-checkbox v-if="!isMaterialPage" v-model="syncEndDate">先同步周期结束日数据</el-checkbox>
        <small>{{ !isMaterialPage ? '同步严格遵守归档保护，已归档日统计不会被覆盖。' : '素材直接读取投放平台；没有独立效果归因的类型仅进行配置检查。' }}</small>
        <el-button type="primary" :loading="analyzing || materialAnalyzing" @click="!isMaterialPage ? analyze() : analyzeMaterials()">{{ !isMaterialPage && syncEndDate ? '同步并分析' : '开始分析' }}</el-button>
      </div>
    </div>

    <template v-if="!isMaterialPage && report">
      <div class="summary-grid">
        <article class="summary-card score-card"><span>综合健康分</span><strong>{{ report.overallScore ?? '—' }}</strong><small>共分析 {{ report.accounts.length }} 个账户</small></article>
        <article class="summary-card healthy"><span>健康</span><strong>{{ report.summary.healthy }}</strong><small>核心指标运行平稳</small></article>
        <article class="summary-card attention"><span>需关注</span><strong>{{ report.summary.attention }}</strong><small>存在趋势性异常</small></article>
        <article class="summary-card risk"><span>风险</span><strong>{{ report.summary.risk }}</strong><small>建议优先处理</small></article>
        <article class="summary-card insufficient"><span>数据不足</span><strong>{{ report.summary.insufficient }}</strong><small>需检查同步与授权</small></article>
      </div>

      <el-alert v-if="syncMessage" :title="syncMessage" :type="syncHasError ? 'warning' : 'success'" show-icon :closable="false" class="sync-alert" />

      <div class="account-results">
        <article v-for="item in report.accounts" :key="item.account.id" class="content-panel account-card">
          <header class="account-card-header">
            <div>
              <div class="account-title-row"><h2>{{ item.account.name }}</h2><el-tag :type="statusType(item.status)" effect="dark">{{ statusLabel(item.status) }}</el-tag></div>
              <p>{{ item.account.project }} · {{ item.account.platform }} · 户号 {{ item.account.accountNo || '未填写' }}</p>
            </div>
            <div class="account-score"><span>健康分</span><strong>{{ item.score ?? '—' }}</strong></div>
          </header>

          <div class="metric-grid">
            <div><span>消费</span><strong>¥{{ number(item.current.spend) }}</strong></div>
            <div><span>曝光</span><strong>{{ integer(item.current.impressions) }}</strong></div>
            <div><span>点击</span><strong>{{ integer(item.current.clicks) }}</strong></div>
            <div><span>点击率</span><strong>{{ percent(item.current.clickRate) }}</strong><small>{{ trend(item.current.clickRate, item.previous.clickRate) }}</small></div>
            <div><span>目标转化</span><strong>{{ integer(item.current.leads) }}</strong></div>
            <div><span>转化率</span><strong>{{ percent(item.current.conversionRate) }}</strong><small>{{ trend(item.current.conversionRate, item.previous.conversionRate) }}</small></div>
            <div><span>表单成本</span><strong>{{ money(item.current.costPerLead) }}</strong><small>{{ trend(item.current.costPerLead, item.previous.costPerLead, true) }}</small></div>
            <div><span>有效率</span><strong>{{ percent(item.current.validRate) }}</strong><small>{{ trend(item.current.validRate, item.previous.validRate) }}</small></div>
          </div>

          <div class="diagnosis-list">
            <div v-for="issue in item.issues" :key="issue.key" class="diagnosis-item" :class="issue.level.toLowerCase()">
              <span class="severity-mark" />
              <div><h3>{{ issue.title }}</h3><p>{{ issue.description }}</p><strong>建议：{{ issue.recommendation }}</strong></div>
            </div>
          </div>
          <footer>已录入 {{ item.recordedDays }} 天数据<span v-if="item.latestSyncedAt"> · 最近同步 {{ formatTime(item.latestSyncedAt) }}</span></footer>
        </article>
      </div>

      <div class="content-panel methodology">
        <h2>诊断口径说明</h2>
        <p>{{ report.methodology.statement }}</p>
        <div class="baseline-list"><span>表单成本基线 ≤ ¥{{ report.methodology.internalBaselines.maxCostPerLead }}</span><span>有效率基线 ≥ {{ percent(report.methodology.internalBaselines.minValidRate) }}</span><span>趋势预警幅度 ≥ {{ percent(report.methodology.internalBaselines.trendWarning) }}</span></div>
        <div class="source-list"><a v-for="source in report.methodology.sources" :key="source.provider" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.label }}</a></div>
      </div>
    </template>

    <template v-else-if="isMaterialPage && materialReport">
      <div class="summary-grid material-summary">
        <article class="summary-card score-card"><span>素材总数</span><strong>{{ materialReport.summary.total }}</strong><small>{{ materialReport.businessUnit.name }} · {{ materialReport.businessUnit.analyzedAccountCount }}/{{ materialReport.businessUnit.accountCount }} 个账户</small></article>
        <article class="summary-card healthy"><span>健康</span><strong>{{ materialReport.summary.healthy }}</strong><small>指标未发现明显异常</small></article>
        <article class="summary-card attention"><span>需关注</span><strong>{{ materialReport.summary.attention }}</strong><small>建议优化后继续观察</small></article>
        <article class="summary-card risk"><span>风险</span><strong>{{ materialReport.summary.risk }}</strong><small>建议优先处理</small></article>
        <article class="summary-card insufficient"><span>仅配置检查</span><strong>{{ materialReport.summary.unassessed }}</strong><small>平台未提供独立归因</small></article>
      </div>

      <el-alert v-if="materialReport.warnings.length" :title="materialReport.warnings.join('；')" type="warning" show-icon :closable="false" class="sync-alert" />
      <div class="content-panel coverage-panel">
        <div v-for="item in materialReport.coverage" :key="item.type" class="coverage-item">
          <strong>{{ materialTypeLabel(item.type) }}</strong>
          <el-tag :type="item.available ? (item.metricsAvailable ? 'success' : 'warning') : 'info'" size="small">{{ item.metricsAvailable ? '效果分析' : item.available ? '配置检查' : '暂不可用' }}</el-tag>
          <span>{{ item.message }}</span>
        </div>
      </div>

      <div class="content-panel material-table-panel">
        <div class="material-toolbar">
          <strong>分析明细</strong>
          <el-radio-group v-model="materialTypeFilter" size="small">
            <el-radio-button value="ALL">全部</el-radio-button>
            <el-radio-button v-for="type in materialTypes" :key="type" :value="type">{{ materialTypeLabel(type) }} {{ materialCategoryCount(type) }}</el-radio-button>
          </el-radio-group>
        </div>
        <el-table :data="pagedMaterials" stripe class="material-table" @sort-change="onMaterialSortChange">
          <el-table-column prop="type" label="类型" width="88" sortable="custom"><template #default="{ row }"><el-tag size="small" effect="plain">{{ materialTypeLabel(row.type) }}</el-tag></template></el-table-column>
          <el-table-column prop="account" label="所属账户" min-width="150" sortable="custom"><template #default="{ row }"><div class="material-account"><strong>{{ row.account?.name || '—' }}</strong><small>{{ row.account?.accountNo || '未填户号' }} · {{ row.account?.project || '—' }}</small></div></template></el-table-column>
          <el-table-column prop="name" label="素材/配置" min-width="210" show-overflow-tooltip sortable="custom" />
          <el-table-column prop="health" label="状态" width="96" sortable="custom"><template #default="{ row }"><el-tag :type="statusType(row.health)" size="small">{{ materialHealthLabel(row.health) }}</el-tag></template></el-table-column>
          <el-table-column prop="spend" label="消费" width="106" align="right" sortable="custom"><template #default="{ row }">{{ row.metrics ? money(row.metrics.spend) : '—' }}</template></el-table-column>
          <el-table-column prop="impressions" label="曝光" width="96" align="right" sortable="custom"><template #default="{ row }">{{ row.metrics ? integer(row.metrics.impressions) : '—' }}</template></el-table-column>
          <el-table-column prop="ctr" label="点击率" width="92" align="right" sortable="custom"><template #default="{ row }">{{ percent(row.calculated.ctr) }}</template></el-table-column>
          <el-table-column prop="conversions" label="转化" width="82" align="right" sortable="custom"><template #default="{ row }">{{ row.metrics ? integer(row.metrics.conversions) : '—' }}</template></el-table-column>
          <el-table-column prop="costPerConversion" label="转化成本" width="116" align="right" sortable="custom"><template #default="{ row }">{{ money(row.calculated.costPerConversion) }}</template></el-table-column>
          <el-table-column label="问题与建议" min-width="340"><template #default="{ row }"><div class="material-advice"><span>{{ row.issues.join('；') }}</span><strong>{{ row.recommendation }}</strong></div></template></el-table-column>
        </el-table>
        <div class="material-pagination">
          <span>共 {{ sortedMaterials.length }} 条素材</span>
          <el-pagination v-model:current-page="materialPage" v-model:page-size="materialPageSize" :page-sizes="[20, 50, 100]" :total="sortedMaterials.length" layout="sizes, prev, pager, next, jumper" background />
        </div>
      </div>

      <div class="content-panel methodology">
        <h2>素材分析口径</h2><p>{{ materialReport.methodology.statement }}</p>
        <div class="source-list"><a v-for="source in materialReport.methodology.sources" :key="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.label }}</a></div>
      </div>
    </template>

    <el-empty v-else-if="!loadingOptions" :description="!isMaterialPage ? '选择账户和周期后开始健康分析' : '选择业务单元和周期后开始整体素材分析'" />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../stores/auth';
import { analyzePromotionHealth, analyzePromotionMaterials as requestMaterialAnalysis, getPromotionCreativeAdgroups, getPromotionCreativeBatchOptions, getPromotionHealthAccounts, type PromotionAccountItem, type PromotionCreativeBatchOptions, type PromotionHealthAccountsResult, type PromotionHealthReport, type PromotionMaterialReport, type PromotionMaterialType } from '../api/admin';

const accounts = ref<PromotionAccountItem[]>([]);
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const isMaterialPage = computed(() => route.path.endsWith('/material-analysis'));
const creativeOptions = ref<PromotionCreativeBatchOptions | null>(null);
const creativeReadyAccountId = ref('');
const canOpenCreativeBatch = computed(() => auth.hasPermission('PROMOTION_CREATIVE_BATCH_VIEW') && auth.hasPermission('PROMOTION_CREATIVE_BATCH_CREATE') && Boolean(creativeReadyAccountId.value));
const connections = ref<PromotionHealthAccountsResult['connections']>([]);
const selectedAccountIds = ref<string[]>([]);
const materialProvider = ref<'TENCENT_ADS' | 'OCEANENGINE'>('TENCENT_ADS');
const materialScope = ref<'BUSINESS_UNIT' | 'ACCOUNT'>('BUSINESS_UNIT');
const materialAccountId = ref('');
const dateRange = ref<[string, string]>(recentRange(7));
const syncEndDate = ref(false);
const loadingOptions = ref(false);
const analyzing = ref(false);
const report = ref<PromotionHealthReport | null>(null);
const materialReport = ref<PromotionMaterialReport | null>(null);
const materialAnalyzing = ref(false);
type MaterialCategory = 'MEDIA' | 'COPY' | 'LANDING_PAGE' | 'BRAND' | 'ACTION_BUTTON' | 'MINI_CARD_LINK' | 'TEXT_LINK' | 'FLOATING_ZONE' | 'LABEL' | 'SOCIAL_SKILL';
const materialTypeFilter = ref<'ALL' | MaterialCategory>('ALL');
const materialTypes: MaterialCategory[] = ['MEDIA', 'COPY', 'LANDING_PAGE', 'BRAND', 'ACTION_BUTTON', 'MINI_CARD_LINK', 'TEXT_LINK', 'FLOATING_ZONE', 'LABEL', 'SOCIAL_SKILL'];
const businessUnits = computed(() => [
  { provider: 'TENCENT_ADS' as const, label: '腾讯广告业务单元', accountCount: accounts.value.filter((item) => item.platform.includes('腾讯') && item.accountNo).length },
  { provider: 'OCEANENGINE' as const, label: '巨量引擎业务单元', accountCount: accounts.value.filter((item) => item.platform.includes('巨量') && item.accountNo).length },
]);
const materialPage = ref(1);
const materialPageSize = ref(20);
const materialSort = ref<{ prop: string; order: 'ascending' | 'descending' }>({ prop: 'spend', order: 'descending' });
const filteredMaterials = computed(() => materialReport.value?.items.filter((item) => materialTypeFilter.value === 'ALL' || materialCategory(item.type) === materialTypeFilter.value) || []);
const sortedMaterials = computed(() => [...filteredMaterials.value].sort((left, right) => {
  const leftValue = materialSortValue(left, materialSort.value.prop);
  const rightValue = materialSortValue(right, materialSort.value.prop);
  const compared = typeof leftValue === 'number' && typeof rightValue === 'number'
    ? leftValue - rightValue
    : String(leftValue ?? '').localeCompare(String(rightValue ?? ''), 'zh-CN');
  return materialSort.value.order === 'ascending' ? compared : -compared;
}));
const pagedMaterials = computed(() => sortedMaterials.value.slice((materialPage.value - 1) * materialPageSize.value, materialPage.value * materialPageSize.value));
const activeDays = computed(() => dateDiff(dateRange.value[0], dateRange.value[1]) + 1);
const syncHasError = computed(() => (report.value?.syncResults || []).some((item) => item.errors.length));
const syncMessage = computed(() => {
  const results = report.value?.syncResults || [];
  if (!results.length) return '';
  return results.map((item) => `${providerName(item.provider)}：同步 ${item.synced}，无数据 ${item.noData}，归档跳过 ${item.skippedArchived}${item.errors.length ? `，异常 ${item.errors.join('；')}` : ''}`).join('；');
});

function recentRange(days: number): [string, string] {
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  return [formatDate(start), formatDate(end)];
}
function parseDate(value: string) { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day, 12); }
function dateDiff(from: string, to: string) { return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000); }
function formatDate(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function setRecentDays(days: number) { dateRange.value = recentRange(days); }
function providerName(provider: string) { return provider === 'TENCENT_ADS' ? '腾讯广告' : provider === 'OCEANENGINE' ? '巨量引擎' : provider; }
function openCreativeBatch(records: boolean) {
  const query: Record<string, string> = records ? { tab: 'records' } : {};
  if (!records) query.accountId = materialAccountId.value === creativeReadyAccountId.value ? materialAccountId.value : creativeReadyAccountId.value;
  router.push({ path: '/promotion-operations/creative-batches', query });
}
function statusLabel(status: string) { return ({ HEALTHY: '健康', ATTENTION: '需关注', RISK: '风险', INSUFFICIENT: '数据不足' } as Record<string, string>)[status] || status; }
function statusType(status: string) { return status === 'HEALTHY' ? 'success' : status === 'ATTENTION' ? 'warning' : status === 'RISK' ? 'danger' : 'info'; }
function materialHealthLabel(status: string) { return ({ HEALTHY: '健康', ATTENTION: '需关注', RISK: '风险', UNASSESSED: '配置检查' } as Record<string, string>)[status] || status; }
function materialCategory(type: PromotionMaterialType): MaterialCategory { return (['VIDEO', 'IMAGE'].includes(type) ? 'MEDIA' : type) as MaterialCategory; }
function materialTypeLabel(type: PromotionMaterialType | MaterialCategory) { return ({ MEDIA: '图片/视频', VIDEO: '图片/视频', IMAGE: '图片/视频', COPY: '文案', LANDING_PAGE: '落地页', BRAND: '品牌形象', ACTION_BUTTON: '行动按钮', MINI_CARD_LINK: '图文链接', TEXT_LINK: '文字链', FLOATING_ZONE: '浮层卡片', LABEL: '标签', SOCIAL_SKILL: '首评回复' } as const)[type]; }
function materialCategoryCount(type: MaterialCategory) { return materialReport.value?.items.filter((item) => materialCategory(item.type) === type).length || 0; }
function materialSortValue(item: PromotionMaterialReport['items'][number], prop: string) {
  const healthOrder = { RISK: 3, ATTENTION: 2, HEALTHY: 1, UNASSESSED: 0 } as Record<string, number>;
  if (prop === 'account') return `${item.account?.name || ''}${item.account?.accountNo || ''}`;
  if (prop === 'spend') return item.metrics?.spend ?? -1;
  if (prop === 'impressions') return item.metrics?.impressions ?? -1;
  if (prop === 'conversions') return item.metrics?.conversions ?? -1;
  if (prop === 'ctr') return item.calculated.ctr ?? -1;
  if (prop === 'costPerConversion') return item.calculated.costPerConversion ?? -1;
  if (prop === 'health') return healthOrder[item.health] ?? -1;
  return item[prop as keyof typeof item] as string | number | null | undefined;
}
function onMaterialSortChange({ prop, order }: { prop?: string; order?: 'ascending' | 'descending' | null }) {
  materialSort.value = prop && order ? { prop, order } : { prop: 'spend', order: 'descending' };
  materialPage.value = 1;
}
function integer(value: number) { return Number(value || 0).toLocaleString('zh-CN'); }
function number(value: number) { return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function percent(value: number | null) { return value === null ? '—' : `${(value * 100).toFixed(2)}%`; }
function money(value: number | null) { return value === null ? '—' : `¥${number(value)}`; }
function trend(current: number | null, previous: number | null, reverse = false) {
  if (current === null || previous === null || !previous) return '上周期无可比数据';
  const value = (current - previous) / previous;
  const favorable = reverse ? value <= 0 : value >= 0;
  return `${value >= 0 ? '↑' : '↓'} ${Math.abs(value * 100).toFixed(1)}%${favorable ? '' : ' · 需关注'}`;
}
function formatTime(value: string) { return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)); }

async function loadOptions() {
  loadingOptions.value = true;
  try {
    const result = await getPromotionHealthAccounts();
    accounts.value = result.accounts;
    connections.value = result.connections;
    selectedAccountIds.value = result.accounts.map((item) => item.id);
    materialProvider.value = businessUnits.value.find((item) => item.accountCount > 0)?.provider || 'TENCENT_ADS';
    materialAccountId.value = result.accounts.find((item) => item.accountNo)?.id || '';
    if (isMaterialPage.value && auth.hasPermission('PROMOTION_CREATIVE_BATCH_VIEW')) {
      try {
        creativeOptions.value = await getPromotionCreativeBatchOptions();
        for (const account of creativeOptions.value.accounts.filter((item) => item.authorized && item.canCreate)) {
          try {
            const result = await getPromotionCreativeAdgroups({ accountId: account.id, page: 1, pageSize: 20 });
            if (result.list.some((item) => item.canCreate)) { creativeReadyAccountId.value = account.id; break; }
          } catch { /* 入口保持隐藏；独立记录页仍可通过菜单查看历史任务。 */ }
        }
      } catch { creativeOptions.value = null; }
    }
  } finally { loadingOptions.value = false; }
}
async function analyzeMaterials() {
  if (materialScope.value === 'BUSINESS_UNIT') {
    const selectedUnit = businessUnits.value.find((item) => item.provider === materialProvider.value);
    if (!selectedUnit?.accountCount) return ElMessage.warning('当前业务单元没有可分析的启用账户或户号');
  } else if (!materialAccountId.value) return ElMessage.warning('请选择需要分析素材的账户');
  if (!dateRange.value?.[0] || !dateRange.value?.[1]) return ElMessage.warning('请选择分析周期');
  materialAnalyzing.value = true;
  try {
    materialReport.value = await requestMaterialAnalysis({
      ...(materialScope.value === 'BUSINESS_UNIT' ? { provider: materialProvider.value } : { accountId: materialAccountId.value }),
      dateFrom: dateRange.value[0], dateTo: dateRange.value[1],
    });
    materialPage.value = 1;
    ElMessage.success(materialScope.value === 'BUSINESS_UNIT' ? '业务单元素材分析已完成' : '单账户素材分析已完成');
  } finally { materialAnalyzing.value = false; }
}
watch([materialTypeFilter, materialPageSize], () => { materialPage.value = 1; });
async function analyze() {
  if (!selectedAccountIds.value.length) return ElMessage.warning('请至少选择一个推广账户');
  if (!dateRange.value?.[0] || !dateRange.value?.[1]) return ElMessage.warning('请选择分析周期');
  analyzing.value = true;
  try {
    report.value = await analyzePromotionHealth({ accountIds: selectedAccountIds.value, dateFrom: dateRange.value[0], dateTo: dateRange.value[1], syncEndDate: syncEndDate.value });
    ElMessage.success('账户健康分析已完成');
  } finally { analyzing.value = false; }
}
onMounted(loadOptions);
</script>

<style scoped>
.page-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:18px}.page-heading p{margin:5px 0 0;color:var(--admin-text-muted)}.heading-side{display:flex;flex-direction:column;align-items:flex-end;gap:10px}.creative-entry-actions{display:flex;gap:8px}.connection-list{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}.connection-pill{display:flex;align-items:center;gap:9px;min-width:128px;padding:9px 12px;border:1px solid var(--admin-border);border-radius:10px;background:#fff}.connection-pill>div{display:flex;flex-direction:column}.connection-pill small{color:var(--admin-text-muted)}.connection-dot{width:9px;height:9px;border-radius:50%;background:#c0c4cc}.connection-pill.connected .connection-dot{background:#67c23a;box-shadow:0 0 0 4px rgba(103,194,58,.13)}.control-panel{margin-bottom:18px}.control-grid{display:grid;grid-template-columns:minmax(260px,1.5fr) minmax(320px,1.2fr) auto;gap:14px;align-items:end}.field-block{display:flex;min-width:0;flex-direction:column;gap:7px}.field-block>span{font-size:13px;font-weight:650;color:var(--admin-text)}.field-block :deep(.el-select),.field-block :deep(.el-date-editor){width:100%}.control-actions{display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:16px;padding-top:14px;border-top:1px solid var(--admin-border)}.control-actions small{margin-right:auto;color:var(--admin-text-muted)}.summary-grid{display:grid;grid-template-columns:1.35fr repeat(4,1fr);gap:12px;margin-bottom:16px}.summary-card{display:flex;min-height:118px;flex-direction:column;justify-content:center;padding:18px;border:1px solid var(--admin-border);border-radius:12px;background:#fff;box-shadow:var(--admin-shadow)}.summary-card>span{color:var(--admin-text-muted)}.summary-card strong{margin:6px 0 2px;font-size:30px;color:var(--admin-text)}.summary-card small{color:var(--admin-text-muted)}.score-card{background:linear-gradient(135deg,#457ea9,#5c94bd);border-color:#457ea9}.score-card span,.score-card strong,.score-card small{color:#fff}.healthy{border-top:4px solid #67c23a}.attention{border-top:4px solid #e6a23c}.risk{border-top:4px solid #f56c6c}.insufficient{border-top:4px solid #909399}.sync-alert{margin-bottom:16px}.account-results{display:grid;gap:16px}.account-card{padding:0;overflow:hidden}.account-card-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid var(--admin-border);background:linear-gradient(90deg,#f8fbfe,#fff)}.account-card-header h2{margin:0;font-size:19px}.account-card-header p{margin:5px 0 0;color:var(--admin-text-muted)}.account-title-row{display:flex;align-items:center;gap:10px}.account-score{text-align:center}.account-score span{display:block;color:var(--admin-text-muted);font-size:12px}.account-score strong{font-size:28px;color:var(--admin-primary)}.metric-grid{display:grid;grid-template-columns:repeat(8,1fr);border-bottom:1px solid var(--admin-border)}.metric-grid>div{display:flex;min-width:0;flex-direction:column;gap:4px;padding:15px;border-right:1px solid var(--admin-border)}.metric-grid>div:last-child{border-right:0}.metric-grid span,.metric-grid small{color:var(--admin-text-muted);font-size:12px}.metric-grid strong{font-size:17px;white-space:nowrap}.diagnosis-list{display:grid;gap:10px;padding:16px 20px}.diagnosis-item{display:flex;gap:12px;padding:12px 14px;border-radius:9px;background:#f7f9fb}.diagnosis-item h3{margin:0 0 4px;font-size:15px}.diagnosis-item p{margin:0 0 5px;color:var(--admin-text-muted)}.diagnosis-item strong{font-size:13px;font-weight:600}.severity-mark{flex:0 0 7px;width:7px;border-radius:6px;background:#909399}.diagnosis-item.risk .severity-mark{background:#f56c6c}.diagnosis-item.warning .severity-mark{background:#e6a23c}.diagnosis-item.info .severity-mark{background:#67c23a}.account-card footer{padding:10px 20px;color:var(--admin-text-muted);background:#fafbfd;font-size:12px}.methodology{margin-top:18px}.methodology h2{margin:0 0 8px;font-size:17px}.methodology p{margin:0;color:var(--admin-text-muted)}.baseline-list,.source-list{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.baseline-list span{padding:6px 10px;border-radius:999px;background:#eef5fb;color:#315f81;font-size:12px}.source-list a{color:var(--admin-primary);font-size:13px}
.analysis-tabs{margin-bottom:12px}.coverage-panel{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:16px}.coverage-item{display:grid;grid-template-columns:1fr auto;gap:5px 8px;padding:12px;border:1px solid var(--admin-border);border-radius:10px;background:#fbfdff}.coverage-item>span{grid-column:1/-1;color:var(--admin-text-muted);font-size:12px;line-height:1.5}.material-table-panel{padding:0;overflow:hidden}.material-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--admin-border)}.material-account,.material-advice{display:flex;flex-direction:column;gap:4px}.material-account small{color:var(--admin-text-muted)}.material-advice{line-height:1.45}.material-advice>span{color:#c45656}.material-advice>strong{font-weight:500;color:var(--admin-text)}.material-pagination{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;border-top:1px solid var(--admin-border);background:#fbfdff}.material-pagination>span{color:var(--admin-text-muted);font-size:13px;white-space:nowrap}
@media(max-width:1200px){.control-grid{grid-template-columns:1fr 1fr}.quick-field{grid-column:1/-1}.summary-grid{grid-template-columns:repeat(3,1fr)}.metric-grid{grid-template-columns:repeat(4,1fr)}.metric-grid>div:nth-child(4n){border-right:0}.coverage-panel{grid-template-columns:repeat(3,1fr)}}
@media(max-width:760px){.page-heading{flex-direction:column}.heading-side{width:100%;align-items:stretch}.creative-entry-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.creative-entry-actions :deep(.el-button){width:100%;margin:0}.connection-list{width:100%;justify-content:flex-start}.connection-pill{flex:1}.control-grid{grid-template-columns:1fr}.quick-field{grid-column:auto}.quick-field :deep(.el-button-group){display:grid;grid-template-columns:repeat(2,1fr)}.quick-field :deep(.el-button){width:100%;margin:0}.control-actions{align-items:stretch;flex-direction:column}.control-actions small{margin:0}.control-actions :deep(.el-button){width:100%;margin:0}.summary-grid{grid-template-columns:repeat(2,1fr);gap:8px}.summary-card{min-height:98px;padding:13px}.summary-card strong{font-size:25px}.score-card{grid-column:1/-1}.account-card-header{align-items:flex-start;padding:15px}.metric-grid{grid-template-columns:repeat(2,1fr)}.metric-grid>div{padding:12px}.metric-grid>div:nth-child(2n){border-right:0}.diagnosis-list{padding:12px}.diagnosis-item{padding:10px}.account-card footer{padding:9px 12px}.coverage-panel{grid-template-columns:1fr}.material-toolbar{align-items:flex-start;flex-direction:column}.material-toolbar :deep(.el-radio-group){display:grid;width:100%;grid-template-columns:repeat(2,1fr)}.material-toolbar :deep(.el-radio-button){width:100%}.material-toolbar :deep(.el-radio-button__inner){width:100%;padding:8px 6px}.material-table{min-width:980px}.material-table-panel{overflow-x:auto}.material-pagination{align-items:flex-start;flex-direction:column;min-width:720px}}
</style>
