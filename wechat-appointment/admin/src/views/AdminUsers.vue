<template>
  <div class="page-heading">
    <div>
      <h1 class="page-title">成员管理</h1>
      <p>成员可使用账号密码登录；微信绑定为可选，绑定后可扫码登录并接收预约通知。</p>
    </div>
    <el-button type="primary" @click="openCreateDialog">
      <el-icon><Plus /></el-icon>添加成员
    </el-button>
  </div>

  <section class="content-panel">
    <div class="section-heading"><div><h2>团队管理</h2><p>团队层级用于 TEAM 数据范围；成员调岗后可见范围按当前主团队即时重新计算。</p></div><el-button type="primary" @click="openTeam()">新增团队</el-button></div>
    <el-table :data="teams" row-key="id"><el-table-column prop="name" label="团队名称"/><el-table-column label="上级团队"><template #default="{row}">{{teams.find(item=>item.id===row.parentId)?.name||'—'}}</template></el-table-column><el-table-column label="负责人"><template #default="{row}">{{row.leader?.nickname||row.leader?.username||'—'}}</template></el-table-column><el-table-column label="成员/下级" width="120"><template #default="{row}">{{row._count?.members||0}} / {{row._count?.children||0}}</template></el-table-column><el-table-column label="状态" width="90"><template #default="{row}"><el-tag :type="row.status==='ACTIVE'?'success':'info'">{{row.status==='ACTIVE'?'启用':'停用'}}</el-tag></template></el-table-column><el-table-column label="操作" width="140"><template #default="{row}"><el-button link type="primary" @click="openTeam(row)">编辑</el-button><el-button link type="danger" @click="removeTeam(row)">删除</el-button></template></el-table-column></el-table>
  </section>

  <section class="content-panel">
    <div class="section-heading members-heading">
      <div>
        <h2>后台成员</h2>
        <p>“接收通知”只对已绑定公众号微信且账号已启用的成员生效。</p>
      </div>
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="搜索登录账号" clearable @keyup.enter="loadMembers">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button @click="loadMembers">查询</el-button>
      </div>
    </div>

    <el-table :data="rows" v-loading="loading" row-key="id">
      <el-table-column label="成员" min-width="160">
        <template #default="{ row }">
          <div class="member-cell">
            <span class="member-avatar">{{ row.username.slice(0, 1) }}</span>
            <div><strong>{{ row.username }}</strong><small>{{ row.roleName || roleLabel(row.role) }}</small></div>
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
      <el-table-column label="团队 / 数据范围" min-width="160"><template #default="{row}"><div class="status-stack"><strong>{{row.team?.name||'未分组'}}</strong><small>{{scopeLabel(row.dataScope)}}</small></div></template></el-table-column>
      <el-table-column label="权限" min-width="220">
        <template #default="{ row }">
          <span v-if="row.role === 'SUPER_ADMIN'" class="all-permissions">全部权限</span>
          <div v-else class="permission-summary-cell">
            <el-tag v-for="permission in (row.permissions || []).slice(0, 2)" :key="permission" size="small" effect="plain" class="permission-tag">
              {{ permissionLabel(permission) }}
            </el-tag>
            <el-popover v-if="(row.permissions || []).length > 2" placement="bottom-start" trigger="click" :width="360">
              <template #reference>
                <el-button link type="primary" size="small" class="permission-more">+{{ row.permissions.length - 2 }} 项</el-button>
              </template>
              <div class="permission-popover-title">{{ row.username }} · 全部权限（{{ row.permissions.length }}）</div>
              <div class="permission-popover-list">
                <el-tag v-for="permission in row.permissions" :key="permission" size="small" effect="plain">
                  {{ permissionLabel(permission) }}
                </el-tag>
              </div>
            </el-popover>
            <span v-if="!(row.permissions || []).length" class="empty-permissions">暂无权限</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="最近登录" width="170">
        <template #default="{ row }">{{ formatDate(row.lastLoginAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right" align="center">
        <template #default="{ row }">
          <div class="member-actions">
            <el-button v-if="!row.wechatBound" link type="primary" @click="reissueWechatInvite(row)">绑定微信</el-button>
            <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="removeMember(row)">删除</el-button>
          </div>
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

  <el-dialog v-model="memberDialogVisible" :title="memberForm.id ? '编辑成员' : '添加成员'" width="1040px" class="member-dialog" destroy-on-close>
    <el-alert v-if="!memberForm.id" title="成员创建后即可使用账号密码登录，微信无需立即绑定；需要扫码登录或接收预约通知时，可在成员列表中点击“绑定微信”。" type="info" :closable="false" show-icon />
    <el-form class="member-form" label-position="top">
      <div class="form-grid">
        <el-form-item label="成员名称（登录账号）" required><el-input v-model="memberForm.username" maxlength="64" placeholder="例如：前台小周；可使用中文、字母或数字" /></el-form-item>
        <el-form-item :label="memberForm.id ? '重设登录密码' : '登录密码'" :required="!memberForm.id"><el-input v-model="memberForm.password" type="password" show-password maxlength="128" :placeholder="memberForm.id ? '不修改请留空' : '至少 8 位'" /></el-form-item>
        <el-form-item label="确认密码" :required="!memberForm.id || Boolean(memberForm.password)"><el-input v-model="memberForm.passwordConfirm" type="password" show-password maxlength="128" :placeholder="memberForm.id && !memberForm.password ? '不修改请留空' : '再次输入密码'" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="memberForm.roleSelection" style="width: 100%" @change="applySelectedRole">
            <el-option label="员工" value="STAFF" />
            <el-option label="经理" value="MANAGER" />
            <el-option label="超级管理员" value="SUPER_ADMIN" />
            <el-option-group v-if="customRoles.length" label="自定义角色">
              <el-option v-for="role in customRoles" :key="role.id" :label="role.name" :value="`CUSTOM:${role.id}`" />
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item v-if="memberForm.id" label="账号状态">
          <el-select v-model="memberForm.status" style="width: 100%">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
        <el-form-item label="主团队"><el-select v-model="memberForm.teamId" clearable><el-option v-for="team in teams.filter(item=>item.status==='ACTIVE')" :key="team.id" :label="team.name" :value="team.id"/></el-select></el-form-item>
        <el-form-item label="数据范围"><el-select v-model="memberForm.dataScope" :disabled="Boolean(memberForm.customRoleId)||memberForm.role==='SUPER_ADMIN'"><el-option label="仅本人数据" value="SELF"/><el-option label="本人和指定成员" value="ASSIGNED_MEMBERS"/><el-option label="团队及下级团队" value="TEAM"/><el-option v-if="auth.user?.role==='SUPER_ADMIN'" label="全部数据" value="ALL"/></el-select></el-form-item>
        <el-form-item v-if="memberForm.dataScope==='ASSIGNED_MEMBERS'" label="指定可见成员" class="form-grid-full"><el-select v-model="memberForm.dataScopeMemberIds" multiple filterable :disabled="Boolean(memberForm.customRoleId)"><el-option v-for="member in memberOptions.filter(item=>item.id!==memberForm.id)" :key="member.id" :label="member.username" :value="member.id"/></el-select></el-form-item>
        <el-form-item label="可接收网咨表单"><el-switch v-model="memberForm.consultationReceivable"/></el-form-item>
        <el-form-item label="查看完整手机号"><el-switch :model-value="hasMemberPermission('VIEW_FULL_PHONE')" :disabled="Boolean(memberForm.customRoleId) || memberForm.role === 'SUPER_ADMIN'" @change="setMemberPermission('VIEW_FULL_PHONE', $event)" /></el-form-item>
        <el-form-item label="导出完整手机号"><el-switch :model-value="hasMemberPermission('EXPORT_FULL_PHONE')" :disabled="Boolean(memberForm.customRoleId) || memberForm.role === 'SUPER_ADMIN'" @change="setMemberPermission('EXPORT_FULL_PHONE', $event)" /></el-form-item>
      </div>
      <el-form-item label="权限">
        <p class="permission-hint">{{ memberForm.customRoleId ? '当前权限由所选自定义角色统一管理；请前往“角色管理”修改。' : '按左侧导航分类授权；勾选后该成员仅能看到并操作对应板块中的页面。' }}</p>
        <div class="permission-groups">
          <section v-for="group in permissionGroups" :key="group.label" class="permission-group">
            <div class="permission-group-title">{{ group.label }}</div>
            <el-checkbox-group v-model="memberForm.permissions" :disabled="Boolean(memberForm.customRoleId)">
              <el-checkbox v-for="item in group.items" :key="item.value" :value="item.value">
                <span>{{ item.label }}</span><small>{{ item.pages }}</small>
              </el-checkbox>
            </el-checkbox-group>
          </section>
        </div>
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
      <el-button type="primary" :loading="savingMember" @click="saveMember">{{ memberForm.id ? '保存修改' : '创建成员' }}</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="deleteDialogVisible" title="删除成员并交接数据" width="620px"><el-alert title="删除成员前必须把当前负责的业务数据交接给一名启用成员；任一步失败都会整体回滚。" type="warning" :closable="false"/><el-descriptions v-if="handoverSummary" :column="2" border class="handover-summary"><el-descriptions-item label="网咨表单">{{handoverSummary.consultations}}</el-descriptions-item><el-descriptions-item label="今日需回访">{{handoverSummary.todayCallbacks}}</el-descriptions-item><el-descriptions-item label="逾期未回访">{{handoverSummary.overdueCallbacks}}</el-descriptions-item><el-descriptions-item label="挂号负责人数据">{{handoverSummary.appointments}}</el-descriptions-item><el-descriptions-item label="推广账户">{{handoverSummary.promotionAccounts}}</el-descriptions-item><el-descriptions-item label="广告线索">{{handoverSummary.tencentLeads}}</el-descriptions-item></el-descriptions><el-form label-position="top"><el-form-item label="新归属成员" required><el-select v-model="successorAdminId" filterable placeholder="请选择接收人"><el-option v-for="member in memberOptions.filter(item=>item.id!==deletingMember?.id&&item.status==='ACTIVE')" :key="member.id" :label="member.username" :value="member.id"/></el-select></el-form-item></el-form><template #footer><el-button @click="deleteDialogVisible=false">取消</el-button><el-button type="danger" :loading="deleting" @click="confirmDeleteMember">确认交接并删除</el-button></template></el-dialog>

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
  <el-dialog v-model="teamDialogVisible" :title="teamForm.id?'编辑团队':'新增团队'" width="560px"><el-form label-position="top"><el-form-item label="团队名称" required><el-input v-model="teamForm.name"/></el-form-item><el-form-item label="上级团队"><el-select v-model="teamForm.parentId" clearable><el-option v-for="team in teams.filter(item=>item.id!==teamForm.id)" :key="team.id" :label="team.name" :value="team.id"/></el-select></el-form-item><el-form-item label="团队负责人"><el-select v-model="teamForm.leaderAdminId" clearable filterable><el-option v-for="member in memberOptions.filter(item=>item.status==='ACTIVE')" :key="member.id" :label="member.username" :value="member.id"/></el-select></el-form-item><el-form-item label="状态"><el-select v-model="teamForm.status"><el-option label="启用" value="ACTIVE"/><el-option label="停用" value="DISABLED"/></el-select></el-form-item></el-form><template #footer><el-button @click="teamDialogVisible=false">取消</el-button><el-button type="primary" @click="saveTeam">保存</el-button></template></el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { CopyDocument, Plus, Search } from '@element-plus/icons-vue';
