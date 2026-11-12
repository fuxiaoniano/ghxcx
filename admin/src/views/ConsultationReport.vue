<template>
  <div class="consultation-report">
    <section class="content-panel report-toolbar">
      <h1>{{ mode === 'channel' ? '渠道报表' : '网咨报表' }}</h1>
      <div class="filters">
      <el-date-picker v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" />
      <el-select v-if="mode === 'channel'" v-model="project" clearable placeholder="全部项目"><el-option v-for="item in metadata.projects" :key="item.id" :label="item.name" :value="item.id" /></el-select>
      <el-select v-if="mode === 'channel'" v-model="channel" clearable placeholder="全部渠道"><el-option v-for="item in channels" :key="item" :label="item" :value="item" /></el-select>
      <el-button type="primary" :loading="loading" @click="load">查询</el-button>
      <div class="tree-actions"><el-button size="small" @click="setExpanded(true)">展开全部</el-button><el-button size="small" @click="setExpanded(false)">收起全部</el-button></div>
      </div>
    </section>
    <section class="content-panel report-table">
      <div class="table-scroll"><el-table ref="tableRef" :data="report?.tree || []" v-loading="loading" row-key="id" :tree-props="{ children: 'children' }" default-expand-all show-summary :summary-method="summaryMethod" min-width="980">
        <el-table-column prop="label" :label="mode === 'channel' ? '项目 / 渠道 / 账户' : '网咨团队 / 成员'" min-width="260" />
        <el-table-column prop="total" label="总表单" min-width="95" /><el-table-column prop="valid" label="有效表单" min-width="100" />
        <el-table-column prop="effectiveRate" label="有效率" min-width="95"><template #default="{ row }">{{ row.effectiveRate }}%</template></el-table-column>
        <el-table-column prop="appointment" label="预约" min-width="85" /><el-table-column prop="appointmentRate" label="预约率" min-width="95"><template #default="{ row }">{{ row.appointmentRate }}%</template></el-table-column>
        <el-table-column prop="arrived" label="到院" min-width="85" /><el-table-column prop="arrivalRate" label="到院率" min-width="95"><template #default="{ row }">{{ row.arrivalRate }}%</template></el-table-column>
        <el-table-column prop="payment" label="收款（元）" min-width="120"><template #default="{ row }">¥{{ Number(row.payment).toFixed(2) }}</template></el-table-column>
      </el-table></div>
    </section>
    <p class="report-note">有效率 = 有效表单 ÷ 总表单；预约率 = 预约 ÷ 总表单；到院率 = 到院 ÷ 总表单。收款取网咨表单记录的金额。</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { getConsultationMetadata, getConsultationReport, type ConsultationMetadata, type ConsultationReport, type ConsultationReportTreeNode } from '../api/admin';

const props = defineProps<{ mode: 'channel' | 'daily' }>();
const dateText = (date: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const dateRange = ref([dateText(new Date(Date.now() - 29 * 86400000)), dateText(new Date())]);
const metadata = reactive<ConsultationMetadata>({ projects: [], promotionAccounts: [], statuses: [], tags: [], fields: [], members: [] });
const project = ref(''); const channel = ref('');
const report = ref<ConsultationReport | null>(null); const loading = ref(false);
const tableRef = ref<{ toggleRowExpansion: (row: ConsultationReportTreeNode, expanded: boolean) => void } | null>(null);
const channels = computed(() => [...new Set(metadata.promotionAccounts.map(item => item.channel))]);
async function load() {
  if (dateRange.value.length !== 2) return;
  loading.value = true;
  try { report.value = await getConsultationReport({ mode: props.mode, from: dateRange.value[0], to: dateRange.value[1], project: project.value || undefined, channel: channel.value || undefined }); }
  finally { loading.value = false; }
}
function summaryMethod({ columns }: { columns: Array<{ property?: string; label?: string }> }) {
  const total = report.value?.summary;
  return columns.map((column, index) => {
    if (index === 0) return '合计';
    if (!total) return '';
    if (column.property === 'payment') return `¥${total.payment.toFixed(2)}`;
    if (column.property && column.property in total) return String((total as unknown as Record<string, unknown>)[column.property]) + (column.property.endsWith('Rate') ? '%' : '');
    const field = report.value?.fields.find(item => item.name === column.label);
    return field ? String(total.custom[field.code] || 0) : '';
  });
}
function setExpanded(expanded: boolean) {
  const walk = (nodes: ConsultationReportTreeNode[]) => {
    for (const node of nodes) { tableRef.value?.toggleRowExpansion(node, expanded); walk(node.children); }
  };
  walk(report.value?.tree || []);
}
onMounted(() => { void Promise.allSettled([getConsultationMetadata().then((result) => Object.assign(metadata, result)), load()]); });
watch(() => props.mode, load);
</script>

<style scoped>
.consultation-report{display:grid;gap:12px;min-width:0}
.report-toolbar{display:flex;align-items:center;gap:18px;min-width:0}
.report-toolbar h1{margin:0;flex:none;font-size:24px;white-space:nowrap}
.report-note{margin:0;color:var(--admin-text-muted);font-size:12px}
.filters{display:flex;flex:1;justify-content:flex-end;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
.filters :deep(.el-date-editor){width:300px;max-width:100%}
.filters .el-select{width:145px}
.tree-actions{display:flex;gap:8px;margin-left:0}
.tree-actions .el-button+.el-button{margin-left:0}
.filters :deep(.el-button){white-space:nowrap}
.table-scroll{overflow-x:auto}.table-scroll :deep(.el-table){min-width:980px}.report-table{min-width:0}
@media(max-width:760px){.report-toolbar{display:grid;gap:12px}.report-toolbar h1{font-size:20px}.filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%}.filters :deep(.el-date-editor),.filters .el-select,.filters>.el-button{width:100%;min-width:0}.filters :deep(.el-date-editor),.filters>.el-button{grid-column:1/-1}.tree-actions{grid-column:1/-1}.tree-actions .el-button{flex:1;min-width:0}}
</style>
