<template>
  <div class="page-heading">
    <div><h1 class="page-title">{{ title }}</h1><p>{{ description }}，表格格式与日报保持一致。</p></div>
    <div class="actions">
      <el-date-picker v-if="props.mode === 'week'" v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" :clearable="false" />
      <el-date-picker v-else v-model="date" :type="props.mode === 'month' ? 'month' : 'date'" value-format="YYYY-MM-DD" />
      <PromotionDateShortcuts :mode="props.mode" :model-value="props.mode === 'week' ? dateRange : [date, date]" @select="selectQuickRange" />
      <el-button :disabled="!noteOptions.length" @click="openNoteEditor()">编辑问题与调整</el-button><el-button type="primary" :loading="loading" @click="load">生成报表</el-button>
    </div>
  </div>
  <div class="content-panel report-panel" v-loading="loading">
    <div v-if="!report?.projects.length" class="empty">所选日期暂无推广数据</div>
    <p v-if="report?.projects.length" class="mobile-scroll-hint">左右滑动查看完整报表</p>
    <div v-if="report?.projects.length" class="table-wrap">
      <table class="daily-report">
        <colgroup><col class="col-date"><col class="col-project"><col class="col-channel"><col class="col-remark"><col class="col-account"><col class="col-number"><col v-if="showDailyAverage" class="col-average"><col class="col-spend"><col class="col-cost"><col class="col-number"><col class="col-rate"><col class="col-note"><col class="col-note"></colgroup>
        <thead><tr><th>日期</th><th>项目</th><th>渠道</th><th>备注</th><th>户号</th><th>{{ conversionHeader }}</th><th v-if="showDailyAverage">日均转化量</th><th>{{ spendHeader }}</th><th>转化成本</th><th>无效数据</th><th>无效占比</th><th>账户问题</th><th>调整方式</th></tr></thead>
        <tbody>
          <template v-for="(project, projectIndex) in report.projects" :key="project.project">
            <template v-for="(group, channelIndex) in project.channels" :key="group.channel">
              <tr v-for="(account, accountIndex) in group.accounts" :key="account.accountId">
                <td v-if="projectIndex === 0 && channelIndex === 0 && accountIndex === 0" :rowspan="dateSpan"><span v-for="line in dateLines" :key="line" class="date-line">{{ line }}</span></td>
                <td v-if="channelIndex === 0 && accountIndex === 0" :rowspan="projectSpan(project)">{{ project.project }}</td>
                <td v-if="accountIndex === 0" :rowspan="group.accounts.length + 1">{{ group.channel }}</td>
                <td></td><td>{{ account.accountName }}<span v-if="account.accountNo">（{{ account.accountNo }}）</span></td><td>{{ account.conversions }}</td><td v-if="showDailyAverage">{{ number(account.averageDailyConversions) }}</td><td>{{ money(account.spend) }}</td><td>{{ money(account.conversionCost) }}</td><td>{{ account.invalid }}</td><td>{{ percent(account.invalidRate) }}</td>
                <td v-if="accountIndex === 0" :rowspan="group.accounts.length + 1" class="note-cell">{{ group.problem }}</td>
                <td v-if="accountIndex === 0" :rowspan="group.accounts.length + 1" class="note-cell">{{ group.adjustment }}</td>
              </tr>
              <tr class="channel-total"><td>合计</td><td></td><td>{{ group.totals.conversions }}</td><td v-if="showDailyAverage">{{ number(group.totals.averageDailyConversions) }}</td><td>{{ money(group.totals.spend) }}</td><td>{{ money(group.totals.conversionCost) }}</td><td>{{ group.totals.invalid }}</td><td>{{ percent(group.totals.invalidRate) }}</td></tr>
            </template>
            <tr class="project-total"><td>合计</td><td></td><td></td><td>{{ project.totals.conversions }}</td><td v-if="showDailyAverage">{{ number(project.totals.averageDailyConversions) }}</td><td>{{ money(project.totals.spend) }}</td><td>{{ money(project.totals.conversionCost) }}</td><td>{{ project.totals.invalid }}</td><td>{{ percent(project.totals.invalidRate) }}</td><td></td><td></td></tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
  <el-dialog v-model="noteVisible" title="编辑账户问题与调整方式" width="580px">
    <el-form :model="noteForm" label-width="90px">
      <el-form-item label="项目渠道"><el-select v-model="noteTarget" style="width:100%" @change="changeNoteTarget"><el-option v-for="item in noteOptions" :key="`${item.project}:${item.channel}`" :label="`${item.project} · ${item.channel}`" :value="`${item.project}:${item.channel}`" /></el-select></el-form-item>
      <el-form-item label="账户问题"><el-input v-model="noteForm.problem" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>
      <el-form-item label="调整方式"><el-input v-model="noteForm.adjustment" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>
    </el-form>
    <template #footer><el-button @click="noteVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="saveNote">保存</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import PromotionDateShortcuts from '../components/PromotionDateShortcuts.vue';