import QrcodeVue from 'qrcode.vue';
import {
  AdminUserItem,
  AdminRoleDefinitionItem,
  AdminWechatInviteItem,
  AdminTeamItem,
  cancelAdminWechatInvitation,
  createAdminUser,
  createExistingAdminWechatInvitation,
  deleteAdminUser,
  getAdminUserHandoverSummary,
  getAdminTeams,
  createAdminTeam,
  updateAdminTeam,
  deleteAdminTeam,
  getAdminUsers,
  getAdminRoles,
  getAdminWechatInvitations,
  updateAdminUser,
} from '../api/admin';
import { adminPermissionGroups, adminPermissionOptions } from '../constants/adminPermissions';
import { useAuthStore } from '../stores/auth';

const permissionGroups = (adminPermissionGroups as readonly { label: string; items: readonly { value: string; label: string; pages: string }[] }[])
  .filter((group) => group.label !== '手机号与隐私权限');
const permissionOptions = adminPermissionOptions;

const rows = ref<AdminUserItem[]>([]);
const memberOptions = ref<AdminUserItem[]>([]);
const teams = ref<AdminTeamItem[]>([]);
const auth = useAuthStore();
const customRoles = ref<AdminRoleDefinitionItem[]>([]);
const invitations = ref<AdminWechatInviteItem[]>([]);
const createdInvite = ref<AdminWechatInviteItem | null>(null);
const total = ref(0);
const loading = ref(false);
const savingMember = ref(false);
const memberDialogVisible = ref(false);
const bindDialogVisible = ref(false);
const teamDialogVisible = ref(false);
const deleteDialogVisible = ref(false);
const deleting = ref(false);
const deletingMember = ref<AdminUserItem|null>(null);
const successorAdminId = ref('');
const handoverSummary = ref<any>(null);
const query = reactive({ page: 1, pageSize: 20, keyword: '' });
const memberForm = reactive({
  id: '',
  username: '',
  password: '',
  passwordConfirm: '',
  role: 'STAFF',
  roleSelection: 'STAFF',
  customRoleId: '' as string,
  status: 'ACTIVE',
  permissions: [] as string[],
  notifyEnabled: true
  ,dataScope: 'SELF', dataScopeMemberIds: [] as string[], teamId: '', consultationReceivable: false
});
const teamForm=reactive({id:'',name:'',parentId:'',leaderAdminId:'',status:'ACTIVE'});

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
  const [pending, roles, teamRows, allMembers] = await Promise.all([getAdminWechatInvitations(), getAdminRoles(), getAdminTeams(), getAdminUsers({ page: 1, pageSize: 200 })]);
  invitations.value = pending;
  customRoles.value = roles;
  teams.value = teamRows;
  memberOptions.value = allMembers.list;
  await loadMembers();
}

