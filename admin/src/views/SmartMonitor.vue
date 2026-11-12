<template>
  <div class="smart-monitor">
    <header class="page-heading"><div><span class="eyebrow">推广运营 · 智能监控</span><h1>智能监控</h1><p>腾讯平台状态、小时报表与目标成本分开核对；异常附带判断证据。</p></div><el-tag type="info">人工确认模式</el-tag></header>
    <el-alert type="info" :closable="false" title="仅监控营销单元与创意；建议仅供人工判断。单条创意可人工暂停／恢复、定时开启或删除；自动处置保持关闭，所有写操作均需腾讯回读。" />
    <el-alert v-if="lastUnknownActionId" type="warning" :closable="false" class="warning" title="上次操作结果不明，禁止重复提交。"><el-button size="small" :loading="reconciling" @click="reconcileLastAction">重新核对腾讯状态</el-button></el-alert>
    <section class="content-panel toolbar">
      <el-select v-model="selectedAccountId" filterable placeholder="选择腾讯账户" class="account-select" @change="loadDashboard"><el-option v-for="account in accounts" :key="account.id" :value="account.id" :label="`${account.name} · ${account.accountNo}`" /></el-select>
      <el-input v-model="keyword" clearable placeholder="搜索营销单元、创意或腾讯 ID" class="search-input" />
      <el-select v-model="healthFilter" class="health-select"><el-option label="全部判断" value="ALL" /><el-option label="阈值异常" value="WARNING" /><el-option label="数据不足" value="INSUFFICIENT" /><el-option label="正常" value="NORMAL" /></el-select>
      <el-select v-model="sortMode" class="health-select"><el-option label="异常优先" value="WARNING" /><el-option label="消费从高到低" value="SPEND" /><el-option label="实际成本从高到低" value="CPA" /></el-select>
      <el-button type="primary" :loading="loading" :disabled="!selectedAccountId" @click="loadDashboard">刷新腾讯数据</el-button>
    </section>
    <el-empty v-if="!accounts.length && !loading" description="当前无可访问的腾讯账户" />
    <template v-if="dashboard">
      <div class="summary-grid">
        <section class="content-panel summary"><span>账户</span><strong>{{ dashboard.account.name }}</strong><small>{{ dashboard.account.accountNo }}</small></section>
        <section class="content-panel summary"><span>凭证状态</span><strong>{{ dashboard.credential.authorized ? '已配置' : '未授权' }}</strong><small>只读能力以逐接口回读为准</small></section>
        <section class="content-panel summary"><span>可判定营销单元</span><strong>{{ dashboard.adgroups.filter(item => item.assessment.state !== 'INSUFFICIENT').length }} / {{ dashboard.adgroups.length }}</strong><small>不使用固定目标成本</small></section>
        <section class="content-panel summary"><span>营销单元 / 创意异常</span><strong>{{ dashboard.adgroups.filter(item => item.assessment.state === 'WARNING').length }} / {{ dashboard.creatives.filter(item => item.assessment.state === 'WARNING').length }}</strong><small>只提示，不自动处置</small></section>
      </div>
      <el-alert v-if="dashboard.policySource === 'LEGACY_ACCOUNT'" type="info" :closable="false" class="warning" title="当前渠道尚未保存统一规则；保存后同渠道账户共用阈值与轮询开关。历史账户规则仍保留。" />
      <el-alert v-if="!dashboard.policy.enabled" type="info" :closable="false" class="warning" title="定时监控尚未启用；当前页面仍可手动刷新腾讯数据。" />
      <el-alert v-if="dashboard.policy.maxReportAgeMinutes < 240" type="warning" :closable="false" class="warning" title="当前报表延迟阈值小于 240 分钟：系统会等待小时结束后至少 3 小时再判断，加上整点间隔，容易一直显示数据不足。建议将阈值设为 240～360 分钟后保存；系统不会自动放宽规则。" />
      <el-alert v-if="!dashboard.adgroups.length" type="warning" :closable="false" class="warning" title="当前账户没有可展示的营销单元。请检查腾讯授权、账户数据范围和下方接口能力状态。" />
      <el-alert v-for="(warning, index) in dashboard.warnings" :key="index" type="warning" :closable="false" :title="warning" class="warning" />
      <section v-if="canManagePolicy && policyDraft" class="content-panel policy-panel">
        <div class="panel-head"><h2>{{ dashboard.account.platform }}统一监控规则</h2><span>同渠道账户共用；仅提示异常，自动处置关闭</span></div>
        <div class="policy-grid"><label>启用定时只读轮询<el-switch v-model="policyDraft.enabled" /></label><label>消费金额异常阈值（元）<el-input-number v-model="policyDraft.spendThreshold" :min="0" :max="1000000" :step="50" /></label><label>空耗消费阈值（元）<el-input-number v-model="policyDraft.emptySpendThreshold" :min="0" :max="1000000" :step="50" /><small>零转化且消费达到阈值</small></label><label>实际转化成本阈值（元）<el-input-number v-model="policyDraft.cpaThreshold" :min="0" :max="1000000" :step="10" /></label><label>最大报表延迟（分钟）<el-input-number v-model="policyDraft.maxReportAgeMinutes" :min="30" :max="1440" :step="30" /></label></div>
        <div class="policy-footer"><span>自动处置：关闭 · 紧急停用：开启</span><el-button type="primary" :loading="policySaving" @click="savePolicy">保存规则</el-button></div>
      </section>
      <section class="content-panel report-note"><div><strong>{{ dashboard.granularity }}</strong><p>仅统计营销单元与创意；成本判断采用近 27 小时窗口内已稳定的小时记录。同一小时重复拉取会覆盖，不重复累计。</p></div><small>拉取时间：{{ dateTime(dashboard.fetchedAt) }}</small></section>
