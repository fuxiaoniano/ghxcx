<template>
  <div class="page-heading">
    <div><h1 class="page-title">资讯分类</h1><p>维护官网文章分类、排序和展示状态；已有文章的分类不可直接删除。</p></div>
    <el-button type="primary" @click="editCategory()"><el-icon><Plus /></el-icon>新增分类</el-button>
  </div>
  <div class="content-panel">
    <el-table :data="categories" row-key="id" empty-text="暂无资讯分类">
      <el-table-column prop="name" label="分类名称" min-width="150" />
      <el-table-column prop="slug" label="分类路径" min-width="170" />
      <el-table-column prop="description" label="分类说明" min-width="260" show-overflow-tooltip />
      <el-table-column prop="sort" label="排序" width="90" />
      <el-table-column label="文章数量" width="100"><template #default="{ row }">{{ row._count?.articles || 0 }}</template></el-table-column>
      <el-table-column label="官网展示" width="110"><template #default="{ row }"><el-switch :model-value="row.status === 'ACTIVE'" @change="toggleCategory(row, $event)" /></template></el-table-column>
      <el-table-column label="操作" width="176" fixed="right"><template #default="{ row }"><div class="operation-actions"><el-button text type="primary" @click="editCategory(row)"><el-icon><Edit /></el-icon>编辑</el-button><el-button text type="danger" :disabled="Boolean(row._count?.articles)" @click="removeCategory(row)"><el-icon><Delete /></el-icon>删除</el-button></div></template></el-table-column>
    </el-table>
  </div>
  <el-dialog v-model="dialogVisible" :title="form.id ? '编辑资讯分类' : '新增资讯分类'" width="min(620px, calc(100vw - 32px))">
    <el-form label-width="92px">
      <el-form-item label="分类名称" required><el-input v-model="form.name" maxlength="40" /></el-form-item>
      <el-form-item label="分类路径" required><el-input v-model="form.slug" maxlength="60" placeholder="例如：children-dentistry" /><div class="field-tip">只能使用小写字母、数字和连字符，保存后建议不要频繁修改。</div></el-form-item>
      <el-form-item label="分类说明"><el-input v-model="form.description" type="textarea" :rows="3" maxlength="300" show-word-limit /></el-form-item>
      <el-form-item label="排序"><el-input-number v-model="form.sort" :min="0" :max="9999" /></el-form-item>
      <el-form-item label="官网展示"><el-switch v-model="form.active" /></el-form-item>
    </el-form>
    <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="saveCategory">保存分类</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { Delete, Edit, Plus } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { createWebsiteArticleCategory, deleteWebsiteArticleCategory, getWebsiteArticleCategories, updateWebsiteArticleCategory, type WebsiteArticleCategoryItem } from '../api/admin';
const categories = ref<WebsiteArticleCategoryItem[]>([]); const dialogVisible = ref(false); const saving = ref(false);
const form = reactive({ id: '', name: '', slug: '', description: '', sort: 0, active: true });
async function load() { categories.value = await getWebsiteArticleCategories(); }
function editCategory(row?: WebsiteArticleCategoryItem) {
  Object.assign(form, { id: row?.id || '', name: row?.name || '', slug: row?.slug || '', description: row?.description || '', sort: row?.sort || 0, active: row?.status !== 'DISABLED' });
  dialogVisible.value = true;
}
async function saveCategory() {
  if (!form.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) return ElMessage.warning('请填写分类名称和正确的分类路径');
  saving.value = true;
  try {
    const data = { name: form.name.trim(), slug: form.slug, description: form.description, sort: form.sort, status: form.active ? 'ACTIVE' as const : 'DISABLED' as const };
    if (form.id) await updateWebsiteArticleCategory(form.id, data); else await createWebsiteArticleCategory(data);
    dialogVisible.value = false; await load(); ElMessage.success('资讯分类已保存');
  } finally { saving.value = false; }
}
async function toggleCategory(row: WebsiteArticleCategoryItem, value: string | number | boolean) {
  await updateWebsiteArticleCategory(row.id, { status: value ? 'ACTIVE' : 'DISABLED' }); row.status = value ? 'ACTIVE' : 'DISABLED'; ElMessage.success('分类状态已更新');
}
async function removeCategory(row: WebsiteArticleCategoryItem) {
  await ElMessageBox.confirm(`确认删除分类“${row.name}”？`, '删除确认', { type: 'warning' });
  await deleteWebsiteArticleCategory(row.id); await load(); ElMessage.success('资讯分类已删除');
}
onMounted(load);
</script>
<style scoped>
.operation-actions { display: flex; gap: 6px; white-space: nowrap; }.operation-actions :deep(.el-button) { margin: 0; }.field-tip { margin-top: 5px; color: var(--admin-text-muted); font-size: 12px; }
</style>