function changePage(page: number) {
  query.page = page;
  loadMembers();
}

function openCreateDialog() {
  Object.assign(memberForm, {
    id: '', username: '', password: '', passwordConfirm: '', role: 'STAFF', roleSelection: 'STAFF', customRoleId: '', status: 'ACTIVE',
    permissions: [], notifyEnabled: true, dataScope:'SELF',dataScopeMemberIds:[],teamId:'',consultationReceivable:false
  });
  memberDialogVisible.value = true;
}

function hasMemberPermission(permission: string) {
  return memberForm.role === 'SUPER_ADMIN' || memberForm.permissions.includes(permission);
}

function setMemberPermission(permission: string, enabled: string | number | boolean) {
  if (memberForm.customRoleId || memberForm.role === 'SUPER_ADMIN') return;
  const next = new Set(memberForm.permissions);
  if (enabled) next.add(permission); else next.delete(permission);
  memberForm.permissions = [...next];
}

function openEditDialog(row: AdminUserItem) {
  Object.assign(memberForm, {
    id: row.id,
    username: row.username,
    password: '',
    passwordConfirm: '',
    role: row.role,
    roleSelection: row.customRoleId ? `CUSTOM:${row.customRoleId}` : row.role,
    customRoleId: row.customRoleId || '',
    status: row.status,
    permissions: [...row.permissions],
    notifyEnabled: row.notifyEnabled,
    dataScope: row.role==='SUPER_ADMIN'?'ALL':(row.dataScope||'ALL'),dataScopeMemberIds:[...(row.dataScopeMemberIds||[])],teamId:row.teamId||'',consultationReceivable:row.consultationReceivable
  });
  memberDialogVisible.value = true;
}