<section class="content-panel trend-panel"><h2>近 24 个已回传小时 · 消耗趋势</h2><div v-if="dashboard.trend.labels.length" class="trend-bars"><div v-for="(label,index) in dashboard.trend.labels" :key="label" class="trend-bar" :title="`${dateTime(label)} · ${money(dashboard.trend.spend[index])}`"><div :style="{ height: `${Math.max(3, dashboard.trend.spend[index] / maxSpend * 100)}%` }" /><span>{{ hourLabel(label) }}</span></div></div><el-empty v-else description="尚无可信的小时快照" :image-size="80" /></section>
      <section class="content-panel data-panel"><div class="panel-head"><h2>营销单元监控</h2><span>目标值仅来自当前营销单元出价；证据不足时不会建议调整</span></div><p class="mobile-scroll-hint">可左右滑动查看完整数据</p><div class="table-scroll"><el-table :data="pagedAdgroups" stripe><el-table-column label="营销单元" min-width="230"><template #default="{ row }"><strong>{{ row.name }}</strong><small class="block">ID {{ row.id }}</small></template></el-table-column><el-table-column label="平台状态" width="155"><template #default="{ row }"><div>{{ platformStatusLabel(row.configuredStatus) }}</div><small>{{ platformStatusLabel(row.systemStatus) }}</small></template></el-table-column><el-table-column label="目标成本" width="150"><template #default="{ row }"><strong>{{ moneyOrDash(row.targetCpa) }}</strong><small class="block">{{ targetSourceLabel(row.targetSource) }}</small></template></el-table-column><el-table-column label="实际成本" width="122"><template #default="{ row }">{{ moneyOrDash(row.actualCpa) }}</template></el-table-column><el-table-column label="实际/目标" width="120"><template #default="{ row }">{{ row.costRatio == null ? '—' : `${(row.costRatio * 100).toFixed(1)}%` }}</template></el-table-column><el-table-column label="观察期消费 / 转化" width="165"><template #default="{ row }">{{ moneyOrDash(row.spend) }} / {{ row.conversions ?? '—' }}</template></el-table-column><el-table-column label="判断、证据与建议" min-width="360"><template #default="{ row }"><el-tag :type="row.assessment.state === 'WARNING' ? 'danger' : row.assessment.state === 'NORMAL' ? 'success' : 'info'">{{ stateLabel(row.assessment.state) }}</el-tag><span class="evidence">{{ row.assessment.evidence }}</span><span class="evidence recommendation">{{ row.recommendation }}</span></template></el-table-column><el-table-column label="统计时段 / 同步" min-width="235"><template #default="{ row }"><div>{{ dateTime(row.reportPeriodStart) }}—{{ dateTime(row.reportPeriodEnd) }}</div><small>抓取 {{ dateTime(row.fetchedAt) }} · 已稳定 {{ row.evidenceHours }} 小时</small></template></el-table-column></el-table></div><el-pagination v-model:current-page="adgroupPage" :page-size="pageSize" :total="filteredAdgroups.length" layout="total,prev,pager,next" /></section>
      <section class="content-panel data-panel">
        <div class="panel-head"><h2>创意监控</h2><span>创意目标成本沿用所属营销单元；仅操作单条创意，不降级为暂停营销单元</span></div>
        <p class="mobile-scroll-hint">可左右滑动查看完整数据与人工操作</p>
        <div class="table-scroll"><el-table :data="pagedCreatives" stripe>
          <el-table-column label="创意" min-width="250"><template #default="{ row }"><strong>{{ row.name || '未命名' }}</strong><small class="block">ID {{ row.id }}</small></template></el-table-column>
          <el-table-column label="所属营销单元" min-width="210"><template #default="{ row }"><strong>{{ adgroupName(row.adgroupId) }}</strong><small class="block">{{ row.adgroupId }}</small></template></el-table-column>
          <el-table-column label="配置状态" min-width="125"><template #default="{ row }">{{ platformStatusLabel(row.configuredStatus) }}</template></el-table-column>
          <el-table-column label="审核状态" min-width="125"><template #default="{ row }">{{ platformStatusLabel(row.auditStatus) }}</template></el-table-column>
          <el-table-column label="目标 / 实际成本" min-width="165"><template #default="{ row }">{{ moneyOrDash(row.targetCpa) }} / {{ moneyOrDash(row.actualCpa) }}</template></el-table-column>
          <el-table-column label="观察期消费 / 转化" min-width="165"><template #default="{ row }">{{ moneyOrDash(row.spend) }} / {{ row.conversions ?? '—' }}</template></el-table-column>
          <el-table-column label="判断、证据与建议" min-width="380"><template #default="{ row }"><el-tag :type="row.assessment.state === 'WARNING' ? 'danger' : row.assessment.state === 'NORMAL' ? 'success' : 'info'">{{ stateLabel(row.assessment.state) }}</el-tag><span class="evidence">{{ row.assessment.evidence }}</span><span class="evidence recommendation">{{ row.recommendation }}</span><small class="block">{{ row.metricsStatus }}</small></template></el-table-column>
          <el-table-column v-if="canOperateStatus || canDelete" label="人工操作" width="250"><template #default="{ row }"><div class="action-buttons"><el-button v-if="canOperateStatus" size="small" :loading="statusBusyId === row.id" @click="changeCreativeStatus(row)">{{ row.configuredStatus === 'AD_STATUS_SUSPEND' ? '恢复创意' : '暂停创意' }}</el-button><el-button v-if="canOperateStatus && row.configuredStatus === 'AD_STATUS_SUSPEND'" size="small" @click="openSchedule(row)">定时开启</el-button><el-button v-if="canDelete" size="small" type="danger" plain :loading="statusBusyId === row.id" @click="deleteCreative(row)">删除创意</el-button></div></template></el-table-column>
        </el-table></div>
        <el-pagination v-model:current-page="creativePage" :page-size="pageSize" :total="filteredCreatives.length" layout="total,prev,pager,next" />
      </section>
      <section class="content-panel data-panel"><div class="panel-head"><h2>人工操作与定时任务</h2><span>仅显示最近 50 条；“腾讯已受理”和“回读确认”严格区分</span></div><div class="table-scroll"><el-table :data="actions" stripe><el-table-column prop="creativeId" label="创意 ID" min-width="160" /><el-table-column label="操作" min-width="140"><template #default="{ row }">{{ actionLabel(row.action) }}</template></el-table-column><el-table-column label="状态" min-width="170"><template #default="{ row }">{{ actionStatusLabel(row.status) }}</template></el-table-column><el-table-column label="计划 / 执行" min-width="205"><template #default="{ row }">{{ dateTime(row.scheduledAt || row.attemptedAt || null) }}</template></el-table-column><el-table-column prop="errorMessage" label="说明" min-width="270" /><el-table-column v-if="canOperateStatus || canDelete" label="核对 / 取消" min-width="145"><template #default="{ row }"><el-button v-if="row.id && row.status === 'UNKNOWN_NEEDS_REVIEW' && ((row.action === 'DELETE_CREATIVE' && canDelete) || (row.action !== 'DELETE_CREATIVE' && row.action !== 'SCHEDULE_RESUME_CREATIVE' && canOperateStatus))" size="small" @click="reconcileAction(row.id, row.action)">回读核对</el-button><el-button v-if="row.id && row.action === 'SCHEDULE_RESUME_CREATIVE' && row.status === 'SCHEDULED' && canOperateStatus" size="small" @click="cancelSchedule(row.id)">取消定时</el-button></template></el-table-column></el-table></div></section>
