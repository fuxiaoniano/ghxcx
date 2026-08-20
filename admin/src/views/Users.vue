<template>
  <div class="page-heading">
    <div>
      <h1 class="page-title">用户管理</h1>
      <p>查看用户资料、微信绑定状态与历史挂号</p>
    </div>
    <span>共 {{ total }} 位用户</span>
  </div>
  <div class="content-panel">
    <div class="toolbar">
      <el-input v-model="query.keyword" placeholder="姓名 / 脱敏手机号 / 完整手机号搜索" clearable style="width: 280px" />
      <el-date-picker v-model="dateRange" type="daterange" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" />
      <el-button type="primary" @click="load">查询</el-button>
    </div>
    <el-table :data="rows" @row-click="openDetail">
      <el-table-column prop="name" label="姓名" />
      <el-table-column prop="phoneMasked" label="手机号" />
      <el-table-column prop="ageRange" label="年龄段" />
      <el-table-column label="微信绑定">
        <template #default="{ row }">
          <div class="tag-list">
            <el-tag v-if="row.wechat.hasMiniOpenId" size="small">小程序</el-tag>
            <el-tag v-if="row.wechat.hasOfficialAccountOpenId" size="small" type="success">公众号</el-tag>
            <el-tag v-if="row.wechat.hasUnionId" size="small" type="warning">UnionID</el-tag>
            <span v-if="!row.wechat.hasMiniOpenId && !row.wechat.hasOfficialAccountOpenId" class="empty-value">未绑定</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="注册时间" width="190" />
    </el-table>
    <el-pagination layout="prev, pager, next, total" :total="total" :page-size="query.pageSize" @current-change="changePage" />
  </div>
  <el-drawer v-model="drawer" title="用户详情" size="620px">
    <div class="phone-panel">
      <div>
        <div class="phone-label">授权手机号</div>
        <div class="phone-value">{{ fullPhone || detail.phoneMasked || '未授权手机号' }}</div>
      </div>
      <el-button
        v-if="detail.phoneMasked"
        type="primary"
        plain
        :loading="revealing"
        @click="showFullPhone"
      >
        查看完整手机号
      </el-button>
    </div>
    <section class="detail-section">
      <h3>基本资料</h3>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="姓名">{{ detail.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="年龄段">{{ detail.ageRange || '-' }}</el-descriptions-item>
        <el-descriptions-item label="用户状态">
          <el-tag size="small" :type="detail.status === 'ACTIVE' ? 'success' : 'info'">{{ detail.status || '-' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ detail.createdAt || '-' }}</el-descriptions-item>
        <el-descriptions-item label="最近登录">{{ detail.lastLoginAt || '-' }}</el-descriptions-item>
      </el-descriptions>
    </section>

    <section class="detail-section">
      <h3>微信绑定</h3>
      <div v-if="detail.wechatIdentities?.length" class="identity-list">
        <div v-for="identity in detail.wechatIdentities" :key="identity.id" class="identity-item">
          <div class="identity-tags">
            <el-tag v-if="identity.hasMiniOpenId" size="small">小程序</el-tag>
            <el-tag v-if="identity.hasOfficialAccountOpenId" size="small" type="success">公众号</el-tag>
            <el-tag v-if="identity.hasUnionId" size="small" type="warning">UnionID</el-tag>
          </div>
          <span>{{ identity.subscribedOfficialAccount ? '已关注公众号' : '未关注公众号' }}</span>
        </div>
      </div>
      <el-empty v-else description="暂无微信绑定信息" :image-size="64" />
    </section>

    <section class="detail-section">
      <h3>挂号历史</h3>
      <el-table :data="detail.appointments || []" size="small" empty-text="暂无挂号记录">
        <el-table-column prop="appointmentNo" label="编号" min-width="150" />
        <el-table-column prop="missingTeethType" label="缺牙情况" min-width="100" />
        <el-table-column prop="statusText" label="状态" width="90" />
        <el-table-column prop="createdAt" label="提交时间" min-width="160" />
      </el-table>
    </section>
  </el-drawer>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { getUserDetail, getUsers, revealUserPhone, UserItem } from '../api/admin';

const rows = ref<UserItem[]>([]);
const total = ref(0);
const drawer = ref(false);
interface UserDetail {
  id?: string;
  name?: string;
  phoneMasked?: string;
  ageRange?: string;
  status?: string;
  createdAt?: string;
  lastLoginAt?: string;
  wechatIdentities?: Array<{
    id: string;
    hasMiniOpenId: boolean;
    hasOfficialAccountOpenId: boolean;
    hasUnionId: boolean;
    subscribedOfficialAccount: boolean;
  }>;
  appointments?: Array<Record<string, unknown>>;
}

const detail = ref<UserDetail>({});
const currentUserId = ref('');
const fullPhone = ref('');
const revealing = ref(false);
const dateRange = ref<string[]>([]);
const query = reactive({ page: 1, pageSize: 20, keyword: '', dateFrom: '', dateTo: '' });

watch(dateRange, (value) => {
  query.dateFrom = value?.[0] || '';
  query.dateTo = value?.[1] || '';
});

async function load() {
  const result = await getUsers(query);
  rows.value = result.list;
  total.value = result.total;
}

function changePage(page: number) {
  query.page = page;
  load();
}

async function openDetail(row: UserItem) {
  currentUserId.value = row.id;
  fullPhone.value = '';
  detail.value = await getUserDetail(row.id);
  drawer.value = true;
}

async function showFullPhone() {
  if (!currentUserId.value || revealing.value) return;
  revealing.value = true;
  try {
    const result = await revealUserPhone(currentUserId.value);
    fullPhone.value = result.phone;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '当前账号无查看完整手机号权限');
  } finally {
    revealing.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.page-heading .page-title {
  margin-bottom: 2px;
}

.page-heading p,
.page-heading > span {
  margin: 0;
  color: var(--admin-text-muted);
  font-size: 13px;
}

:deep(.el-table__row) {
  cursor: pointer;
}

.tag-list,
.identity-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.empty-value {
  color: var(--admin-text-muted);
}

.phone-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
  padding: 16px;
  border: 1px solid #d5e8e4;
  border-radius: 6px;
  background: #f1f8f6;
}

.phone-label {
  color: var(--admin-text-secondary);
  font-size: 13px;
}

.phone-value {
  margin-top: 4px;
  color: var(--admin-text);
  font-size: 20px;
  font-weight: 700;
}

.detail-section + .detail-section {
  margin-top: 24px;
}

.detail-section h3 {
  margin: 0 0 12px;
  font-size: 15px;
}

.detail-section :deep(.el-descriptions__label) {
  width: 104px;
  color: var(--admin-text-secondary);
}

.identity-list {
  display: grid;
  gap: 8px;
}

.identity-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 12px;
  background: #f7faf9;
  border: 1px solid var(--admin-border);
  border-radius: 6px;
}

.identity-item > span {
  color: var(--admin-text-secondary);
  font-size: 12px;
}

@media (max-width: 640px) {
  .page-heading > span {
    display: none;
  }

  .phone-panel,
  .identity-item {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
