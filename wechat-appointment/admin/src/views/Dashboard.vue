<template>
  <div class="dashboard-heading">
    <div>
      <h1 class="page-title">仪表盘</h1>
    </div>
    <div class="dashboard-actions"><el-button @click="moduleDrawer=true">自定义模块</el-button><span class="updated-at">数据实时更新</span></div>
  </div>
  <el-alert v-if="dashboardError" :title="dashboardError" type="warning" show-icon :closable="false" class="dashboard-error"><el-button link type="primary" @click="loadDashboardData">重试加载</el-button></el-alert>

  <section class="content-panel todos-panel"><div class="panel-heading"><h3>待办事项</h3><div class="todo-heading-actions"><el-button @click="completedDialog=true">已完成事项{{ completedTodos.length ? `（${completedTodos.length}）` : '' }}</el-button><el-button type="primary" @click="showTodoForm=!showTodoForm">{{ showTodoForm ? '收起' : '添加待办' }}</el-button></div></div><div class="todo-grid">
    <article v-if="showTodoForm" class="todo-card todo-create"><el-input v-model="todoForm.title" maxlength="200" placeholder="待办内容" /><el-date-picker v-model="todoForm.dueAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="指定日期和时间" style="width:100%" /><div class="todo-create-actions"><el-select v-model="todoForm.priority"><el-option label="普通" value="NORMAL" /><el-option label="低" value="LOW" /><el-option label="高" value="HIGH" /><el-option label="紧急" value="URGENT" /></el-select><el-button type="primary" :loading="todoSaving" @click="addTodo">保存</el-button></div></article>
    <article v-for="todo in activeTodos" :key="todo.id" class="todo-card" :class="`todo-${todo.priority.toLowerCase()}`"><div class="todo-card-top"><el-tag :type="priorityTag(todo.priority)" size="small">{{ priorityLabel(todo.priority) }}</el-tag><el-button link type="danger" @click="removeTodo(todo.id)">删除</el-button></div><strong class="todo-title">{{ todo.title }}</strong><div class="todo-card-bottom"><time>{{ formatDue(todo.dueAt) }}</time><el-checkbox :model-value="false" @change="toggleTodo(todo)">已完成</el-checkbox></div></article>
  </div><el-empty v-if="!activeTodos.length && !showTodoForm" description="暂无待办事项" :image-size="64" /></section>
  <el-dialog v-model="completedDialog" title="已完成事项" width="min(760px, 94vw)"><div v-if="completedTodos.length" class="todo-dialog-grid"><article v-for="todo in completedTodos" :key="todo.id" class="todo-card completed" :class="`todo-${todo.priority.toLowerCase()}`"><div class="todo-card-top"><el-tag :type="priorityTag(todo.priority)" size="small">{{ priorityLabel(todo.priority) }}</el-tag><el-button link type="danger" @click="removeTodo(todo.id)">删除</el-button></div><strong class="todo-title">{{ todo.title }}</strong><div class="todo-card-bottom"><time>{{ formatDue(todo.dueAt) }}</time><el-checkbox :model-value="true" @change="toggleTodo(todo)">已完成</el-checkbox></div></article></div><el-empty v-else description="暂无已完成事项" :image-size="64" /></el-dialog>

  <section v-if="selectedMenuModules.length" class="dashboard-embedded-modules">
    <article v-for="item in selectedMenuModules" :key="item.path" class="content-panel embedded-module">
      <div class="panel-heading embedded-module-heading"><h3>{{ item.title }}</h3><RouterLink :to="item.path">打开完整页面 →</RouterLink></div>
      <DashboardPagePreview :path="item.path" :title="item.title" />
    </article>
  </section>
  <el-drawer v-model="moduleDrawer" title="自定义仪表盘" size="min(480px, 100vw)"><div class="module-picker"><h3>仪表盘内容</h3><el-checkbox-group v-model="modules" class="module-options" @change="saveModules"><el-checkbox label="METRICS">数据概览</el-checkbox><el-checkbox label="TREND">挂号趋势</el-checkbox><el-checkbox label="RECENT">最近挂号</el-checkbox></el-checkbox-group><h3>添加左侧菜单页面</h3><el-input v-model="moduleSearch" clearable placeholder="搜索页面" /><el-checkbox-group v-model="modules" @change="saveModules"><div v-for="group in filteredMenuGroups" :key="group.name" class="module-group"><h4>{{ group.name }}</h4><div class="module-options"><el-checkbox v-for="item in group.items" :key="item.path" :label="`PAGE:${item.path}`">{{ item.title }}</el-checkbox></div></div></el-checkbox-group></div></el-drawer>

  <div v-if="modules.includes('METRICS')" class="metric-grid">
    <div class="metric metric--primary">
      <div class="metric-top"><span class="muted">今日挂号数</span><el-icon><Calendar /></el-icon></div>
      <div class="metric-value">{{ data.todayCount || 0 }}</div>
      <small>今日新增预约</small>
    </div>
    <div class="metric">
      <div class="metric-top"><span class="muted">总挂号数</span><el-icon><Tickets /></el-icon></div>
      <div class="metric-value">{{ data.totalCount || 0 }}</div>
      <small>全部预约记录</small>
    </div>
    <div class="metric metric--warning">
      <div class="metric-top"><span class="muted">待联系</span><el-icon><Phone /></el-icon></div>
      <div class="metric-value">{{ data.pendingCount || 0 }}</div>
      <small>需要尽快跟进</small>
    </div>
    <div class="metric metric--success">
      <div class="metric-top"><span class="muted">已确认</span><el-icon><CircleCheck /></el-icon></div>
      <div class="metric-value">{{ data.confirmedCount || 0 }}</div>
      <small>已确认预约</small>
    </div>
    <div class="metric">
      <div class="metric-top"><span class="muted">通知成功率</span><el-icon><Bell /></el-icon></div>
      <div class="metric-value">{{ successRate }}</div>
      <small>消息送达情况</small>
    </div>
  </div>

  <div v-if="modules.includes('TREND')" class="content-panel trend-panel">
    <div class="panel-heading">
      <div>
        <h3>最近 7 天挂号趋势</h3>
        <p>每日新增预约数量</p>
      </div>
      <span class="legend"><i />挂号数量</span>
    </div>
    <div v-if="trend.length" class="bars">
      <div v-for="item in trend" :key="item.date" class="bar-row">
        <span>{{ item.date }}</span>
        <div class="bar"><i :style="{ width: barWidth(item.count) }" /></div>
        <b>{{ item.count }}</b>
      </div>
    </div>
    <el-empty v-else description="暂无趋势数据" :image-size="72" />
  </div>

  <div v-if="modules.includes('RECENT')" class="content-panel recent">
    <div class="panel-heading">
      <div>
        <h3>最近挂号记录</h3>
        <p>最新提交的预约信息</p>
      </div>
      <el-button text type="primary" @click="$router.push('/appointments')">查看全部<el-icon><ArrowRight /></el-icon></el-button>
    </div>
    <el-table :data="recent" empty-text="暂无挂号记录">
      <el-table-column prop="appointmentNo" label="编号" width="170" />
      <el-table-column prop="name" label="姓名" />
      <el-table-column prop="phoneMasked" label="手机号" />
      <el-table-column prop="missingTeethType" label="缺牙情况" />
      <el-table-column prop="statusText" label="状态">
        <template #default="{ row }"><span class="status-pill">{{ row.statusText }}</span></template>
      </el-table-column>
      <el-table-column prop="createdAt" label="提交时间" width="190" />
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ArrowRight, Bell, Calendar, CircleCheck, Phone, Tickets } from '@element-plus/icons-vue';
import DashboardPagePreview from '../components/DashboardPagePreview.vue';
import { ElMessage } from 'element-plus';
import { createDashboardTodo, deleteDashboardTodo, getDashboard, getDashboardPreferences, getDashboardTodos, saveDashboardPreferences, updateDashboardTodo, type DashboardModule, type DashboardTodo } from '../api/admin';
import { dashboardMenuGroups } from '../constants/dashboardMenuModules';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';

