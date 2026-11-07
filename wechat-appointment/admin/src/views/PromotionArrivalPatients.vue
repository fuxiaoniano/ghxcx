<template>
  <div class="arrival-page">
    <el-card shadow="never" class="filter-card">
      <div class="toolbar-row">
        <h1 class="page-title">患者收费</h1>
        <div class="filter-toggle" @click="filtersOpen = !filtersOpen"><span>筛选</span><span>{{ filtersOpen ? '收起' : '展开' }}</span></div>
        <div v-show="filtersOpen" class="filters">
          <el-input v-model="filters.keyword" clearable placeholder="姓名、电话、账户或人员" @keyup.enter="search" />
          <el-select v-model="filters.project" clearable placeholder="全部项目"><el-option v-for="item in projects" :key="item" :label="item" :value="item" /></el-select>
          <el-select v-model="filters.channelSource" clearable placeholder="全部渠道"><el-option v-for="item in channels" :key="item" :label="item" :value="item" /></el-select>
          <el-select v-model="filters.accountId" clearable filterable placeholder="全部账户"><el-option v-for="item in filteredAccounts" :key="item.id" :label="accountLabel(item)" :value="item.id" /></el-select>
          <el-date-picker v-model="filters.dates" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" range-separator="至" />
          <el-button type="primary" :loading="loading" @click="search">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </div>
        <div class="entry-actions">
          <el-button v-if="canFields" @click="fieldDialog = true">自定义字段</el-button>
          <el-button v-if="canEdit" @click="downloadPromotionPatientChargeTemplate">下载模板</el-button>
          <el-upload v-if="canEdit" :auto-upload="false" :show-file-list="false" accept=".xlsx" :on-change="handleImport"><el-button :loading="importing">导入明细</el-button></el-upload>
          <el-button @click="exportCurrent">导出明细</el-button>
          <el-button v-if="canEdit" type="primary" @click="openCreate">录入患者</el-button>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="list-card">
      <div class="list-title"><strong>患者记录</strong><span>共 {{ total }} 条</span></div>
      <el-table v-loading="loading" :data="rows" class="desktop-table" stripe>
        <el-table-column label="序号" width="66" align="center"><template #default="scope">{{ sequence(scope.$index) }}</template></el-table-column>
        <el-table-column prop="name" label="姓名" min-width="90" show-overflow-tooltip />
        <el-table-column prop="phone" label="电话" min-width="128" />
        <el-table-column prop="project" label="项目" min-width="82" />
        <el-table-column prop="channelSource" label="渠道来源" min-width="105" show-overflow-tooltip />
        <el-table-column prop="accountName" label="账户名称" min-width="130" show-overflow-tooltip />
        <el-table-column prop="arrivalDate" label="到院日期" min-width="108" />
        <el-table-column prop="visitType" label="就诊类型" width="82" />
        <el-table-column label="成交金额" min-width="105" align="right"><template #default="{ row }">{{ money(row.transactionAmount) }}</template></el-table-column>
        <el-table-column label="实收金额" min-width="105" align="right"><template #default="{ row }">{{ money(row.receivedAmount) }}</template></el-table-column>
        <el-table-column prop="onlineConsultant" label="网电" min-width="90" show-overflow-tooltip />
        <el-table-column prop="consultant" label="咨询师" min-width="90" show-overflow-tooltip />
        <el-table-column v-for="field in visibleFields" :key="field.id" :label="field.label" min-width="110" show-overflow-tooltip><template #default="{ row }">{{ row.customData[field.key] ?? '—' }}</template></el-table-column>
        <el-table-column v-if="canEdit || canDelete" label="操作" width="132" fixed="right"><template #default="{ row }"><el-button v-if="canEdit" link type="primary" @click="openEdit(row)">编辑</el-button><el-button v-if="canDelete" link type="danger" @click="removeRow(row)">删除</el-button></template></el-table-column>
      </el-table>

      <div v-loading="loading" class="mobile-list">
        <div v-for="(row, index) in rows" :key="row.id" class="patient-card">
          <div class="patient-card__head"><strong>{{ sequence(index) }}. {{ row.name }}</strong><span>{{ row.arrivalDate }} · {{ row.visitType }}</span></div>
          <div class="patient-card__account">{{ row.project }} · {{ row.channelSource }} · {{ row.accountName }}</div>
          <div class="patient-card__grid"><span>电话</span><b>{{ row.phone }}</b><span>成交</span><b>{{ money(row.transactionAmount) }}</b><span>实收</span><b>{{ money(row.receivedAmount) }}</b><span>网电</span><b>{{ row.onlineConsultant || '—' }}</b><span>咨询师</span><b>{{ row.consultant || '—' }}</b></div>
          <div v-if="visibleFields.length" class="patient-card__custom"><span v-for="field in visibleFields" :key="field.id">{{ field.label }}：{{ row.customData[field.key] ?? '—' }}</span></div>
          <div v-if="canEdit || canDelete" class="patient-card__actions"><el-button v-if="canEdit" @click="openEdit(row)">编辑</el-button><el-button v-if="canDelete" type="danger" plain @click="removeRow(row)">删除</el-button></div>
        </div>
        <el-empty v-if="!loading && !rows.length" description="暂无患者收费明细" />
      </div>
      <el-pagination v-model:current-page="filters.page" v-model:page-size="filters.pageSize" :total="total" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @current-change="load" @size-change="search" />
    </el-card>

    <el-dialog v-model="editorOpen" :title="form.id ? '编辑患者收费' : '录入患者收费'" width="720px" class="arrival-dialog" destroy-on-close>
      <el-form label-position="top" class="patient-form">
        <el-form-item label="姓名" required><el-input v-model="form.name" maxlength="80" /></el-form-item>
        <el-form-item :label="form.id ? '电话（留空表示不修改）' : '电话'" required><el-input v-model="form.phone" maxlength="11" inputmode="numeric" /></el-form-item>
        <el-form-item label="项目" required><el-select v-model="form.project" @change="onProjectChange"><el-option v-for="item in projects" :key="item" :label="item" :value="item" /></el-select></el-form-item>
        <el-form-item label="渠道来源" required><el-select v-model="form.channelSource" @change="onChannelChange"><el-option v-for="item in formChannels" :key="item" :label="item" :value="item" /></el-select></el-form-item>
        <el-form-item label="账户名称" required><el-select v-model="form.accountId" filterable><el-option v-for="item in formAccounts" :key="item.id" :label="accountLabel(item)" :value="item.id" /></el-select></el-form-item>
        <el-form-item label="到院日期" required><el-date-picker v-model="form.arrivalDate" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="就诊类型" required><el-select v-model="form.visitType"><el-option label="初诊" value="初诊" /><el-option label="复诊" value="复诊" /></el-select></el-form-item>
        <el-form-item label="成交金额" required><el-input-number v-model="form.transactionAmount" :min="0" :precision="2" :controls="false" /></el-form-item>
        <el-form-item label="实收金额" required><el-input-number v-model="form.receivedAmount" :min="0" :precision="2" :controls="false" /></el-form-item>
        <el-form-item label="网电"><el-input v-model="form.onlineConsultant" maxlength="80" /></el-form-item>
        <el-form-item label="咨询师"><el-input v-model="form.consultant" maxlength="80" /></el-form-item>
        <el-form-item v-for="field in visibleFields" :key="field.id" :label="field.label" :required="field.required">
          <el-input-number v-if="field.dataType === 'NUMBER'" v-model="form.customData[field.key]" :controls="false" />
          <el-date-picker v-else-if="field.dataType === 'DATE'" v-model="form.customData[field.key]" type="date" value-format="YYYY-MM-DD" />
          <el-input v-else v-model="form.customData[field.key]" maxlength="1000" />
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="editorOpen = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="fieldDialog" title="自定义字段" width="680px" class="arrival-dialog">
      <div class="field-toolbar"><el-button type="primary" @click="openFieldCreate">添加字段</el-button></div>
      <el-table :data="fields"><el-table-column prop="label" label="字段名称" min-width="140" /><el-table-column prop="dataType" label="类型" width="90"><template #default="{ row }">{{ fieldTypeLabel(row.dataType) }}</template></el-table-column><el-table-column label="必填" width="70"><template #default="{ row }">{{ row.required ? '是' : '否' }}</template></el-table-column><el-table-column label="状态" width="70"><template #default="{ row }">{{ row.enabled ? '启用' : '停用' }}</template></el-table-column><el-table-column label="操作" width="130"><template #default="{ row }"><el-button link type="primary" @click="openFieldEdit(row)">编辑</el-button><el-button link type="danger" @click="removeField(row)">删除</el-button></template></el-table-column></el-table>
    </el-dialog>
    <el-dialog v-model="fieldEditorOpen" :title="fieldForm.id ? '编辑字段' : '添加字段'" width="480px" class="arrival-dialog" append-to-body><el-form label-position="top"><el-form-item label="字段名称"><el-input v-model="fieldForm.label" /></el-form-item><el-form-item label="类型"><el-select v-model="fieldForm.dataType"><el-option label="文本" value="TEXT" /><el-option label="数字" value="NUMBER" /><el-option label="日期" value="DATE" /></el-select></el-form-item><el-form-item><el-checkbox v-model="fieldForm.required">必填</el-checkbox><el-checkbox v-model="fieldForm.enabled">启用</el-checkbox></el-form-item><el-form-item label="排序"><el-input-number v-model="fieldForm.sort" :min="0" /></el-form-item></el-form><template #footer><el-button @click="fieldEditorOpen = false">取消</el-button><el-button type="primary" @click="saveField">保存</el-button></template></el-dialog>
    <el-dialog v-model="importResultOpen" title="导入结果" width="600px" class="arrival-dialog"><el-alert v-if="importResult" :title="`成功导入 ${importResult.imported} 条，失败 ${importResult.failed} 条`" :type="importResult.failed ? 'warning' : 'success'" :closable="false" /><el-table v-if="importResult?.errors.length" :data="importResult.errors" max-height="320"><el-table-column prop="row" label="行号" width="80" /><el-table-column prop="message" label="失败原因" min-width="300" /></el-table><template #footer><el-button type="primary" @click="importResultOpen = false">完成</el-button></template></el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { createPromotionArrivalField, createPromotionArrivalPatient, deletePromotionArrivalField, deletePromotionArrivalPatient, downloadPromotionPatientChargeTemplate, exportPromotionPatientCharges, getPromotionArrivalPatientMeta, getPromotionArrivalPatients, importPromotionPatientCharges, updatePromotionArrivalField, updatePromotionArrivalPatient, type PromotionAccountItem, type PromotionArrivalFieldItem, type PromotionArrivalPatientItem } from '../api/admin';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const canEdit = computed(() => auth.hasPermission('PROMOTION_ARRIVAL_PATIENT_EDIT'));
