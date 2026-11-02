<template>
  <section class="group-notify-page">
    <div class="page-heading"><div><h1 class="page-title">微信群挂号通知</h1><p>按留资页面绑定目标微信群。当前仅展示接入准备状态，真实发送验证前不会启用群通知。</p></div><div class="heading-actions"><el-button @click="router.push('/wechat-group-notifications/sender')">设置专用微信账号</el-button><el-button :loading="loading" @click="load">刷新状态</el-button></div></div>
    <el-alert v-if="overview && !overview.transportReady" :title="overview.blocker" type="warning" show-icon :closable="false" class="blocker" />
    <div class="summary-grid">
      <article class="content-panel summary"><h2>发送微信账号</h2><p v-if="!overview?.senders.length">尚未接入已验证的专用微信发送端</p><div v-for="sender in overview?.senders || []" :key="sender.id"><el-tag :type="sender.status === 'ONLINE' ? 'success' : 'warning'">{{ sender.status === 'ONLINE' ? '已登录' : '不可用 / 离线' }}</el-tag><span>{{ sender.nickname || '未识别账号' }}</span><small>最近心跳：{{ formatTime(sender.lastHeartbeatAt) }}</small></div><p class="hint">公众号扫码登录不用于此处；发送端必须在已登录的交互式桌面会话中运行。</p></article>
      <article class="content-panel summary"><h2>目标微信群</h2><p v-if="!overview?.groups.length">尚无经过稳定群标识验证的目标群</p><div v-for="group in overview?.groups || []" :key="group.id"><strong>{{ group.nameSnapshot }}</strong><el-tag :type="group.verified ? 'success' : 'warning'">{{ group.verified ? '已验证' : '未验证' }}</el-tag></div><p class="hint">为防重名群误投，不能仅按群名称绑定。</p></article>
    </div>
    <article class="content-panel routes"><h2>留资页面路由</h2><p class="hint">仅以挂号记录保存的留资页面 ID 匹配；未配置路由不影响现有公众号、小程序及回访通知。</p><div class="table-scroll"><el-table :data="pageRows" v-loading="loading" stripe><el-table-column prop="name" label="留资页面" min-width="180" show-overflow-tooltip /><el-table-column prop="pageKey" label="页面标识" min-width="140" show-overflow-tooltip /><el-table-column label="状态" width="110"><template #default="scope"><el-tag :type="scope.row.status === 'ACTIVE' ? 'success' : 'info'">{{ scope.row.status === 'ACTIVE' ? '已启用' : '已停用' }}</el-tag></template></el-table-column><el-table-column label="群路由" min-width="200"><template #default="scope">{{ routeText(scope.row.id) }}</template></el-table-column></el-table></div></article>
    <article v-if="auth.hasPermission('WECHAT_GROUP_NOTIFY_RECORDS')" class="content-panel records"><div class="section-heading"><h2>发送记录</h2><el-button :loading="recordsLoading" @click="loadRecords">刷新</el-button></div><div class="table-scroll"><el-table :data="records.list" v-loading="recordsLoading" stripe><el-table-column prop="appointment.appointmentNo" label="挂号编号" min-width="160" /><el-table-column prop="route.landingPage.name" label="留资页面" min-width="150" show-overflow-tooltip /><el-table-column prop="group.nameSnapshot" label="目标群" min-width="150" show-overflow-tooltip /><el-table-column label="状态" min-width="110"><template #default="scope">{{ statusText(scope.row.status) }}</template></el-table-column><el-table-column prop="attemptCount" label="尝试次数" width="95" /><el-table-column label="入队时间" min-width="170"><template #default="scope">{{ formatTime(scope.row.createdAt) }}</template></el-table-column><el-table-column prop="lastErrorMessage" label="脱敏错误" min-width="220" show-overflow-tooltip /></el-table></div><el-pagination v-if="records.total" v-model:current-page="recordPage" :page-size="20" :total="records.total" layout="prev, pager, next" @current-change="loadRecords" /></article>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { http } from '../api/http';
import { useAuthStore } from '../stores/auth';

interface Sender { id: string; status: string; nickname: string | null; lastHeartbeatAt: string | null }
interface Group { id: string; nameSnapshot: string; verified: boolean }
interface Page { id: string; name: string; pageKey: string; status: string }
interface Route { id: string; landingPageId: string; groupId: string; enabled: boolean }
interface Overview { transportReady: boolean; blocker: string; senders: Sender[]; groups: Group[]; pages: Page[]; routes: Route[] }
interface RecordRow { id: string; status: string; attemptCount: number; createdAt: string; lastErrorMessage: string | null; appointment: { appointmentNo: string }; group: { nameSnapshot: string }; route: { landingPage: { name: string } } }
const auth = useAuthStore();
const router = useRouter();
const overview = ref<Overview | null>(null);
const records = ref<{ total: number; list: RecordRow[] }>({ total: 0, list: [] });
const loading = ref(false);
const recordsLoading = ref(false);
const recordPage = ref(1);
const pageRows = computed(() => overview.value?.pages || []);
const statusNames: Record<string, string> = { PENDING: '待发送', SENDING: '发送中', SENT_BY_CLIENT: '客户端已显示', GROUP_CONFIRMED: '群成员已确认', FAILED: '明确失败', UNKNOWN: '结果不明', SKIPPED: '已跳过' };
const statusText = (status: string) => statusNames[status] || status;
const formatTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString('zh-CN') : '暂无';
function routeText(pageId: string) {
  const rows = (overview.value?.routes || []).filter((route) => route.landingPageId === pageId);
  if (!rows.length) return '未配置（不发送群通知）';
  return rows.map((route) => `${overview.value?.groups.find((group) => group.id === route.groupId)?.nameSnapshot || '未知群'}（${route.enabled ? '启用' : '停用'}）`).join('、');
}
async function load() {
  loading.value = true;
  try { overview.value = await http.get('/api/admin/wechat-group-notifications/overview') as unknown as Overview; }
  finally { loading.value = false; }
}
async function loadRecords() {
  recordsLoading.value = true;
  try { records.value = await http.get('/api/admin/wechat-group-notifications/deliveries', { params: { page: recordPage.value, pageSize: 20 } }) as unknown as typeof records.value; }
  finally { recordsLoading.value = false; }
}
onMounted(() => { void load(); if (auth.hasPermission('WECHAT_GROUP_NOTIFY_RECORDS')) void loadRecords(); });
</script>

<style scoped>
.group-notify-page { min-width: 0; }
.blocker { margin: 14px 0; }
.summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 16px 0; }
.summary, .routes, .records { padding: 20px; min-width: 0; }
.summary h2, .routes h2, .records h2 { margin: 0 0 12px; font-size: 18px; }
.summary span, .summary small { margin-left: 8px; }
.hint { color: #6e6e73; line-height: 1.6; }
.table-scroll { width: 100%; overflow-x: auto; }
.table-scroll :deep(.el-table) { min-width: 720px; }
.records { margin-top: 16px; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.heading-actions { display: flex; flex-wrap: wrap; gap: 8px; }
@media (max-width: 768px) { .summary-grid { grid-template-columns: 1fr; } .summary, .routes, .records { padding: 14px; } .page-heading { flex-wrap: wrap; } }
</style>