<details class="content-panel data-panel capability-details"><summary>逐接口能力验证 <span>点击展开 · 接口存在不等于账户已验证</span></summary><p class="mobile-scroll-hint">可左右滑动查看完整接口状态</p><div class="table-scroll"><el-table :data="dashboard.capabilities" size="small"><el-table-column label="腾讯接口" min-width="215"><template #default="{ row }"><span :title="row.endpoint">{{ endpointLabel(row.endpoint) }}</span></template></el-table-column><el-table-column label="接口存在" width="95"><template #default="{ row }">{{ row.interfaceExists ? '是' : '待核实' }}</template></el-table-column><el-table-column label="项目实现" width="95"><template #default="{ row }">{{ row.projectImplemented ? '是' : '未实现' }}</template></el-table-column><el-table-column label="目标账户" width="150"><template #default="{ row }"><el-tag :type="row.accountVerified ? 'success' : 'info'" size="small">{{ row.accountVerified ? (row.validationStatus === 'WRITE_READBACK_VERIFIED' ? '写入及回读已验证' : '只读已验证') : '未验证' }}</el-tag></template></el-table-column><el-table-column prop="safeNote" label="说明" min-width="270" /></el-table></div></details>
    </template>
    <el-dialog v-model="scheduleVisible" title="定时开启单条创意" width="min(92vw, 520px)">
      <p>腾讯账户：{{ dashboard?.account.name }}；创意 ID：{{ scheduleCreative?.id }}；营销单元：{{ scheduleCreative?.adgroupId }}。届时系统会重新核验账户权限与腾讯状态；上级营销单元暂停或审核未通过时，不代表实际开始投放。</p>
      <el-date-picker v-model="scheduledDate" type="datetime" placeholder="选择本地时间（1 分钟至 30 天后）" style="width:100%" />
      <template #footer><el-button @click="scheduleVisible=false">取消</el-button><el-button type="primary" :loading="scheduleBusy" @click="submitSchedule">确认设置</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { cancelSmartMonitorSchedule, changeSmartMonitorCreativeStatus, deleteSmartMonitorCreative, getSmartMonitorAccounts, getSmartMonitorActions, getSmartMonitorDashboard, reconcileSmartMonitorAction, reconcileSmartMonitorDeletion, saveSmartMonitorChannelPolicy, scheduleSmartMonitorCreativeResume, type SmartMonitorAccount, type SmartMonitorActionResult, type SmartMonitorDashboard, type SmartMonitorPolicy } from '../api/admin';