const canDelete = computed(() => auth.hasPermission('PROMOTION_ARRIVAL_PATIENT_DELETE'));
const canFields = computed(() => auth.hasPermission('PROMOTION_ARRIVAL_PATIENT_FIELDS'));
const accounts = ref<PromotionAccountItem[]>([]), fields = ref<PromotionArrivalFieldItem[]>([]), rows = ref<PromotionArrivalPatientItem[]>([]);
const total = ref(0), loading = ref(false), saving = ref(false), importing = ref(false), filtersOpen = ref(window.innerWidth > 760), editorOpen = ref(false), fieldDialog = ref(false), fieldEditorOpen = ref(false), importResultOpen = ref(false);
const importResult = ref<{ imported: number; failed: number; errors: Array<{ row: number; message: string }> } | null>(null);
const filters = reactive({ keyword: '', project: '', channelSource: '', accountId: '', dates: [] as string[], page: 1, pageSize: 10 });
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const form = reactive({ id: '', name: '', phone: '', project: '', channelSource: '', accountId: '', arrivalDate: today(), visitType: '初诊' as '初诊' | '复诊', transactionAmount: 0, receivedAmount: 0, onlineConsultant: '', consultant: '', customData: {} as Record<string, any> });
const fieldForm = reactive({ id: '', label: '', dataType: 'TEXT' as 'TEXT' | 'NUMBER' | 'DATE', required: false, enabled: true, sort: 1000 });
const projects = computed(() => [...new Set(accounts.value.map(item => item.project))]);
const channels = computed(() => [...new Set(accounts.value.filter(item => !filters.project || item.project === filters.project).map(item => item.platform))]);
const filteredAccounts = computed(() => accounts.value.filter(item => (!filters.project || item.project === filters.project) && (!filters.channelSource || item.platform === filters.channelSource)));
const formChannels = computed(() => [...new Set(accounts.value.filter(item => !form.project || item.project === form.project).map(item => item.platform))]);
const formAccounts = computed(() => accounts.value.filter(item => (!form.project || item.project === form.project) && (!form.channelSource || item.platform === form.channelSource)));
const visibleFields = computed(() => fields.value.filter(item => item.enabled && item.label.trim() !== '就诊类型'));
const accountLabel = (item: PromotionAccountItem) => `${item.name}${item.accountNo ? ` · ${item.accountNo}` : ''}`;
const sequence = (index: number) => (filters.page - 1) * filters.pageSize + index + 1;
const money = (value: number) => `¥${Number(value || 0).toFixed(2)}`;
const fieldTypeLabel = (value: string) => ({ TEXT: '文本', NUMBER: '数字', DATE: '日期' }[value] || value);