const auth = useAuthStore();
const router = useRouter();
const data = ref<Record<string, any>>({});
const dashboardError = ref('');
const modules = ref<DashboardModule[]>(['METRICS', 'TREND', 'RECENT']);
const todos = ref<DashboardTodo[]>([]);
const activeTodos = computed(() => todos.value.filter(todo => !todo.completed));
const completedTodos = computed(() => todos.value.filter(todo => todo.completed));
const showTodoForm = ref(false);
const completedDialog = ref(false);
const moduleDrawer = ref(false);
const moduleSearch = ref('');
const todoSaving = ref(false);
const todoForm = reactive<{ title: string; dueAt: string; priority: DashboardTodo['priority'] }>({ title: '', dueAt: '', priority: 'NORMAL' });
const priorityLabel = (value: DashboardTodo['priority']) => ({ LOW: '低', NORMAL: '普通', HIGH: '高', URGENT: '紧急' })[value];
const priorityTag = (value: DashboardTodo['priority']) => ({ LOW: 'info', NORMAL: 'primary', HIGH: 'warning', URGENT: 'danger' } as const)[value];
const formatDue = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false });
async function saveModules() { try { modules.value = (await saveDashboardPreferences(modules.value)).modules; } catch { ElMessage.error('模块设置保存失败'); } }
async function addTodo() { if (!todoForm.title.trim() || !todoForm.dueAt) return ElMessage.warning('请填写待办内容和时间'); todoSaving.value = true; try { await createDashboardTodo({ title: todoForm.title.trim(), dueAt: new Date(todoForm.dueAt).toISOString(), priority: todoForm.priority }); todos.value = await getDashboardTodos(); todoForm.title = ''; todoForm.dueAt = ''; showTodoForm.value = false; } finally { todoSaving.value = false; } }
async function toggleTodo(todo: DashboardTodo) { await updateDashboardTodo(todo.id, { completed: !todo.completed }); todos.value = await getDashboardTodos(); }
async function removeTodo(id: string) { await deleteDashboardTodo(id); todos.value = await getDashboardTodos(); }
const trend = computed(() => (data.value.trend || []) as Array<{ date: string; count: number }>);
const recent = computed(() => data.value.recentAppointments || []);
const successRate = computed(() => `${Math.round(Number(data.value.notificationSuccessRate || 0) * 100)}%`);
const maxTrendCount = computed(() => Math.max(1, ...trend.value.map((item) => item.count)));
const permittedMenuGroups = computed(() => dashboardMenuGroups.map(group => ({ ...group, items: group.items.filter(item => {
  const route = router.resolve(item.path);
  if (!route.matched.length || route.path !== item.path) return false;
  const permission = String(route.matched[route.matched.length - 1].meta.permission || '');
  return !permission || auth.hasPermission(permission);
}) })).filter(group => group.items.length));
const filteredMenuGroups = computed(() => permittedMenuGroups.value.map(group => ({ ...group, items: group.items.filter(item => item.title.includes(moduleSearch.value.trim())) })).filter(group => group.items.length));
const selectedMenuModules = computed(() => permittedMenuGroups.value.flatMap(group => group.items.filter(item => modules.value.includes(`PAGE:${item.path}`)).map(item => ({ ...item, group: group.name }))));

