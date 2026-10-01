<template>
  <div class="page-heading"><div><h1 class="page-title">推广数据字段设置</h1><p>统一管理日统计录入与列表展示字段；隐藏字段不会删除既有历史数据。</p></div><el-button type="primary" @click="openCreate">添加字段</el-button></div>
  <div class="content-panel"><el-alert type="info" :closable="false" show-icon title="默认字段可修改名称和显示状态；删除默认字段会将其隐藏。自定义字段可完整删除。" class="hint" />
    <el-table :data="rows" v-loading="loading" border><el-table-column prop="label" label="字段名称" min-width="180" /><el-table-column prop="key" label="字段标识" min-width="210" /><el-table-column label="类型" width="110"><template #default="{ row }">{{ row.source === 'SYSTEM' ? '默认字段' : '自定义字段' }}</template></el-table-column><el-table-column label="数据类型" width="110"><template #default="{ row }">{{ row.dataType === 'NUMBER' ? '数值' : '文本' }}</template></el-table-column><el-table-column label="显示" width="100"><template #default="{ row }"><el-switch :model-value="row.isVisible" @change="setVisible(row, $event)" /></template></el-table-column><el-table-column prop="sort" label="排序" width="90" /><el-table-column label="操作" width="150" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="openEdit(row)">编辑</el-button><el-button link type="danger" @click="remove(row)">{{ row.source === 'SYSTEM' ? '隐藏' : '删除' }}</el-button></template></el-table-column></el-table>
  </div>
  <el-dialog v-model="visible" :title="form.id ? '编辑字段' : '添加字段'" width="460px"><el-form :model="form" label-width="90px"><el-form-item label="字段名称" required><el-input v-model="form.label" maxlength="80" show-word-limit /></el-form-item><el-form-item label="数据类型"><el-radio-group v-model="form.dataType" :disabled="form.source === 'SYSTEM'"><el-radio value="NUMBER">数值</el-radio><el-radio value="TEXT">文本</el-radio></el-radio-group></el-form-item><el-form-item label="是否显示"><el-switch v-model="form.isVisible" /></el-form-item><el-form-item label="排序"><el-input-number v-model="form.sort" :min="0" :max="9999" /></el-form-item></el-form><template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template></el-dialog>
</template>
<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { createPromotionMetricField, deletePromotionMetricField, getPromotionMetricFields, type PromotionMetricFieldItem, updatePromotionMetricField } from '../api/admin';
const rows = ref<PromotionMetricFieldItem[]>([]); const loading = ref(false); const saving = ref(false); const visible = ref(false);
const blank = () => ({ id: '', label: '', source: 'CUSTOM' as 'SYSTEM' | 'CUSTOM', dataType: 'NUMBER' as 'NUMBER' | 'TEXT', isVisible: true, sort: 1000 }); const form = reactive(blank());
async function load() { loading.value = true; try { rows.value = await getPromotionMetricFields(); } finally { loading.value = false; } }
function openCreate() { Object.assign(form, blank()); visible.value = true; }
function openEdit(row: PromotionMetricFieldItem) { Object.assign(form, row); visible.value = true; }
async function save() { if (!form.label.trim()) return ElMessage.warning('请填写字段名称'); saving.value = true; try { const data = { label: form.label, dataType: form.dataType, isVisible: form.isVisible, sort: form.sort }; if (form.id) await updatePromotionMetricField(form.id, data); else await createPromotionMetricField(data); ElMessage.success('字段已保存'); visible.value = false; await load(); } finally { saving.value = false; } }
async function setVisible(row: PromotionMetricFieldItem, value: string | number | boolean) { await updatePromotionMetricField(row.id, { label: row.label, dataType: row.dataType, isVisible: Boolean(value), sort: row.sort }); row.isVisible = Boolean(value); ElMessage.success('显示状态已更新'); }
async function remove(row: PromotionMetricFieldItem) { await ElMessageBox.confirm(row.source === 'SYSTEM' ? `隐藏默认字段“${row.label}”？后续可通过显示开关恢复。` : `删除自定义字段“${row.label}”？历史数据不会被删除。`, '确认操作', { type: 'warning' }); await deletePromotionMetricField(row.id); ElMessage.success(row.source === 'SYSTEM' ? '字段已隐藏' : '字段已删除'); await load(); }
onMounted(load);
</script>
<style scoped>.page-heading { display:flex; justify-content:space-between; gap:16px; margin-bottom:20px; }.page-title { margin:0 0 6px; }.page-heading p { margin:0; color:var(--admin-text-muted); }.hint { margin-bottom:18px; }</style>
