<template>
  <div class="page-heading">
    <div><h1 class="page-title">通知记录</h1></div>
    <span>共 {{ total }} 条记录</span>
  </div>
  <div class="content-panel">
    <div class="toolbar">
      <el-select v-model="query.channel" placeholder="渠道" clearable style="width: 220px">
        <el-option label="公众号模板消息" value="OFFICIAL_ACCOUNT_TEMPLATE" />
        <el-option label="小程序订阅消息" value="MINI_PROGRAM_SUBSCRIBE" />
      </el-select>
      <el-select v-model="query.status" placeholder="状态" clearable style="width: 150px">
        <el-option label="成功" value="SUCCESS" />
        <el-option label="失败" value="FAILED" />
        <el-option label="跳过" value="SKIPPED" />
        <el-option label="待发送" value="PENDING" />
      </el-select>
      <el-date-picker v-model="dateRange" type="daterange" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" />
      <el-button type="primary" @click="load">查询</el-button>
    </div>
    <el-table :data="rows">
      <el-table-column prop="channel" label="渠道" width="180">
        <template #default="{ row }">{{ channelLabel(row.channel) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }"><el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="targetOpenId" label="目标 openid" min-width="220" />
      <el-table-column prop="templateId" label="模板 ID" min-width="180" />
      <el-table-column prop="errorCode" label="错误码" width="120" />
      <el-table-column prop="errorMessage" label="错误信息" min-width="220" />
      <el-table-column prop="retryCount" label="重试" width="80" />
      <el-table-column label="操作" width="110">
        <template #default="{ row }">
          <el-button size="small" text type="primary" @click="retry(row.id)">重试</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination layout="prev, pager, next, total" :total="total" :page-size="query.pageSize" @current-change="changePage" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { getNotificationLogs, NotificationLog, retryNotification } from '../api/admin';

const rows = ref<NotificationLog[]>([]);
const total = ref(0);
const dateRange = ref<string[]>([]);
const query = reactive({ page: 1, pageSize: 20, channel: '', status: '', dateFrom: '', dateTo: '' });

function channelLabel(channel: string) {
  return channel === 'OFFICIAL_ACCOUNT_TEMPLATE' ? '公众号模板消息' : channel === 'MINI_PROGRAM_SUBSCRIBE' ? '小程序订阅消息' : channel;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = { SUCCESS: '成功', FAILED: '失败', SKIPPED: '跳过', PENDING: '待发送' };
  return labels[status] || status;
}

function statusType(status: string) {
  const types: Record<string, 'success' | 'danger' | 'info' | 'warning'> = { SUCCESS: 'success', FAILED: 'danger', SKIPPED: 'info', PENDING: 'warning' };
  return types[status] || 'info';
}

watch(dateRange, (value) => {
  query.dateFrom = value?.[0] || '';
  query.dateTo = value?.[1] || '';
});

async function load() {
  const result = await getNotificationLogs(query);
  rows.value = result.list;
  total.value = result.total;
}

function changePage(page: number) {
  query.page = page;
  load();
}

async function retry(id: string) {
  await retryNotification(id);
  ElMessage.success('已触发重试');
  load();
}

onMounted(load);
</script>

<style scoped>
.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.page-heading .page-title { margin-bottom: 2px; }
.page-heading p, .page-heading > span { margin: 0; color: var(--admin-text-muted); font-size: 13px; }

@media (max-width: 640px) {
  .page-heading > span { display: none; }
}
</style>