async function loadMeta() { const result = await getPromotionArrivalPatientMeta(); accounts.value = result.accounts; fields.value = result.fields; }
async function load() { loading.value = true; try { const result = await getPromotionArrivalPatients({ keyword: filters.keyword || undefined, project: filters.project || undefined, channelSource: filters.channelSource || undefined, accountId: filters.accountId || undefined, dateFrom: filters.dates?.[0], dateTo: filters.dates?.[1], page: filters.page, pageSize: filters.pageSize }); rows.value = result.items; total.value = result.total; } finally { loading.value = false; } }
function search() { filters.page = 1; void load(); }
function resetFilters() { Object.assign(filters, { keyword: '', project: '', channelSource: '', accountId: '', dates: [], page: 1 }); void load(); }
function clearForm() { Object.assign(form, { id: '', name: '', phone: '', project: projects.value[0] || '', channelSource: '', accountId: '', arrivalDate: today(), visitType: '初诊', transactionAmount: 0, receivedAmount: 0, onlineConsultant: '', consultant: '', customData: {} }); form.channelSource = formChannels.value[0] || ''; form.accountId = formAccounts.value[0]?.id || ''; }
function openCreate() { clearForm(); editorOpen.value = true; }
function openEdit(row: PromotionArrivalPatientItem) { Object.assign(form, { id: row.id, name: row.name, phone: '', project: row.project, channelSource: row.channelSource, accountId: row.accountId, arrivalDate: row.arrivalDate, visitType: row.visitType, transactionAmount: row.transactionAmount, receivedAmount: row.receivedAmount, onlineConsultant: row.onlineConsultant || '', consultant: row.consultant || '', customData: { ...row.customData } }); editorOpen.value = true; }
function onProjectChange() { form.channelSource = formChannels.value[0] || ''; form.accountId = formAccounts.value[0]?.id || ''; }
function onChannelChange() { form.accountId = formAccounts.value[0]?.id || ''; }
async function save() { if (!form.name.trim() || (!form.id && !/^1\d{10}$/.test(form.phone)) || !form.accountId || !form.arrivalDate) return ElMessage.warning('请完整填写姓名、电话、账户和到院日期'); for (const field of visibleFields.value) if (field.required && (form.customData[field.key] === undefined || form.customData[field.key] === '')) return ElMessage.warning(`请填写${field.label}`); saving.value = true; try { const data = { accountId: form.accountId, name: form.name.trim(), ...(form.phone ? { phone: form.phone } : {}), arrivalDate: form.arrivalDate, visitType: form.visitType, transactionAmount: Number(form.transactionAmount || 0), receivedAmount: Number(form.receivedAmount || 0), onlineConsultant: form.onlineConsultant.trim(), consultant: form.consultant.trim(), customData: form.customData }; if (form.id) await updatePromotionArrivalPatient(form.id, data); else await createPromotionArrivalPatient(data); ElMessage.success('患者收费已保存，统计数据已自动更新'); editorOpen.value = false; await load(); } finally { saving.value = false; } }
async function removeRow(row: PromotionArrivalPatientItem) { await ElMessageBox.confirm(`确认删除“${row.name}”的患者收费记录？删除后统计会自动重算。`, '删除确认', { type: 'warning' }); await deletePromotionArrivalPatient(row.id); ElMessage.success('已删除'); await load(); }
function openFieldCreate() { Object.assign(fieldForm, { id: '', label: '', dataType: 'TEXT', required: false, enabled: true, sort: 1000 }); fieldEditorOpen.value = true; }
function openFieldEdit(row: PromotionArrivalFieldItem) { Object.assign(fieldForm, row); fieldEditorOpen.value = true; }
async function saveField() { if (!fieldForm.label.trim()) return ElMessage.warning('请填写字段名称'); const data = { label: fieldForm.label.trim(), dataType: fieldForm.dataType, required: fieldForm.required, enabled: fieldForm.enabled, sort: fieldForm.sort }; if (fieldForm.id) await updatePromotionArrivalField(fieldForm.id, data); else await createPromotionArrivalField(data); ElMessage.success('字段已保存'); fieldEditorOpen.value = false; await loadMeta(); }
async function removeField(row: PromotionArrivalFieldItem) { await ElMessageBox.confirm(`删除字段“${row.label}”后历史患者中的该字段值仍保留，但不再展示，确认删除？`, '删除确认', { type: 'warning' }); await deletePromotionArrivalField(row.id); await loadMeta(); }
const currentExportParams = () => ({ keyword: filters.keyword || undefined, project: filters.project || undefined, channelSource: filters.channelSource || undefined, accountId: filters.accountId || undefined, dateFrom: filters.dates?.[0], dateTo: filters.dates?.[1] });
async function exportCurrent() { await exportPromotionPatientCharges(currentExportParams()); }
async function handleImport(upload: any) { const file = upload?.raw as File | undefined; if (!file) return; importing.value = true; try { importResult.value = await importPromotionPatientCharges(file); importResultOpen.value = true; await load(); } finally { importing.value = false; } }
onMounted(async () => { await loadMeta(); await load(); });
</script>