function barWidth(count: number) {
  return `${Math.max(3, Math.round((count / maxTrendCount.value) * 100))}%`;
}

async function loadDashboardData() {
  try { data.value = await getDashboard(); dashboardError.value = ''; }
  catch { dashboardError.value = '仪表盘数据加载失败，请重试'; }
}
onMounted(async () => {
  const [dashboard, preferences, todoRows] = await Promise.allSettled([getDashboard(), getDashboardPreferences(), getDashboardTodos()]);
  if (dashboard.status === 'fulfilled') data.value = dashboard.value;
  else dashboardError.value = '仪表盘数据加载失败，请重试';
  if (preferences.status === 'fulfilled') modules.value = preferences.value.modules;
  if (todoRows.status === 'fulfilled') todos.value = todoRows.value;
});
</script>

<style scoped>
.dashboard-heading,
.panel-heading,
.metric-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dashboard-heading {
  margin-bottom: 18px;
}

.dashboard-heading .page-title {
  margin-bottom: 2px;
}

.dashboard-heading p,
.panel-heading p {
  margin: 0;
  color: var(--admin-text-muted);
  font-size: 13px;
}

.updated-at {
  padding: 5px 9px;
  color: #4e6964;
  background: #edf5f3;
  border: 1px solid #d8e8e4;
  border-radius: 4px;
  font-size: 12px;
}

.metric-top .el-icon {
  width: 32px;
  height: 32px;
  color: var(--admin-primary);
  background: var(--admin-primary-soft);
  border-radius: 6px;
}

