<template>
  <div class="page-heading"><h1 class="page-title">团队管理</h1><el-button type="primary" @click="openTeam()">新增团队</el-button></div>
  <section class="content-panel team-table-wrap">
    <el-table :data="teams" row-key="id" v-loading="loading" class="team-table">
      <el-table-column prop="name" label="团队名称" min-width="160" />
      <el-table-column label="上级团队" min-width="160"><template #default="{ row }">{{ teams.find(item => item.id === row.parentId)?.name || '—' }}</template></el-table-column>
      <el-table-column label="负责人" min-width="160"><template #default="{ row }">{{ row.leader?.nickname || row.leader?.username || '—' }}</template></el-table-column>
      <el-table-column label="成员 / 下级" min-width="120"><template #default="{ row }">{{ row._count?.members || 0 }} / {{ row._count?.children || 0 }}</template></el-table-column>
      <el-table-column label="状态" min-width="90"><template #default="{ row }"><el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status === 'ACTIVE' ? '启用' : '停用' }}</el-tag></template></el-table-column>
      <el-table-column label="操作" min-width="140"><template #default="{ row }"><el-button link type="primary" @click="openTeam(row)">编辑</el-button><el-button link type="danger" @click="removeTeam(row)">删除</el-button></template></el-table-column>
    </el-table>
  </section>
  <el-dialog v-model="dialogVisible" :title="form.id ? '编辑团队' : '新增团队'" width="min(560px, 94vw)">
    <el-form label-position="top">
      <el-form-item label="团队名称" required><el-input v-model="form.name" /></el-form-item>
      <el-form-item label="上级团队"><el-select v-model="form.parentId" clearable><el-option v-for="team in teams.filter(item => item.id !== form.id)" :key="team.id" :label="team.name" :value="team.id" /></el-select></el-form-item>
      <el-form-item label="团队负责人"><el-select v-model="form.leaderAdminId" clearable filterable><el-option v-for="member in members.filter(item => item.status === 'ACTIVE')" :key="member.id" :label="member.nickname || member.username" :value="member.id" /></el-select></el-form-item>
      <el-form-item label="状态"><el-select v-model="form.status"><el-option label="启用" value="ACTIVE" /><el-option label="停用" value="DISABLED" /></el-select></el-form-item>
    </el-form>
    <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="saveTeam">保存</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { createAdminTeam, deleteAdminTeam, getAdminTeams, getAdminUsers, updateAdminTeam, type AdminTeamItem, type AdminUserItem } from '../api/admin';

const teams = ref<AdminTeamItem[]>([]);
const members = ref<AdminUserItem[]>([]);
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const form = reactive({ id: '', name: '', parentId: '', leaderAdminId: '', status: 'ACTIVE' });

async function load() {
  loading.value = true;
  try {
    const [teamRows, memberRows] = await Promise.all([getAdminTeams(), getAdminUsers({ page: 1, pageSize: 200 })]);
    teams.value = teamRows;
    members.value = memberRows.list;
  } finally { loading.value = false; }
}
function openTeam(row?: AdminTeamItem) {
  Object.assign(form, { id: row?.id || '', name: row?.name || '', parentId: row?.parentId || '', leaderAdminId: row?.leaderAdminId || '', status: row?.status || 'ACTIVE' });
  dialogVisible.value = true;
}
async function saveTeam() {
  if (!form.name.trim()) return ElMessage.warning('请输入团队名称');
  saving.value = true;
  try {
    const data: Partial<AdminTeamItem> = { name: form.name.trim(), parentId: form.parentId || null, leaderAdminId: form.leaderAdminId || null, status: form.status as 'ACTIVE' | 'DISABLED' };
    if (form.id) await updateAdminTeam(form.id, data);
    else await createAdminTeam(data);
    dialogVisible.value = false;
    teams.value = await getAdminTeams();
    ElMessage.success('团队设置已保存');
  } finally { saving.value = false; }
}
async function removeTeam(row: AdminTeamItem) {
  await ElMessageBox.confirm('仅无成员且无下级的团队可以删除。', '删除团队', { type: 'warning' });
  await deleteAdminTeam(row.id);
  teams.value = await getAdminTeams();
}
onMounted(load);
</script>

<style scoped>
.page-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}.team-table-wrap{overflow-x:auto}.team-table{min-width:830px}.el-select{width:100%}@media(max-width:640px){.page-heading{align-items:stretch;flex-direction:column}.page-heading .el-button{width:100%}}
</style>