<style scoped>
.arrival-page{display:grid;gap:16px}.toolbar-row,.filters,.patient-card__actions,.entry-actions{display:flex;gap:8px;align-items:center}.toolbar-row{min-width:0}.page-title{flex:0 0 auto;margin:0 8px 0 0;font-size:22px;white-space:nowrap}.filters{flex:1;min-width:0}.filters>:first-child{width:180px}.filters :deep(.el-select){width:118px}.filters :deep(.el-date-editor){width:240px}.filters .el-button,.entry-actions .el-button{margin:0;white-space:nowrap}.entry-actions{flex:0 0 auto}.filter-toggle{display:none}.list-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.list-title span{color:var(--admin-muted);font-size:13px}.mobile-list{display:none}.el-pagination{justify-content:flex-end;margin-top:16px}.patient-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.patient-form :deep(.el-select),.patient-form :deep(.el-date-editor),.patient-form :deep(.el-input-number){width:100%}.field-toolbar{display:flex;justify-content:flex-end;margin-bottom:12px}
@media(max-width:1500px) and (min-width:761px){.toolbar-row{overflow-x:auto;padding-bottom:4px}.filters{flex:0 0 auto}.filters>:first-child{width:160px}.filters :deep(.el-select){width:108px}.filters :deep(.el-date-editor){width:220px}.page-title{font-size:20px}}
@media(max-width:760px){.toolbar-row{align-items:stretch;flex-direction:column}.page-title{font-size:22px;margin:0}.entry-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%}.entry-actions>*{width:100%;min-width:0}.entry-actions :deep(.el-upload),.entry-actions .el-button{width:100%;margin:0;white-space:nowrap}.filter-toggle{display:flex;justify-content:space-between;min-height:40px;align-items:center;font-weight:650;border-top:1px solid var(--admin-border);padding-top:8px}.filters{display:grid;grid-template-columns:1fr 1fr;margin-top:2px}.filters>*,.filters>:first-child,.filters :deep(.el-select),.filters :deep(.el-date-editor){width:100%!important}.filters>:first-child,.filters :deep(.el-date-editor){grid-column:1/-1}.desktop-table{display:none}.mobile-list{display:grid;gap:12px}.patient-card{padding:14px;border:1px solid var(--admin-border);border-radius:14px;background:#fff}.patient-card__head{display:flex;justify-content:space-between;gap:10px}.patient-card__head span,.patient-card__account{color:var(--admin-muted);font-size:13px}.patient-card__head span{text-align:right;white-space:nowrap}.patient-card__account{margin:6px 0 12px;overflow-wrap:anywhere}.patient-card__grid{display:grid;grid-template-columns:62px minmax(0,1fr);gap:8px 10px;font-size:14px}.patient-card__grid span{color:var(--admin-muted)}.patient-card__grid b{font-weight:550;overflow-wrap:anywhere}.patient-card__custom{display:grid;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--admin-border);font-size:13px}.patient-card__actions{display:grid;grid-template-columns:repeat(2,1fr);margin-top:12px}.patient-card__actions .el-button{width:100%;margin:0}.patient-form{grid-template-columns:1fr}.el-pagination{justify-content:center;overflow-x:auto}.arrival-dialog :deep(.el-dialog){width:calc(100vw - 24px)!important;max-height:calc(100vh - 24px);margin:12px auto!important}.arrival-dialog :deep(.el-dialog__body){max-height:calc(100vh - 150px);overflow:auto}}
</style>