import { useAuthStore } from '../stores/auth';

const accounts = ref<SmartMonitorAccount[]>([]);
const selectedAccountId = ref('');
const dashboard = ref<SmartMonitorDashboard | null>(null);
const actions = ref<SmartMonitorActionResult[]>([]);
const keyword = ref('');
const healthFilter = ref('ALL');
const sortMode = ref('WARNING');
const adgroupPage = ref(1);
const creativePage = ref(1);
const pageSize = 20;
const loading = ref(false);
const policySaving = ref(false);
const statusBusyId = ref('');
const scheduleBusy = ref(false);
const scheduleVisible = ref(false);
const scheduledDate = ref<Date | null>(null);
const scheduleCreative = ref<SmartMonitorDashboard['creatives'][number] | null>(null);
const lastUnknownActionId = ref('');
const reconciling = ref(false);
const policyDraft = ref<SmartMonitorPolicy | null>(null);
const auth = useAuthStore();
const canManagePolicy = computed(() => auth.hasPermission('PROMOTION_SMART_MONITOR_AUTO'));
const canOperateStatus = computed(() => auth.hasPermission('PROMOTION_SMART_MONITOR_STATUS'));
const canDelete = computed(() => auth.hasPermission('PROMOTION_SMART_MONITOR_DELETE'));
const filteredAdgroups = computed(() => (dashboard.value?.adgroups || []).filter((item) => (healthFilter.value === 'ALL' || item.assessment.state === healthFilter.value) && (!keyword.value || `${item.name} ${item.id}`.toLowerCase().includes(keyword.value.toLowerCase()))));
const filteredCreatives = computed(() => (dashboard.value?.creatives || []).filter((item) => (healthFilter.value === 'ALL' || item.assessment.state === healthFilter.value) && (!keyword.value || `${item.name} ${item.id} ${item.adgroupId}`.toLowerCase().includes(keyword.value.toLowerCase()))));
type MonitorRow = { spend: number | null; actualCpa: number | null; assessment: { state: string } };
function orderRows<T extends MonitorRow>(rows: T[]) {
  const priority: Record<string, number> = { WARNING: 0, INSUFFICIENT: 1, NORMAL: 2 };
  return [...rows].sort((a, b) => sortMode.value === 'SPEND'
    ? (b.spend ?? -1) - (a.spend ?? -1)
    : sortMode.value === 'CPA' ? (b.actualCpa ?? -1) - (a.actualCpa ?? -1)
    : (priority[a.assessment.state] ?? 3) - (priority[b.assessment.state] ?? 3));
}
const pagedAdgroups = computed(() => orderRows(filteredAdgroups.value).slice((adgroupPage.value - 1) * pageSize, adgroupPage.value * pageSize));
const pagedCreatives = computed(() => orderRows(filteredCreatives.value).slice((creativePage.value - 1) * pageSize, creativePage.value * pageSize));
const adgroupName = (id: string) => dashboard.value?.adgroups.find(item => item.id === id)?.name || '营销单元名称未返回';
watch([keyword, healthFilter, sortMode, selectedAccountId, dashboard], () => { adgroupPage.value = 1; creativePage.value = 1; });
const maxSpend = computed(() => Math.max(1, ...(dashboard.value?.trend.spend || [])));
const money = (value: number) => `¥${value.toFixed(2)}`;
const moneyOrDash = (value: number | null) => value == null ? '—' : money(value);
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }) : '—';
const hourLabel = (value: string) => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false });
const stateLabel = (state: string) => state === 'WARNING' ? '阈值异常' : state === 'NORMAL' ? '正常' : '不足以判断';
const platformStatusLabel = (status?: string | null) => ({ AD_STATUS_NORMAL: '启用', AD_STATUS_SUSPEND: '暂停', ADGROUP_STATUS_ACTIVE: '投放中', ADGROUP_STATUS_NORMAL: '投放中', ADGROUP_STATUS_PENDING: '待审核', ADGROUP_STATUS_DELETED: '已删除', ADGROUP_STATUS_CREATIVE_EMPTY: '缺少创意', ADGROUP_STATUS_SUSPEND: '暂停', SMART_ADGROUP_STATUS_USING: '智能投放中', CREATIVE_SET_APPROVAL_STATUS_NORMAL: '审核通过', CREATIVE_SET_APPROVAL_STATUS_PENDING: '审核中', CREATIVE_SET_APPROVAL_STATUS_UNKNOWN: '审核状态待核实', CREATIVE_SET_APPROVAL_STATUS_PARTIAL_NORMAL: '部分审核通过', CREATIVE_SET_APPROVAL_STATUS_REJECTED: '审核拒绝', CREATIVE_SET_APPROVAL_STATUS_DENIED: '审核拒绝' } as Record<string, string>)[status || ''] || (status ? `未识别状态（${status}）` : '腾讯未返回状态');
const targetSourceLabel = (source?: string | null) => ({ bid_amount: '营销单元出价', deep_conversion_behavior_bid: '深度转化出价' } as Record<string, string>)[source || ''] || '来源待核实';
const endpointLabel = (endpoint: string) => ({ '/dynamic_creatives/get': '查询创意', '/dynamic_creative_review_results/get': '查询创意审核结果', '/dynamic_creatives/update': '更新创意状态', '/dynamic_creatives/delete': '删除创意', '/dynamic_creatives/add': '新建创意', '/adgroups/get': '查询营销单元', '/adgroups/update_configured_status': '更新营销单元状态', '/adgroups/update_datetime': '更新营销单元投放时间', '/daily_reports/get': '获取日报', '/hourly_reports/get': '获取小时报表' } as Record<string, string>)[endpoint] || '其他平台接口';
const actionLabel = (action?: string) => action === 'PAUSE_CREATIVE' ? '暂停创意' : action === 'RESUME_CREATIVE' ? '恢复创意' : action === 'SCHEDULE_RESUME_CREATIVE' ? '定时开启' : action === 'DELETE_CREATIVE' ? '删除创意' : action || '—';
const actionStatusLabel = (status: string) => ({ SCHEDULED: '等待到时执行', SUBMITTING: '正在提交', PLATFORM_ACCEPTED: '腾讯已受理', CONFIRMED: '回读确认', ALREADY_SET: '已处于目标状态', CANCELLED: '已取消', DELETED_CONFIRMED: '已删除并回读确认', FAILED: '失败', UNKNOWN_NEEDS_REVIEW: '结果不明，待人工核对' } as Record<string,string>)[status] || '状态待核实';
let dashboardSequence = 0;
async function loadDashboard() {
  const accountId = selectedAccountId.value;
  const sequence = ++dashboardSequence;
  dashboard.value = null; policyDraft.value = null; actions.value = []; lastUnknownActionId.value = '';
  scheduleVisible.value = false; scheduleCreative.value = null;
  if (!accountId) { loading.value = false; return; }
  loading.value = true;
  try {
    const result = await getSmartMonitorDashboard(accountId);
    if (sequence !== dashboardSequence || accountId !== selectedAccountId.value) return;
    dashboard.value = result; policyDraft.value = { ...result.policy };
    const records = await getSmartMonitorActions(accountId);
    if (sequence === dashboardSequence && accountId === selectedAccountId.value) actions.value = records;
  } catch { if (sequence === dashboardSequence) ElMessage.error(dashboard.value ? '监控数据已读取，但操作记录读取失败，请刷新后重试' : '监控数据加载失败，请检查账户权限与腾讯授权'); }
  finally { if (sequence === dashboardSequence) loading.value = false; }
}
async function savePolicy() {
  if (!selectedAccountId.value || !policyDraft.value || !canManagePolicy.value || policySaving.value) return;
  const accountId = selectedAccountId.value;
  policySaving.value = true;
  try {
    const { enabled, spendThreshold, emptySpendThreshold, cpaThreshold, maxReportAgeMinutes } = policyDraft.value;
    await saveSmartMonitorChannelPolicy(dashboard.value!.account.platform, { enabled, spendThreshold, emptySpendThreshold, cpaThreshold, maxReportAgeMinutes });
    if (accountId !== selectedAccountId.value) return;
    ElMessage.success('渠道统一规则已保存；正在刷新营销单元与创意监控数据');
    await loadDashboard();
  } catch { ElMessage.error('规则保存失败，请检查账户授权与权限'); }
  finally { policySaving.value = false; }
}
async function changeCreativeStatus(row: SmartMonitorDashboard['creatives'][number]) {
  if (!selectedAccountId.value || !canOperateStatus.value || statusBusyId.value) return;
  const accountId = selectedAccountId.value;
  const desired = row.configuredStatus === 'AD_STATUS_SUSPEND' ? 'AD_STATUS_NORMAL' : 'AD_STATUS_SUSPEND';
  const verb = desired === 'AD_STATUS_SUSPEND' ? '暂停' : '恢复';
  try {
    await ElMessageBox.confirm(`确认${verb}腾讯账户“${dashboard.value?.account.name}”的创意“${row.name || row.id}”（ID ${row.id}，营销单元 ${row.adgroupId}）？此操作仅作用于该创意，可能影响实际投放。`, `${verb}单条创意`, { type: 'warning', confirmButtonText: `确认${verb}`, cancelButtonText: '取消' });
  } catch { return; }
  if (accountId !== selectedAccountId.value || statusBusyId.value) return;
  statusBusyId.value = row.id;
  try {
    const result = await changeSmartMonitorCreativeStatus(accountId, row.id, desired, crypto.randomUUID(), `智能监控页面人工${verb}`);
    if (accountId !== selectedAccountId.value) return;
    if (result.status === 'CONFIRMED' || result.status === 'ALREADY_SET') ElMessage.success(`腾讯创意状态已回读确认：${verb}`);
    else { if (result.id && result.status === 'UNKNOWN_NEEDS_REVIEW') lastUnknownActionId.value = result.id; ElMessage.warning(`操作未确认：${actionStatusLabel(result.status)}。请核对腾讯后台；系统不会自动重发。`); }
    await loadDashboard();
  } catch { ElMessage.error('创意状态操作失败；请先核对腾讯后台状态，勿重复点击'); }
  finally { statusBusyId.value = ''; }
}
function openSchedule(row: SmartMonitorDashboard['creatives'][number]) { if (!canOperateStatus.value || loading.value) return; scheduleCreative.value = row; scheduledDate.value = null; scheduleVisible.value = true; }
async function refreshActions(accountId: string) {
  const sequence = dashboardSequence;
  const records = await getSmartMonitorActions(accountId);
  if (accountId === selectedAccountId.value && sequence === dashboardSequence) actions.value = records;
}
async function submitSchedule() {
  if (scheduleBusy.value || !canOperateStatus.value) return;
  const accountId = selectedAccountId.value;
  const row = scheduleCreative.value;
  if (!selectedAccountId.value || !row || !scheduledDate.value || scheduledDate.value.getTime() < Date.now() + 60_000 || scheduledDate.value.getTime() > Date.now() + 30 * 86_400_000) {
    ElMessage.warning('请选择 1 分钟至 30 天后的时间'); return;
  }
  scheduleBusy.value = true;
  try {
    const result = await scheduleSmartMonitorCreativeResume(accountId, row.id, scheduledDate.value.toISOString(), crypto.randomUUID(), '智能监控页面人工设置定时开启');
    if (accountId !== selectedAccountId.value) return;
    if (result.status === 'SCHEDULED') { ElMessage.success('定时任务已持久化；执行后仍需腾讯回读确认'); scheduleVisible.value = false; await refreshActions(accountId); }
    else ElMessage.warning(`定时任务状态：${actionStatusLabel(result.status)}`);
  } catch { ElMessage.error('设置失败；请检查创意当前状态、账户权限及已有定时任务'); }
  finally { scheduleBusy.value = false; }
}
async function reconcileLastAction() {
  if (!lastUnknownActionId.value || !selectedAccountId.value || reconciling.value) return;
  const accountId = selectedAccountId.value;
  reconciling.value = true;
  try { const result = await reconcileSmartMonitorAction(accountId, lastUnknownActionId.value); if (accountId !== selectedAccountId.value) return; if (result.status === 'CONFIRMED') { lastUnknownActionId.value = ''; ElMessage.success('腾讯状态已回读确认'); await loadDashboard(); } else ElMessage.warning('腾讯状态仍不一致，请人工核对，勿重复操作'); }
  catch { ElMessage.error('核对失败，请稍后重试'); }
  finally { reconciling.value = false; }
}
async function reconcileAction(actionId: string, action?: string) {
  if (!selectedAccountId.value) return;
  const accountId = selectedAccountId.value;
  try { const result = action === 'DELETE_CREATIVE' ? await reconcileSmartMonitorDeletion(accountId, actionId) : await reconcileSmartMonitorAction(accountId, actionId); if (accountId !== selectedAccountId.value) return; const confirmed = result.status === 'CONFIRMED' || result.status === 'DELETED_CONFIRMED'; ElMessage[confirmed ? 'success' : 'warning'](confirmed ? '已回读确认' : '尚未回读一致，禁止重复提交'); await refreshActions(accountId); }
  catch { ElMessage.error('回读核对失败'); }
}
async function deleteCreative(row: SmartMonitorDashboard['creatives'][number]) {
  if (!selectedAccountId.value || !canDelete.value || statusBusyId.value) return;
  const accountId = selectedAccountId.value;
  let typed: string;
  try {
    const result = await ElMessageBox.prompt(`将从腾讯账户“${dashboard.value?.account.name}”删除创意“${row.name || row.id}”（ID ${row.id}，营销单元 ${row.adgroupId}）。删除不可恢复，可能立即造成投放空档；请输入完整创意 ID 再确认。`, '不可逆操作：删除创意', { type: 'error', confirmButtonText: '确认删除', cancelButtonText: '取消', inputPattern: new RegExp(`^${row.id}$`), inputErrorMessage: '创意 ID 不一致' });
    typed = result.value;
  } catch { return; }
  if (accountId !== selectedAccountId.value || statusBusyId.value) return;
  statusBusyId.value = row.id;
  try {
    const result = await deleteSmartMonitorCreative(accountId, row.id, typed, crypto.randomUUID(), '智能监控页面人工删除');
    if (accountId !== selectedAccountId.value) return;
    if (result.status === 'DELETED_CONFIRMED') ElMessage.success('腾讯后台已回读确认该创意删除');
    else ElMessage.warning(`删除未确认：${actionStatusLabel(result.status)}。禁止重复点击，请在操作记录中回读核对。`);
    await loadDashboard();
  } catch { ElMessage.error('删除请求未完成；请先查看操作记录并核对腾讯后台，勿重复提交'); }
  finally { statusBusyId.value = ''; }
}
async function cancelSchedule(actionId: string) {
  if (!selectedAccountId.value) return;
  const accountId = selectedAccountId.value;
  try { await ElMessageBox.confirm('仅能取消尚未开始的定时任务。确认取消？', '取消定时开启', { type: 'warning' }); }
  catch { return; }
  if (accountId !== selectedAccountId.value) return;
  try { await cancelSmartMonitorSchedule(accountId, actionId); if (accountId !== selectedAccountId.value) return; ElMessage.success('定时任务已取消'); await refreshActions(accountId); }
  catch { ElMessage.error('取消失败：任务可能已经开始执行，请查看最新状态'); }
}
onMounted(async () => { try { accounts.value = await getSmartMonitorAccounts(); if (accounts.value.length) { selectedAccountId.value = accounts.value[0].id; await loadDashboard(); } } catch { ElMessage.error('无法读取可见腾讯账户'); } });
</script>