.metric small {
  display: block;
  margin-top: 8px;
  color: var(--admin-text-muted);
}

.metric--warning .metric-top .el-icon,
.metric--warning::after {
  color: #b45309;
  background: #fff4df;
}

.metric--success .metric-top .el-icon,
.metric--success::after {
  color: #15803d;
  background: #e8f6ec;
}

.panel-heading {
  margin-bottom: 18px;
}

.panel-heading h3 {
  margin: 0 0 3px;
}

.legend {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--admin-text-secondary);
  font-size: 12px;
}

.legend i {
  width: 18px;
  height: 5px;
  background: var(--admin-primary);
  border-radius: 3px;
}

.bars {
  display: grid;
  gap: 13px;
}

.bar-row {
  display: grid;
  grid-template-columns: 88px 1fr 38px;
  align-items: center;
  gap: 14px;
  color: var(--admin-text-secondary);
  font-size: 13px;
}

.bar-row b {
  color: var(--admin-text);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.bar {
  height: 9px;
  overflow: hidden;
  background: #edf2f0;
  border-radius: 5px;
}

.bar i {
  display: block;
  height: 100%;
  background: var(--admin-primary);
  border-radius: 5px;
  transition: width 300ms ease;
}

.recent {
  margin-top: 16px;
}
.dashboard-actions { display:flex; align-items:center; gap:10px; }
.module-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; }.module-options :deep(.el-checkbox){min-width:0;margin-right:0}
.todos-panel { margin-bottom:16px; }.todos-panel>.panel-heading{gap:8px;flex-wrap:wrap}
.todo-grid{display:flex;gap:12px;overflow-x:auto;overflow-y:hidden;padding-bottom:6px;scrollbar-width:thin}.todo-grid>.todo-card{flex:0 0 260px}.todo-heading-actions{display:flex;align-items:center;gap:8px}.todo-heading-actions .el-button+.el-button{margin-left:0}.todo-dialog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:12px;max-height:60vh;overflow-y:auto;padding:2px}
.todo-card{display:flex;flex-direction:column;gap:14px;min-width:0;min-height:145px;padding:14px;border:1px solid var(--admin-border);border-top:4px solid #7b9ab0;border-radius:10px;background:#fff}
.todo-card.todo-low{border-top-color:#8aa0af}.todo-card.todo-high{border-top-color:#d29245}.todo-card.todo-urgent{border-top-color:#c74b4b}.todo-card.completed{opacity:.62}.todo-card.completed .todo-title{text-decoration:line-through}
.todo-card-top,.todo-card-bottom,.todo-create-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}.todo-title{min-width:0;overflow-wrap:anywhere;line-height:1.5}.todo-card time{color:var(--admin-text-muted);font-size:12px;overflow-wrap:anywhere}.todo-card-bottom{margin-top:auto}.todo-create{border-style:dashed;background:var(--admin-bg-subtle,#f8fafc)}.todo-create-actions .el-select{min-width:0;flex:1}
.dashboard-embedded-modules{display:grid;gap:16px;margin-bottom:16px}.embedded-module{min-width:0;overflow:hidden}.embedded-module-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.embedded-module-heading a{flex:none;color:var(--admin-primary);font-size:13px;text-decoration:none}
.module-picker{display:grid;gap:12px}.module-picker h3,.module-picker h4{margin:10px 0 2px}.module-group{padding-top:8px;border-top:1px solid var(--admin-border)}

.status-pill {
  display: inline-flex;
  padding: 3px 8px;
  color: #21645b;
  background: #e9f5f2;
  border: 1px solid #d2e9e4;
  border-radius: 4px;
  font-size: 12px;
}

@media (max-width: 640px) {
  .dashboard-heading { align-items:flex-start; gap:8px; }.dashboard-actions { flex-wrap:wrap; justify-content:flex-end; }
  .todo-grid>.todo-card{flex-basis:min(84vw,280px)}.todo-card{min-height:130px}.todo-dialog-grid{grid-template-columns:1fr}.todo-heading-actions{flex-wrap:wrap;justify-content:flex-end}.module-options{grid-template-columns:1fr 1fr}.embedded-module-heading{flex-wrap:wrap}
  .updated-at,
  .legend {
    display: none;
  }

  .bar-row {
    grid-template-columns: 72px 1fr 30px;
    gap: 8px;
  }
}
</style>