import { getPromotionDailyReport, getPromotionMonthlyReport, getPromotionWeeklyReport, type PromotionDailyReport, type PromotionDailyReportProject, updatePromotionDailyReportNote } from '../api/admin';
const props = withDefaults(defineProps<{ mode?: 'day' | 'week' | 'month' }>(), { mode: 'day' });
const localDate = (offsetDays = 0) => { const value = new Date(); value.setDate(value.getDate() + offsetDays); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; };
const weekRange = () => { const now = new Date(); const weekday = now.getDay() || 7; const monday = new Date(now); monday.setDate(now.getDate() - weekday + 1); const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); return [`${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`, `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`] as [string, string]; };
const date = ref(props.mode === 'day' ? localDate(-1) : localDate()); const dateRange = ref<[string, string]>(weekRange()); const report = ref<PromotionDailyReport | null>(null); const loading = ref(false); const saving = ref(false); const noteVisible = ref(false); const noteTarget = ref(''); const noteForm = reactive({ project: '', channel: '', problem: '', adjustment: '' });
const title = computed(() => props.mode === 'week' ? '推广周报' : props.mode === 'month' ? '推广月报' : '推广日报'); const description = computed(() => props.mode === 'week' ? '可自定义时间周期汇总账户录入数据' : props.mode === 'month' ? '按自然月自动汇总账户录入数据' : '自动根据日统计汇总生成，可直接用于每日工作汇报');
const displayDate = (value: string) => value.replace(/-/g, '年').replace(/年(\d{2})$/, '月$1日');
const dateLines = computed(() => { const from = report.value?.dateFrom || (props.mode === 'week' ? dateRange.value[0] : date.value); const to = report.value?.dateTo || (props.mode === 'week' ? dateRange.value[1] : from); if (from !== to) return [displayDate(from), `至${displayDate(to)}`]; const label = displayDate(from); return [label.slice(0, -3), label.slice(-3)]; });
const conversionHeader = computed(() => props.mode === 'week' ? '周转化量' : props.mode === 'month' ? '月转化量' : '日转化量'); const spendHeader = computed(() => props.mode === 'week' ? '周消耗' : props.mode === 'month' ? '月消耗' : '日消耗');
const showDailyAverage = computed(() => props.mode !== 'day'); const number = (value: number | null) => value === null || !Number.isFinite(value) ? '—' : value.toFixed(2);
const money = (value: number | null) => value === null || !Number.isFinite(value) ? '—' : value.toFixed(2); const percent = (value: number | null) => value === null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(2)}%`;
const projectSpan = (project: PromotionDailyReportProject) => project.channels.reduce((sum, group) => sum + group.accounts.length + 1, 1);
const dateSpan = computed(() => report.value?.projects.reduce((sum, project) => sum + projectSpan(project), 0) || 1);
const noteOptions = computed(() => report.value?.projects.flatMap((project) => project.channels.map((group) => ({ project: project.project, channel: group.channel, problem: group.problem, adjustment: group.adjustment }))) || []);
async function load() { loading.value = true; try { report.value = props.mode === 'week' ? await getPromotionWeeklyReport(dateRange.value[0], dateRange.value[1]) : props.mode === 'month' ? await getPromotionMonthlyReport(date.value) : await getPromotionDailyReport(date.value); } finally { loading.value = false; } }
async function selectQuickRange(value: [string, string]) { if (props.mode === 'week') dateRange.value = value; else date.value = value[0]; await load(); }
function openNoteEditor(target = noteOptions.value[0]) { if (!target) return; noteTarget.value = `${target.project}:${target.channel}`; Object.assign(noteForm, target); noteVisible.value = true; }
function changeNoteTarget(value: string) { const target = noteOptions.value.find((item) => `${item.project}:${item.channel}` === value); if (target) Object.assign(noteForm, target); }
async function saveNote() { saving.value = true; try { await updatePromotionDailyReportNote({ statDate: report.value?.statDate || (props.mode === 'week' ? dateRange.value[0] : date.value), periodType: props.mode, ...noteForm }); ElMessage.success('已保存，后续将优先使用手动填写内容'); noteVisible.value = false; await load(); } finally { saving.value = false; } }
onMounted(load);
</script>
<style scoped>.page-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:20px; }.page-title { margin:0 0 6px; }.page-heading p { margin:0; color:var(--admin-text-muted); }.actions { display:flex; gap:10px; }.table-wrap { width:100%; overflow:hidden; }.daily-report { width:100%; table-layout:fixed; border-collapse:collapse; color:#111; font-family:"Microsoft YaHei",sans-serif; font-size:clamp(9px,.78vw,13px); text-align:center; }.daily-report .col-date{width:7%}.daily-report .col-project{width:5%}.daily-report .col-channel{width:6%}.daily-report .col-remark{width:5%}.daily-report .col-account{width:18%}.daily-report .col-number{width:5.5%}.daily-report .col-average{width:6.5%}.daily-report .col-spend{width:6.5%}.daily-report .col-cost{width:6.5%}.daily-report .col-rate{width:6.5%}.daily-report .col-note{width:11.5%}.daily-report th,.daily-report td { border:1px solid #151515; padding:4px clamp(2px,.38vw,7px); line-height:1.25; overflow-wrap:anywhere; word-break:break-word; }.daily-report th { background:#ffd966; font-size:clamp(9px,.9vw,15px); font-weight:700; }.daily-report td { background:#fff; }.daily-report .channel-total td { background:#d9e8f3; }.daily-report .project-total td { background:#ffe699; font-weight:700; }.daily-report .note-cell { white-space:normal; }.date-line { display:block; white-space:normal; }.empty { padding:48px; color:var(--admin-text-muted); text-align:center; }@media(max-width:900px){.report-panel{padding:8px}.daily-report{font-size:8px}.daily-report th{font-size:8px}.daily-report th,.daily-report td{padding:3px 1px}.daily-report .col-account{width:17%}.daily-report .col-note{width:12%}}@media(max-width:760px){.page-heading{flex-direction:column}.actions{display:grid;width:100%;grid-template-columns:1fr 1fr}.actions :deep(.el-date-editor){grid-column:1/-1;width:100%}.actions :deep(.el-button){width:100%;margin:0}}</style>
<style scoped>
.mobile-scroll-hint { display: none; }
@media (max-width: 760px) {
  .mobile-scroll-hint { display: block; margin: 0 0 8px; color: var(--admin-text-muted); font-size: 12px; }
  .table-wrap { overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; scrollbar-width: thin; }
  .daily-report { width: 1180px; min-width: 1180px; font-size: 11px; }
  .daily-report th { font-size: 11px; }
  .daily-report th, .daily-report td { padding: 4px 3px; word-break: normal; overflow-wrap: normal; }
  .daily-report .note-cell { overflow-wrap: anywhere; }
}
</style>
