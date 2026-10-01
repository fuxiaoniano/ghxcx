<template>
  <div class="page-heading">
    <div>
      <h1 class="page-title">角色管理</h1>
      <p>创建后台角色并按左侧导航页面配置权限；角色权限修改后会同步应用到该角色的全部成员。</p>
    </div>
    <el-button type="primary" @click="openCreate"><el-icon><Plus /></el-icon>新增角色</el-button>
  </div>

  <section class="content-panel">
    <el-table :data="roles" v-loading="loading" row-key="id">
      <el-table-column prop="name" label="角色名称" min-width="150" />
      <el-table-column prop="description" label="角色说明" min-width="210">
        <template #default="{ row }">{{ row.description || '—' }}</template>
      </el-table-column>
      <el-table-column label="角色权限" min-width="420">
        <template #default="{ row }">
          <div class="permission-summary">
            <el-tag v-for="permission in row.permissions.slice(0, 8)" :key="permission" size="small" effect="plain">{{ adminPermissionLabel(permission) }}</el-tag>
            <el-tag v-if="row.permissions.length > 8" size="small" type="info">另有 {{ row.permissions.length - 8 }} 项</el-tag>
            <span v-if="!row.permissions.length" class="empty-text">暂无权限</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="memberCount" label="成员数" width="90" align="center" />
      <el-table-column label="数据范围" width="150"><template #default="{ row }">{{ scopeLabel(row.dataScope) }}</template></el-table-column>
      <el-table-column label="更新时间" width="170"><template #default="{ row }">{{ formatDate(row.updatedAt) }}</template></el-table-column>
      <el-table-column label="操作" width="130" fixed="right" align="center">
        <template #default="{ row }">
          <div class="row-actions"><el-button link type="primary" @click="openEdit(row)">编辑</el-button><el-button link type="danger" @click="removeRole(row)">删除</el-button></div>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!loading && !roles.length" description="暂无自定义角色，请点击右上角新增角色" />
  </section>

  <el-dialog v-model="dialogVisible" :title="form.id ? '修改角色' : '新增角色'" width="960px" class="role-dialog" destroy-on-close>
    <el-form label-position="top">
      <div class="basic-grid">
        <el-form-item label="角色名称" required><el-input v-model="form.name" maxlength="64" show-word-limit placeholder="例如：推广专员" /></el-form-item>
        <el-form-item label="角色说明"><el-input v-model="form.description" maxlength="255" show-word-limit placeholder="说明该角色的工作范围" /></el-form-item>
      </div>
      <div class="basic-grid">
        <el-form-item label="受管控业务数据范围" required><el-select v-model="form.dataScope"><el-option label="仅本人数据" value="SELF"/><el-option label="本人和指定成员" value="ASSIGNED_MEMBERS"/><el-option label="所在团队及下级团队" value="TEAM"/><el-option v-if="auth.user?.role==='SUPER_ADMIN'" label="全部数据" value="ALL"/></el-select></el-form-item>
        <el-form-item v-if="form.dataScope==='ASSIGNED_MEMBERS'" label="指定成员"><el-select v-model="form.dataScopeMemberIds" multiple filterable><el-option v-for="member in members" :key="member.id" :label="member.nickname||member.username" :value="member.id"/></el-select></el-form-item>
      </div>
      <el-form-item label="角色权限" required>
        <p class="permission-hint">权限与左侧导航及独立页面一一对应；未勾选的页面不会向该角色成员展示。</p>
        <div class="permission-groups">
          <section v-for="group in adminPermissionGroups" :key="group.label" class="permission-group">
            <div class="permission-group-heading">
              <strong>{{ group.label }}</strong>
              <el-button link type="primary" @click="toggleGroup(group.items.map((item) => item.value))">{{ groupSelected(group.items.map((item) => item.value)) ? '取消全选' : '全选' }}</el-button>
            </div>
            <el-checkbox-group v-model="form.permissions">
              <el-checkbox v-for="item in group.items" :key="item.value" :value="item.value">
                <span>{{ item.label }}</span><small>{{ item.pages }}</small>
              </el-checkbox>
            </el-checkbox-group>
          </section>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="saveRole">{{ form.id ? '保存修改' : '创建角色' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { createAdminRole, deleteAdminRole, getAdminRoles, getAdminUsers, updateAdminRole, type AdminRoleDefinitionItem, type AdminUserItem } from '../api/admin';
import { adminPermissionGroups, adminPermissionLabel } from '../constants/adminPermissions';
import { useAuthStore } from '../stores/auth';

const roles = ref<AdminRoleDefinitionItem[]>([]);
const members = ref<AdminUserItem[]>([]);
const auth = useAuthStore();
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const form = reactive({ id: '', name: '', description: '', permissions: [] as string[], dataScope: 'SELF', dataScopeMemberIds: [] as string[] });

async function load() {
  loading.value = true;
  try { const [roleRows,memberRows]=await Promise.all([getAdminRoles(),getAdminUsers({page:1,pageSize:200})]);roles.value=roleRows;members.value=memberRows.list; } finally { loading.value = false; }
}

function openCreate() {
  Object.assign(form, { id: '', name: '', description: '', permissions: [], dataScope: 'SELF', dataScopeMemberIds: [] });
  dialogVisible.value = true;
}

function openEdit(role: AdminRoleDefinitionItem) {
  Object.assign(form, { id: role.id, name: role.name, description: role.description || '', permissions: [...role.permissions], dataScope: role.dataScope || 'ALL', dataScopeMemberIds: [...(role.dataScopeMemberIds||[])] });
  dialogVisible.value = true;
}

function groupSelected(values: readonly string[]) { return values.every((value) => form.permissions.includes(value)); }
function toggleGroup(values: readonly string[]) {
  const selected = new Set(form.permissions);
  if (groupSelected(values)) values.forEach((value) => selected.delete(value));
  else values.forEach((value) => selected.add(value));
  form.permissions = [...selected];
}

async function saveRole() {
  if (form.name.trim().length < 2) return ElMessage.warning('角色名称至少需要 2 个字符');
  saving.value = true;
  try {
    const data = { name: form.name.trim(), description: form.description.trim(), permissions: form.permissions, dataScope: form.dataScope, dataScopeMemberIds: form.dataScope==='ASSIGNED_MEMBERS'?form.dataScopeMemberIds:[] };
    if (form.id) await updateAdminRole(form.id, data);
    else await createAdminRole(data);
    dialogVisible.value = false;
    ElMessage.success(form.id ? '角色已更新，成员权限已同步' : '角色已创建');
    await load();
  } finally { saving.value = false; }
}

async function removeRole(role: AdminRoleDefinitionItem) {
  const memberText = role.memberCount ? `当前有 ${role.memberCount} 名成员使用该角色；删除后这些成员会保留当前权限。` : '';
  await ElMessageBox.confirm(`${memberText}确认删除角色“${role.name}”吗？`, '删除角色', { type: 'warning', confirmButtonText: '删除角色' });
  await deleteAdminRole(role.id);
  ElMessage.success('角色已删除');
  await load();
}

function formatDate(value: string) { return new Date(value).toLocaleString('zh-CN', { hour12: false }); }
function scopeLabel(value:string){return {SELF:'仅本人',ASSIGNED_MEMBERS:'本人和指定成员',TEAM:'团队及下级',ALL:'全部数据'}[value]||value}
onMounted(load);
</script>

<style scoped>
.page-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; }
.page-heading .page-title { margin-bottom:4px; }
.page-heading p,.permission-hint,.empty-text { margin:0; color:var(--admin-text-muted); font-size:13px; }
.permission-summary { display:flex; flex-wrap:wrap; gap:5px; }
.row-actions { display:flex; align-items:center; justify-content:center; gap:12px; white-space:nowrap; }
.row-actions :deep(.el-button) { margin:0; padding:0 2px; }
.role-dialog :deep(.el-dialog__body) { max-height:min(72vh,720px); overflow-y:auto; padding-right:22px; }
.basic-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
.permission-hint { margin-bottom:10px; }
.permission-groups { display:grid; width:100%; grid-template-columns:repeat(2,minmax(0,1fr)); align-items:start; gap:12px; }
.permission-group { padding:11px 13px; border:1px solid var(--admin-border); border-radius:8px; background:#fafcff; }
.permission-group-heading { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; color:var(--admin-primary); }
.permission-group :deep(.el-checkbox-group) { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px 12px; }
.permission-group :deep(.el-checkbox) { display:flex; height:auto; margin-right:0; align-items:flex-start; white-space:normal; }
.permission-group :deep(.el-checkbox__label) { display:flex; min-width:0; flex-direction:column; gap:2px; line-height:1.35; }
.permission-group :deep(.el-checkbox__label small) { color:var(--admin-text-muted); font-size:11px; }
@media(max-width:760px){.page-heading{flex-direction:column}.basic-grid,.permission-groups,.permission-group :deep(.el-checkbox-group){grid-template-columns:1fr}.role-dialog{width:calc(100vw - 24px)!important}}
</style>