<style scoped>
.capability-details summary{cursor:pointer;font-weight:600;min-height:32px;line-height:1.7;overflow-wrap:anywhere}.capability-details summary span{font-size:12px;color:var(--admin-text-muted);font-weight:400}.capability-details[open] summary{margin-bottom:14px}
.smart-monitor{display:grid;gap:16px;min-width:0;max-width:100%}.page-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.page-heading h1{margin:4px 0;font-size:27px;color:var(--admin-text)}.page-heading p{margin:0;color:var(--admin-text-muted)}.eyebrow{font-size:12px;color:var(--el-color-primary);font-weight:700}.content-panel{min-width:0;border:1px solid var(--admin-border);border-radius:12px;background:#fff;padding:16px}.toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.account-select{width:280px}.search-input{width:280px}.health-select{width:160px}.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.summary{display:grid;gap:4px}.summary span,.summary small{color:var(--admin-text-muted);font-size:12px}.summary strong{font-size:20px;color:var(--admin-text)}.warning{margin:0}.report-note{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#f5f9fd}.report-note p{margin:5px 0 0;font-size:12px;color:var(--admin-text-muted)}.report-note small{white-space:nowrap;color:var(--admin-text-muted)}.trend-panel h2,.panel-head h2{margin:0;font-size:17px;color:var(--admin-text)}.trend-bars{display:flex;align-items:flex-end;gap:5px;height:135px;overflow-x:auto;padding:12px 0 0}.trend-bar{flex:1 0 28px;min-width:28px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;font-size:10px;color:var(--admin-text-muted)}.trend-bar>div{width:70%;max-width:28px;min-height:3px;border-radius:4px 4px 0 0;background:#4787b8}.trend-bar span{line-height:1.3;text-align:center;margin-top:3px}.panel-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px}.panel-head span{color:var(--admin-text-muted);font-size:12px}.table-scroll{width:100%;min-width:0;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:thin}.table-scroll :deep(.el-table){min-width:980px}.block{display:block;color:var(--admin-text-muted);font-size:12px}.evidence{display:block;margin-top:5px;white-space:normal;line-height:1.45}.recommendation{color:var(--admin-primary);font-weight:600}.data-panel strong{word-break:break-word}.mobile-scroll-hint{display:none}
.policy-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;align-items:start}.policy-grid label{display:grid;gap:6px;align-content:start;grid-template-rows:20px auto auto;min-width:0;font-size:13px;color:var(--admin-text-muted)}.policy-grid :deep(.el-input-number){width:100%}.policy-grid :deep(.el-switch){align-self:center}.policy-grid small{line-height:1.4}.policy-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;color:var(--admin-text-muted);font-size:12px}
.action-buttons{display:flex;gap:6px;flex-wrap:wrap}.action-buttons :deep(.el-button){margin-left:0;max-width:100%}
@media(max-width:760px){.page-heading{align-items:flex-start}.page-heading h1{font-size:23px}.content-panel{padding:12px}.toolbar{display:grid;grid-template-columns:1fr 1fr}.account-select,.search-input{grid-column:1/-1;width:100%}.health-select{width:100%}.toolbar .el-button{width:100%;min-height:40px}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.summary strong{font-size:17px;overflow-wrap:anywhere}.report-note{display:block}.report-note strong,.report-note p{overflow-wrap:anywhere}.report-note small{display:block;margin-top:8px;white-space:normal}.panel-head{display:block}.panel-head span{display:block;margin-top:5px}.trend-bar{flex-basis:35px}.policy-footer{align-items:stretch;flex-direction:column}.policy-footer .el-button{min-height:42px}.mobile-scroll-hint{display:block;margin:0 0 8px;color:var(--admin-text-muted);font-size:12px}.table-scroll :deep(.el-table){min-width:1120px}.table-scroll :deep(.cell){white-space:normal;word-break:break-word}.data-panel{overflow:hidden}}
</style>
