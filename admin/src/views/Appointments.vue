<template>
  <div class="page-heading">
    <div>
      <h1 class="page-title">挂号管理</h1>
    </div>
    <span class="record-count">共 {{ total }} 条记录</span>
  </div>
  <div class="content-panel">
    <div class="toolbar">
      <el-input v-model="query.keyword" placeholder="编号 / 姓名 / 手机号" clearable style="width: 240px" />
      <el-select v-model="query.status" placeholder="状态" clearable style="width: 150px">
        <el-option v-for="item in statuses" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-model="query.type" placeholder="业务类型" clearable style="width: 150px">
        <el-option v-for="item in appointmentTypes" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-model="query.doctorId" placeholder="预约医生" clearable filterable style="width: 160px">
        <el-option v-for="item in doctors" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-select v-model="query.followupForwardStatus" placeholder="回访转发" clearable style="width: 150px">
        <el-option v-for="item in followupForwardStatuses" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-date-picker v-model="dateRange" type="daterange" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" />
      <el-button type="primary" @click="load">查询</el-button>
      <el-button @click="exportAppointments(query)">导出脱敏 CSV</el-button>
      <el-button type="danger" plain @click="exportAppointments({ ...query, fullPhone: true })">导出完整手机号</el-button>
    </div>
    <el-table :data="rows" @row-click="openDetail">
      <el-table-column prop="appointmentNo" label="编号" width="170" />
      <el-table-column prop="typeText" label="业务类型" width="100" />
      <el-table-column prop="name" label="姓名" />
      <el-table-column prop="phoneMasked" label="手机号" />
      <el-table-column prop="doctor.name" label="预约医生" width="110" />
      <el-table-column label="项目/套餐" min-width="140"><template #default="{row}">{{ row.dentalProject?.name || row.package?.title || row.missingTeethType }}</template></el-table-column>
      <el-table-column label="预约时间" width="150"><template #default="{row}">{{ formatAppointmentTime(row) }}</template></el-table-column>
      <el-table-column prop="clinic.name" label="门店" />
      <el-table-column prop="statusText" label="状态">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)" effect="light" size="small">{{ row.statusText }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="followupForwardStatusText" label="回访系统" width="120">
        <template #default="{ row }">
          <el-tag :type="followupForwardTagType(row.followupForwardStatus)" effect="light" size="small">
            {{ row.followupForwardStatusText }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="提交时间" width="190" />
    </el-table>
    <el-pagination layout="prev, pager, next, total" :total="total" :page-size="query.pageSize" @current-change="changePage" />
  </div>

  <el-drawer v-model="drawer" title="挂号详情" size="620px" @closed="fullPhone = ''">
    <template v-if="detail">
      <div class="detail-summary">
        <div>
          <span>挂号编号</span>
          <strong>{{ detail.appointmentNo }}</strong>
        </div>
        <el-tag :type="statusTagType(detail.status)" effect="light">{{ detail.statusText }}</el-tag>
      </div>
      <el-descriptions :column="1" border class="detail-descriptions">
        <el-descriptions-item label="编号">{{ detail.appointmentNo }}</el-descriptions-item>
        <el-descriptions-item label="记录 ID">
          <div class="record-id-line">
            <code>{{ detail.id }}</code>
            <el-button link type="primary" :icon="CopyDocument" @click.stop="copyRecordId">复制 ID</el-button>
          </div>
          <p class="record-id-tip">用于生成挂号详情路径；该详情只能由提交挂号的用户本人查看。</p>
        </el-descriptions-item>
        <el-descriptions-item label="业务类型">{{ detail.typeText }}</el-descriptions-item>
        <el-descriptions-item label="姓名">{{ detail.name }}</el-descriptions-item>
        <el-descriptions-item label="手机号">
          <strong class="phone-text">{{ fullPhone || detail.phoneMasked }}</strong>
          <el-button size="small" text type="primary" @click="showFullPhone">查看完整手机号</el-button>
        </el-descriptions-item>
        <el-descriptions-item label="缺牙情况">{{ detail.missingTeethType }}</el-descriptions-item>
        <el-descriptions-item label="预约医生">{{ detail.doctor?.name || '-' }} {{ detail.doctor?.title || '' }}</el-descriptions-item>
        <el-descriptions-item label="科室/项目">{{ detail.dentalCategory?.name || '-' }} / {{ detail.dentalProject?.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="套餐">{{ detail.package?.title || '-' }}</el-descriptions-item>
        <el-descriptions-item label="预约日期">{{ formatAppointmentTime(detail) || '-' }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ detail.gender || '-' }}</el-descriptions-item>
        <el-descriptions-item label="症状描述">{{ detail.symptomDescription || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ detail.statusText }}</el-descriptions-item>
        <el-descriptions-item label="回访系统">
          <el-tag :type="followupForwardTagType(detail.followupForwardStatus)" effect="light" size="small">
            {{ detail.followupForwardStatusText }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="转发时间">{{ detail.followupForwardedAt || '-' }}</el-descriptions-item>
        <el-descriptions-item label="最近尝试">{{ detail.followupForwardLastTriedAt || '-' }}</el-descriptions-item>
        <el-descriptions-item label="转发错误">
          {{ detail.followupForwardErrorMessage || detail.followupForwardErrorCode || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="用户备注">{{ detail.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-divider content-position="left">跟进处理</el-divider>
      <el-form label-width="96px" class="follow-form">
        <el-form-item label="状态">
          <el-select v-model="detail.status" style="width: 200px">
            <el-option v-for="item in statuses" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <el-button type="primary" @click="saveStatus">保存状态</el-button>
        </el-form-item>
        <el-form-item label="跟进备注">
          <el-input v-model="detail.adminRemark" type="textarea" :rows="4" />
          <el-button type="primary" @click="saveRemark">保存备注</el-button>
        </el-form-item>
        <el-form-item label="分配人 ID">
          <el-input v-model="assignAdminId" placeholder="填写管理员 ID，留空为取消分配" />
          <el-button @click="saveAssign">保存分配</el-button>
        </el-form-item>
        <el-form-item>
          <el-button type="warning" @click="resend">重新发送通知</el-button>
          <el-button type="primary" plain @click="resendFollowup">重发回访系统</el-button>
        </el-form-item>
      </el-form>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { CopyDocument } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import {
  AppointmentItem,
  DoctorItem,
  assignAppointment,
  exportAppointments,
  getAppointmentDetail,
  getAppointments,
  getDoctorsAdmin,
  resendFollowupForward,
  resendNotification,
  revealPhone,
  updateAppointmentRemark,
  updateAppointmentStatus
} from '../api/admin';

const statuses = [
  { value: 'PENDING_CONTACT', label: '待联系' },
  { value: 'CONTACTED', label: '已联系' },
  { value: 'CONFIRMED', label: '已确认' },
  { value: 'VISITED', label: '已到诊' },
  { value: 'CANCELLED', label: '已取消' },
  { value: 'INVALID', label: '无效线索' }
];

const followupForwardStatuses = [
  { value: 'PENDING', label: '待转发' },
  { value: 'SUCCESS', label: '已转发' },
  { value: 'FAILED', label: '转发失败' },
  { value: 'SKIPPED', label: '未启用' }
];

const appointmentTypes = [
  { value: 'LEGACY_REGISTRATION', label: '旧挂号' },
  { value: 'DOCTOR_APPOINTMENT', label: '医生预约' },
  { value: 'PACKAGE_APPLICATION', label: '套餐申请' }
];

const rows = ref<AppointmentItem[]>([]);
const doctors = ref<DoctorItem[]>([]);
const total = ref(0);
const drawer = ref(false);
const detail = ref<AppointmentItem | null>(null);
const fullPhone = ref('');
const assignAdminId = ref('');
const dateRange = ref<string[]>([]);
const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  type: '',
  doctorId: '',
  followupForwardStatus: '',
  dateFrom: '',
  dateTo: ''
});

function statusTagType(status: string) {
  const types: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    PENDING_CONTACT: 'warning',
    CONTACTED: 'primary',
    CONFIRMED: 'success',
    VISITED: 'success',
    CANCELLED: 'info',
    INVALID: 'danger'
  };
  return types[status] || 'info';
}

function followupForwardTagType(status: string) {
  const types: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    PENDING: 'warning',
    SUCCESS: 'success',
    FAILED: 'danger',
    SKIPPED: 'info'
  };
  return types[status] || 'info';
}

watch(dateRange, (value) => {
  query.dateFrom = value?.[0] || '';
  query.dateTo = value?.[1] || '';
});

async function load() {
  const result = await getAppointments(query);
  rows.value = result.list;
  total.value = result.total;
}

function formatAppointmentTime(row: AppointmentItem) {
  const date = row.appointmentDate ? row.appointmentDate.slice(0, 10) : '';
  return [date, row.appointmentTime].filter(Boolean).join(' ');
}

function changePage(page: number) {
  query.page = page;
  load();
}

async function openDetail(row: AppointmentItem) {
  fullPhone.value = '';
  detail.value = await getAppointmentDetail(row.id);
  assignAdminId.value = detail.value.assignedTo?.id || '';
  drawer.value = true;
}

async function showFullPhone() {
  if (!detail.value) return;
  const result = await revealPhone(detail.value.id);
  fullPhone.value = result.phone;
}

async function copyRecordId() {
  if (!detail.value) return;
  const value = detail.value.id;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  ElMessage.success('记录 ID 已复制');
}

async function saveStatus() {
  if (!detail.value) return;
  detail.value = await updateAppointmentStatus(detail.value.id, detail.value.status);
  ElMessage.success('状态已更新');
  load();
}

async function saveRemark() {
  if (!detail.value) return;
  detail.value = await updateAppointmentRemark(detail.value.id, detail.value.adminRemark || '');
  ElMessage.success('备注已更新');
}

async function saveAssign() {
  if (!detail.value) return;
  detail.value = await assignAppointment(detail.value.id, assignAdminId.value || undefined);
  ElMessage.success('分配已更新');
}

async function resend() {
  if (!detail.value) return;
  await resendNotification(detail.value.id);
  ElMessage.success('已触发重发');
}

async function resendFollowup() {
  if (!detail.value) return;
  await resendFollowupForward(detail.value.id);
  detail.value = await getAppointmentDetail(detail.value.id);
  ElMessage.success('已触发回访系统转发');
  load();
}

onMounted(async () => {
  doctors.value = await getDoctorsAdmin();
  await load();
});
</script>

<style scoped>
.page-heading,
.detail-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-heading {
  margin-bottom: 18px;
}

.page-heading .page-title {
  margin-bottom: 2px;
}

.page-heading p {
  margin: 0;
  color: var(--admin-text-muted);
  font-size: 13px;
}

.record-count {
  color: var(--admin-text-secondary);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

:deep(.el-table__row) {
  cursor: pointer;
}

.detail-summary {
  margin: -4px 0 16px;
  padding: 15px 16px;
  background: #f2f8f6;
  border: 1px solid #dcebe7;
  border-radius: 6px;
}

.detail-summary > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.detail-summary span {
  color: var(--admin-text-muted);
  font-size: 12px;
}

.detail-summary strong {
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}

.detail-descriptions :deep(.el-descriptions__label) {
  width: 110px;
  color: var(--admin-text-secondary);
  font-weight: 500;
}

.phone-text {
  margin-right: 8px;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}

.record-id-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.record-id-line code {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #1d1d1f;
  font-family: Consolas, Monaco, monospace;
}

.record-id-tip {
  margin: 4px 0 0;
  color: var(--admin-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.follow-form :deep(.el-form-item__content) {
  gap: 10px;
}

.follow-form :deep(.el-textarea),
.follow-form :deep(.el-input) {
  flex: 1;
}

@media (max-width: 640px) {
  .record-count {
    display: none;
  }

  .follow-form :deep(.el-form-item) {
    display: block;
  }

  .follow-form :deep(.el-form-item__label) {
    display: block;
    width: auto !important;
    margin-bottom: 6px;
    text-align: left;
  }
}
</style>