function applySelectedRole(value: string) {
  if (value.startsWith('CUSTOM:')) {
    const roleId = value.slice(7);
    const role = customRoles.value.find((item) => item.id === roleId);
    memberForm.role = 'STAFF';
    memberForm.customRoleId = roleId;
    memberForm.permissions = role ? [...role.permissions] : [];
    memberForm.dataScope = role?.dataScope || 'SELF';
    memberForm.dataScopeMemberIds = [...(role?.dataScopeMemberIds || [])];
    return;
  }
  memberForm.role = value;
  memberForm.customRoleId = '';
  if (value === 'SUPER_ADMIN') { memberForm.permissions = permissionOptions.map((item) => item.value); memberForm.dataScope='ALL'; }
}

async function removeMember(row: AdminUserItem) {
  deletingMember.value=row;successorAdminId.value='';handoverSummary.value=await getAdminUserHandoverSummary(row.id);deleteDialogVisible.value=true;
}
async function confirmDeleteMember(){if(!deletingMember.value||!successorAdminId.value)return ElMessage.warning('请选择新归属成员');deleting.value=true;try{await deleteAdminUser(deletingMember.value.id,successorAdminId.value);ElMessage.success('成员数据已完成交接，原账号已停用删除');deleteDialogVisible.value=false;await loadAll()}finally{deleting.value=false}}

