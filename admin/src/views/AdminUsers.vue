<template>
  <div class="page-heading">
    <div>
      <h1 class="page-title">成员与通知</h1>
      <p>成员绑定微信后即可扫码登录，并可按权限接收新的预约通知。</p>
    </div>
    <el-button type="primary" @click="openCreateDialog">
      <el-icon><Plus /></el-icon>添加成员
    </el-button>
  </div>

  <section class="content-panel notify-panel">
    <div class="section-heading">
      <div>
        <h2>预约通知</h2>
        <p>总开关关闭后，所有成员都不会收到新预约通知。</p>
      </div>
      <el-switch v-model="notifyForm.enabled" inline-prompt active-text="已启用" inactive-text="已关闭" />
    </div>
    <el-form class="notify-form" label-position="top">
      <el-form-item label="公众号消息模板 ID">
        <el-input v-model="notifyForm.templateId" placeholder="请输入用于工作人员预约提醒的模板 ID" />
      </el-form-item>
      <el-button type="primary" :loading="savingNotify" @click="saveNotifyConfig">保存通知设置</el-button>
    </el-form>
  </section>

  <section class="content-panel">
    <div class="section-heading members-heading">
      <div>
        <h2>后台成员</h2>
        <p>“接收通知”只对已绑定公众号微信且账号已启用的成员生效。</p>
      </div>
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="搜索昵称" clearable @keyup.enter="loadMembers">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button @click="loadMembers">查询</el-button>
      </div>
    </div>

    <el-table :data="rows" v-loading="loading" row-key="id">
      <el-table-column label="成员" min-width="160">
        <template #default="{ row }">
          <div class="member-cell">
            <span class="member-avatar">{{ row.nickname.slice(0, 1) }}</span>
            <div><strong>{{ row.nickname }}</strong><small>{{ roleLabel(row.role) }}</small></div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="微信状态" min-width="175">
        <template #default="{ row }">
          <div class="status-stack">
            <el-tag :type="row.wechatBound ? 'success' : 'warning'" size="small">
              {{ row.wechatBound ? '已绑定微信' : '未绑定微信' }}
            </el-tag>
            <small v-if="row.oaOpenIdMasked">{{ row.oaOpenIdMasked }}</small>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="接收预约通知" width="145" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.notifyEnabled"
            :disabled="!row.wechatBound || row.status !== 'ACTIVE'"
            @change="toggleNotify(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="账号状态" width="105">
        <template #default="{ row }">
          <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">
            {{ row.status === 'ACTIVE' ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="权限" min-width="220">
        <template #default="{ row }">
          <span v-if="row.role === 'SUPER_ADMIN'" class="all-permissions">全部权限</span>
          <template v-else>
            <el-tag v-for="permission in row.permissions" :key="permission" size="small" effect="plain" class="permission-tag">
              {{ permissionLabel(permission) }}
            </el-tag>
          </template>
        </template>
      </el-table-column>
      <el-table-column label="最近登录" width="170">
        <template #default="{ row }">{{ formatDate(row.lastLoginAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button v-if="!row.wechatBound" text type="primary" @click="reissueWechatInvite(row)">绑定微信</el-button>
          <el-button text type="primary" @click="openEditDialog(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      class="pagination"
      layout="prev, pager, next, total"
      :total="total"
      :page-size="query.pageSize"
      :current-page="query.page"
      @current-change="changePage"
    />
  </section>

  <section v-if="invitations.length" class="content-panel pending-panel">
    <div class="section-heading">
      <div><h2>待绑定成员</h2><p>邀请链接七天内有效；链接丢失后请取消并重新生成。</p></div>
    </div>
    <div class="invite-list">
      <div v-for="invite in invitations" :key="invite.id" class="invite-row">
        <div><strong>{{ invite.nickname }}</strong><span>{{ roleLabel(invite.role) }} · {{ formatDate(invite.expiresAt) }} 到期</span></div>
        <el-button text type="danger" @click="cancelInvite(invite.id)">取消邀请</el-button>
      </div>
    </div>
  </section>

  <el-dialog v-model="memberDialogVisible" :title="memberForm.id ? '编辑成员' : '添加成员'" width="620px" destroy-on-close>
    <el-alert v-if="!memberForm.id" title="填写资料后会生成微信绑定二维码。对方完成绑定后，成员账号才会正式创建。" type="info" :closable="false" show-icon />
    <el-form class="member-form" label-position="top">
      <el-form-item label="成员昵称" required><el-input v-model="memberForm.nickname" maxlength="32" show-word-limit placeholder="例如：前台小周" /></el-form-item>
      <div class="form-grid">
        <el-form-item label="角色">
          <el-select v-model="memberForm.role" style="width: 100%">
            <el-option label="员工" value="STAFF" />
            <el-option label="经理" value="MANAGER" />
            <el-option label="超级管理员" value="SUPER_ADMIN" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="memberForm.id" label="账号状态">
          <el-select v-model="memberForm.status" style="width: 100%">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
      </div>
      <el-form-item label="权限">
        <el-checkbox-group v-model="memberForm.permissions">
          <el-checkbox v-for="item in permissionOptions" :key="item.value" :value="item.value">{{ item.label }}</el-checkbox>
        </el-checkbox-group>
      </el-form-item>
      <el-form-item>
        <div class="notify-choice">
          <div><strong>接收新预约通知</strong><span>有新挂号时通过公众号消息提醒此成员</span></div>
          <el-switch v-model="memberForm.notifyEnabled" />
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="memberDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="savingMember" @click="saveMember">{{ memberForm.id ? '保存修改' : '生成微信绑定二维码' }}</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="bindDialogVisible" title="邀请微信绑定" width="480px" :close-on-click-modal="false">
    <div v-if="createdInvite?.bindUrl" class="bind-content">
      <div class="qr-frame"><QrcodeVue :value="createdInvite.bindUrl" :size="210" level="M" /></div>
      <h3>{{ createdInvite.nickname }}</h3>
      <p>请让该成员使用微信扫码，并确认绑定后台账号。</p>
      <div class="bind-actions">
        <el-button @click="copyBindUrl"><el-icon><CopyDocument /></el-icon>复制绑定链接</el-button>
        <el-button type="primary" tag="a" :href="createdInvite.bindUrl" target="_blank">在微信环境打开</el-button>
      </div>
      <el-alert title="二维码关闭后不会再次显示；若尚未绑定，可取消该邀请后重新生成。" type="warning" :closable="false" show-icon />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { CopyDocument, Plus, Search } from '@element-plus/icons-vue';
import QrcodeVue from 'qrcode.vue';
import {
  AdminUserItem,
  AdminWechatInviteItem,
  cancelAdminWechatInvitation,
  createExistingAdminWechatInvitation,
  createAdminWechatInvitation,
  getAdminUsers,
  getAdminWechatInvitations,
  getAppointmentNotifyConfig,
  updateAdminUser,
  updateAppointmentNotifyConfig
} from '../api/admin';

const permissionOptions = [
  { value: 'VIEW_FULL_PHONE', label: '查看完整手机号' },
  { value: 'EXPORT_FULL_PHONE', label: '导出完整手机号' },
  { value: 'MANAGE_APPOINTMENTS', label: '管理挂号' },
  { value: 'MANAGE_CONFIGS', label: '管理配置' },
  { value: 'MANAGE_ADMINS', label: '管理成员' }
];

const rows = ref<AdminUserItem[]>([]);
const invitations = ref<AdminWechatInviteItem[]>([]);
const createdInvite = ref<AdminWechatInviteItem | null>(null);
const total = ref(0);
const loading = ref(false);
const savingMember = ref(false);
const savingNotify = ref(false);
const memberDialogVisible = ref(false);
const bindDialogVisible = ref(false);
const query = reactive({ page: 1, pageSize: 20, keyword: '' });
const notifyForm = reactive({ enabled: true, templateId: '' });
const memberForm = reactive({
  id: '',
  nickname: '',
  role: 'STAFF',
  status: 'ACTIVE',
  permissions: ['VIEW_FULL_PHONE', 'MANAGE_APPOINTMENTS'] as string[],
  notifyEnabled: true
});

async function loadMembers() {
  loading.value = true;
  try {
    const result = await getAdminUsers(query);
    rows.value = result.list;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

async function loadAll() {
  const [notify, pending] = await Promise.all([getAppointmentNotifyConfig(), getAdminWechatInvitations()]);
  notifyForm.enabled = notify.enabled;
  notifyForm.templateId = notify.templateId || '';
  invitations.value = pending;
  await loadMembers();
}

function changePage(page: number) {
  query.page = page;
  loadMembers();
}

function openCreateDialog() {
  Object.assign(memberForm, {
    id: '', nickname: '', role: 'STAFF', status: 'ACTIVE',
    permissions: ['VIEW_FULL_PHONE', 'MANAGE_APPOINTMENTS'], notifyEnabled: true
  });
  memberDialogVisible.value = true;
}

function openEditDialog(row: AdminUserItem) {
  Object.assign(memberForm, {
    id: row.id,
    nickname: row.nickname,
    role: row.role,
    status: row.status,
    permissions: [...row.permissions],
    notifyEnabled: row.notifyEnabled
  });
  memberDialogVisible.value = true;
}

async function saveMember() {
  if (!memberForm.nickname.trim()) {
    ElMessage.warning('请填写成员昵称');
    return;
  }
  savingMember.value = true;
  try {
    if (memberForm.id) {
      await updateAdminUser(memberForm.id, {
        nickname: memberForm.nickname.trim(),
        role: memberForm.role,
        status: memberForm.status,
        permissions: memberForm.permissions,
        notifyEnabled: memberForm.notifyEnabled
      });
      memberDialogVisible.value = false;
      ElMessage.success('成员资料已保存');
      await loadMembers();
    } else {
      const invite = await createAdminWechatInvitation({
        nickname: memberForm.nickname.trim(),
        role: memberForm.role,
        permissions: memberForm.permissions,
        notifyEnabled: memberForm.notifyEnabled
      });
      createdInvite.value = invite;
      memberDialogVisible.value = false;
      bindDialogVisible.value = true;
      await loadAll();
    }
  } finally {
    savingMember.value = false;
  }
}

async function saveNotifyConfig() {
  savingNotify.value = true;
  try {
    await updateAppointmentNotifyConfig({ enabled: notifyForm.enabled, templateId: notifyForm.templateId.trim() });
    ElMessage.success('预约通知设置已保存');
  } finally {
    savingNotify.value = false;
  }
}

async function toggleNotify(row: AdminUserItem) {
  const next = row.notifyEnabled;
  try {
    await updateAdminUser(row.id, { notifyEnabled: next });
    ElMessage.success(next ? '已开启该成员的预约通知' : '已关闭该成员的预约通知');
  } catch (error) {
    row.notifyEnabled = !next;
    throw error;
  }
}

async function cancelInvite(id: string) {
  await ElMessageBox.confirm('取消后原绑定链接将立即失效，确认取消吗？', '取消邀请', { type: 'warning' });
  await cancelAdminWechatInvitation(id);
  invitations.value = await getAdminWechatInvitations();
  ElMessage.success('邀请已取消');
}

async function reissueWechatInvite(row: AdminUserItem) {
  const invite = await createExistingAdminWechatInvitation(row.id);
  createdInvite.value = invite;
  bindDialogVisible.value = true;
  invitations.value = await getAdminWechatInvitations();
}

async function copyBindUrl() {
  if (!createdInvite.value?.bindUrl) return;
  await navigator.clipboard.writeText(createdInvite.value.bindUrl);
  ElMessage.success('绑定链接已复制');
}

function permissionLabel(value: string) {
  return permissionOptions.find((item) => item.value === value)?.label || value;
}

function roleLabel(value: string) {
  return ({ SUPER_ADMIN: '超级管理员', MANAGER: '经理', STAFF: '员工' } as Record<string, string>)[value] || value;
}

function formatDate(value?: string) {
  if (!value) return '尚未登录';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

onMounted(loadAll);
</script>

<style scoped>
.page-heading, .section-heading, .notify-choice, .invite-row, .member-cell { display: flex; align-items: center; }
.page-heading { justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.page-heading .page-title { margin-bottom: 2px; }
.page-heading p, .section-heading p { margin: 0; color: var(--admin-text-muted); font-size: 13px; }
.content-panel + .content-panel { margin-top: 16px; }
.section-heading { justify-content: space-between; gap: 18px; margin-bottom: 20px; }
.section-heading h2 { margin: 0 0 4px; color: var(--admin-text); font-size: 16px; }
.notify-panel { border-left: 3px solid var(--admin-primary); }
.notify-form { display: grid; grid-template-columns: minmax(280px, 620px) auto; align-items: end; gap: 12px; }
.notify-form :deep(.el-form-item) { margin-bottom: 0; }
.toolbar { display: flex; gap: 8px; }
.toolbar .el-input { width: 220px; }
.member-cell { gap: 10px; }
.member-avatar { display: grid; flex: 0 0 36px; width: 36px; height: 36px; place-items: center; color: #fff; background: var(--admin-primary); border-radius: 6px; font-weight: 700; }
.member-cell > div, .status-stack { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; gap: 3px; }
.member-cell strong { color: var(--admin-text); font-size: 14px; }
.member-cell small, .status-stack small, .invite-row span { color: var(--admin-text-muted); font-size: 11px; }
.permission-tag { margin: 2px 5px 2px 0; }
.all-permissions { color: var(--admin-primary); font-size: 13px; font-weight: 600; }
.pagination { justify-content: flex-end; margin-top: 18px; }
.invite-list { border-top: 1px solid var(--admin-border); }
.invite-row { justify-content: space-between; gap: 16px; padding: 14px 2px; border-bottom: 1px solid var(--admin-border); }
.invite-row > div { display: flex; flex-direction: column; gap: 4px; }
.member-form { margin-top: 20px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.member-form :deep(.el-checkbox-group) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 14px; }
.notify-choice { width: 100%; justify-content: space-between; gap: 16px; padding: 12px 14px; background: #f5f8f7; border: 1px solid var(--admin-border); border-radius: 6px; }
.notify-choice > div { display: flex; flex-direction: column; gap: 3px; }
.notify-choice span { color: var(--admin-text-muted); font-size: 12px; }
.bind-content { display: flex; flex-direction: column; align-items: center; text-align: center; }
.qr-frame { padding: 12px; background: #fff; border: 1px solid var(--admin-border); border-radius: 6px; }
.bind-content h3 { margin: 16px 0 5px; color: var(--admin-text); }
.bind-content > p { margin: 0 0 16px; color: var(--admin-text-muted); }
.bind-actions { display: flex; gap: 10px; margin-bottom: 18px; }
.bind-content .el-alert { text-align: left; }
@media (max-width: 760px) {
  .page-heading, .members-heading { align-items: flex-start; flex-direction: column; }
  .notify-form { grid-template-columns: 1fr; }
  .toolbar, .toolbar .el-input { width: 100%; }
  .form-grid, .member-form :deep(.el-checkbox-group) { grid-template-columns: 1fr; }
}
</style>
