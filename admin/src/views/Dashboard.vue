<template>
  <div class="dashboard-heading">
    <div>
      <h1 class="page-title">仪表盘</h1>
      <p>预约业务概览与近期动态</p>
    </div>
    <span class="updated-at">数据实时更新</span>
  </div>

  <div class="metric-grid">
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

  <div class="content-panel trend-panel">
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

  <div class="content-panel recent">
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
import { computed, onMounted, ref } from 'vue';
import { ArrowRight, Bell, Calendar, CircleCheck, Phone, Tickets } from '@element-plus/icons-vue';
import { getDashboard } from '../api/admin';

const data = ref<Record<string, any>>({});
const trend = computed(() => (data.value.trend || []) as Array<{ date: string; count: number }>);
const recent = computed(() => data.value.recentAppointments || []);
const successRate = computed(() => `${Math.round(Number(data.value.notificationSuccessRate || 0) * 100)}%`);
const maxTrendCount = computed(() => Math.max(1, ...trend.value.map((item) => item.count)));

function barWidth(count: number) {
  return `${Math.max(3, Math.round((count / maxTrendCount.value) * 100))}%`;
}

onMounted(async () => {
  data.value = await getDashboard();
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