async function saveMember() {
  if (!/^[\p{L}\p{N}._-]{2,64}$/u.test(memberForm.username.trim())) {
    ElMessage.warning('登录账号需为 2–64 位，可使用中文、字母、数字、点、下划线或短横线');
    return;
  }
  if ((!memberForm.id || memberForm.password) && memberForm.password.length < 8) {
    ElMessage.warning('登录密码至少需要 8 位');
    return;
  }
  if (memberForm.password !== memberForm.passwordConfirm) {
    ElMessage.warning('两次输入的密码不一致');
    return;
  }
  savingMember.value = true;
  try {
    if (memberForm.id) {
      await updateAdminUser(memberForm.id, {
        username: memberForm.username.trim(),
        ...(memberForm.password ? { password: memberForm.password } : {}),
        role: memberForm.role,
        customRoleId: memberForm.customRoleId || null,
        status: memberForm.status,
        permissions: memberForm.permissions,
        notifyEnabled: memberForm.notifyEnabled,
        dataScope: memberForm.dataScope,dataScopeMemberIds:memberForm.dataScope==='ASSIGNED_MEMBERS'?memberForm.dataScopeMemberIds:[],teamId:memberForm.teamId||null,consultationReceivable:memberForm.consultationReceivable
      });
      memberDialogVisible.value = false;
      ElMessage.success('成员资料已保存');
      await loadMembers();
    } else {
      await createAdminUser({
        username: memberForm.username.trim(),
        password: memberForm.password,
        role: memberForm.role,
        ...(memberForm.customRoleId ? { customRoleId: memberForm.customRoleId } : {}),
        permissions: memberForm.permissions,
        notifyEnabled: memberForm.notifyEnabled,
        dataScope: memberForm.dataScope,dataScopeMemberIds:memberForm.dataScope==='ASSIGNED_MEMBERS'?memberForm.dataScopeMemberIds:[],teamId:memberForm.teamId||undefined,consultationReceivable:memberForm.consultationReceivable
      });
      memberDialogVisible.value = false;
      ElMessage.success('成员已创建，可使用账号密码登录');
      await loadAll();
    }
  } finally {
    savingMember.value = false;
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
function scopeLabel(value:string){return ({SELF:'仅本人',ASSIGNED_MEMBERS:'本人和指定成员',TEAM:'团队及下级',ALL:'全部数据'} as Record<string,string>)[value]||value}
function openTeam(row?:AdminTeamItem){Object.assign(teamForm,{id:'',name:'',parentId:'',leaderAdminId:'',status:'ACTIVE'},row?{id:row.id,name:row.name,parentId:row.parentId||'',leaderAdminId:row.leaderAdminId||'',status:row.status}:{});teamDialogVisible.value=true}
async function saveTeam(){if(!teamForm.name.trim())return ElMessage.warning('请输入团队名称');const data:Partial<AdminTeamItem>={name:teamForm.name.trim(),parentId:teamForm.parentId||null,leaderAdminId:teamForm.leaderAdminId||null,status:teamForm.status as 'ACTIVE'|'DISABLED'};if(teamForm.id)await updateAdminTeam(teamForm.id,data);else await createAdminTeam(data);teamDialogVisible.value=false;ElMessage.success('团队设置已保存');teams.value=await getAdminTeams()}
async function removeTeam(row:AdminTeamItem){await ElMessageBox.confirm('仅无成员且无下级的团队可以删除。','删除团队',{type:'warning'});await deleteAdminTeam(row.id);teams.value=await getAdminTeams()}

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
.permission-summary-cell { display:flex; min-width:0; align-items:center; flex-wrap:wrap; gap:3px; }
.permission-more { flex:none; margin-left:2px; }
.permission-popover-title { margin-bottom:10px; color:var(--admin-text); font-weight:600; }
.permission-popover-list { display:flex; max-height:280px; flex-wrap:wrap; gap:6px; overflow:auto; }
.empty-permissions { color:var(--admin-text-muted); font-size:12px; }
.all-permissions { color: var(--admin-primary); font-size: 13px; font-weight: 600; }
.member-actions { display: flex; width: 100%; align-items: center; justify-content: center; gap: 10px; white-space: nowrap; }
.member-actions :deep(.el-button) { min-width: 0; height: 28px; margin: 0; padding: 0 2px; }
.pagination { justify-content: flex-end; margin-top: 18px; }
.invite-list { border-top: 1px solid var(--admin-border); }
.invite-row { justify-content: space-between; gap: 16px; padding: 14px 2px; border-bottom: 1px solid var(--admin-border); }
.invite-row > div { display: flex; flex-direction: column; gap: 4px; }
.member-dialog :deep(.el-dialog__body) { max-height: min(72vh, 720px); overflow-y: auto; padding-right: 22px; }
.member-form { width: 100%; margin-top: 16px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.form-grid-full { grid-column: 1 / -1; }
.form-grid :deep(.el-select) { width: 100%; }
.permission-hint { margin: 0 0 10px; color: var(--admin-text-muted); font-size: 12px; }
.permission-groups { display: grid; width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 12px; }
.permission-group { padding: 10px 12px; border: 1px solid var(--admin-border); border-radius: 6px; background: #fafcff; }
.permission-group-title { margin-bottom: 7px; color: var(--admin-primary); font-size: 13px; font-weight: 700; }
.member-form :deep(.el-checkbox-group) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px 14px; }
.member-form :deep(.el-checkbox) { display: flex; height: auto; margin-right: 0; align-items: flex-start; white-space: normal; }
.member-form :deep(.el-checkbox__label) { display: flex; flex-direction: column; gap: 2px; line-height: 1.35; }
.member-form :deep(.el-checkbox__label small) { color: var(--admin-text-muted); font-size: 11px; }
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
  .form-grid, .permission-groups, .member-form :deep(.el-checkbox-group) { grid-template-columns: 1fr; }
  .member-dialog { width: calc(100vw - 24px) !important; }
}
</style>
