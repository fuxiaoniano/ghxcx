<template>
  <div class="page-heading">
    <div><h1 class="page-title">审计日志</h1></div>
    <span>共 {{ total }} 条记录</span>
  </div>
  <div class="content-panel">
    <div class="toolbar">
      <el-input v-model="query.action" placeholder="操作类型" clearable style="width: 240px" />
      <el-button type="primary" @click="load">查询</el-button>
    </div>
    <el-table :data="rows">
      <el-table-column prop="action" label="操作" width="210" />
      <el-table-column prop="resourceType" label="资源" width="160" />
      <el-table-column prop="resourceId" label="资源 ID" min-width="180" />
      <el-table-column prop="ip" label="IP" width="150" />
      <el-table-column prop="createdAt" label="时间" width="190" />
      <el-table-column label="内容" min-width="260">
        <template #default="{ row }">
          <el-popover placement="left" :width="460" trigger="click">
            <template #reference><el-button text type="primary">查看变更</el-button></template>
            <pre>{{ JSON.stringify({ before: row.beforeJson, after: row.afterJson }, null, 2) }}</pre>
          </el-popover>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination layout="prev, pager, next, total" :total="total" :page-size="query.pageSize" @current-change="changePage" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { getAuditLogs } from '../api/admin';

const rows = ref<Record<string, unknown>[]>([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 20, action: '' });

async function load() {
  const result = await getAuditLogs(query);
  rows.value = result.list;
  total.value = result.total;
}

function changePage(page: number) {
  query.page = page;
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

pre {
  margin: 0;
  max-height: 420px;
  overflow: auto;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  color: #354641;
  background: #f4f7f6;
  border-radius: 6px;
  font-size: 12px;
}

@media (max-width: 640px) {
  .page-heading > span { display: none; }
}
</style>
