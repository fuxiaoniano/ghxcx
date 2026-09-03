<template>
  <div class="page-heading">
    <div>
      <h1 class="page-title">页面跳转链接</h1>
      <p>统一查看并复制小程序页面路径与公众号网页入口</p>
    </div>
    <el-button :icon="CopyDocument" @click="copyText(miniAppId, '小程序 AppID')">复制 AppID</el-button>
  </div>

  <section class="content-panel app-id-panel">
    <span class="field-label">小程序 AppID</span>
    <code>{{ miniAppId }}</code>
  </section>

  <section class="content-panel">
    <div class="section-heading">
      <div>
        <h2>可直接使用的页面</h2>
        <p>后台首页广告使用“后台路径”，公众号菜单使用“PagePath”</p>
      </div>
    </div>

    <el-table :data="directPages" stripe class="link-table">
      <el-table-column prop="name" label="页面" width="150" />
      <el-table-column prop="scene" label="适用位置" min-width="180" />
      <el-table-column label="后台路径" min-width="300">
        <template #default="{ row }">
          <code class="path-code">{{ row.path }}</code>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="230" fixed="right">
        <template #default="{ row }">
          <div class="copy-actions">
            <el-button text type="primary" :icon="CopyDocument" @click="copyText(row.path, '后台路径')">复制后台路径</el-button>
            <el-button text :icon="CopyDocument" @click="copyText(toPagePath(row.path), 'PagePath')">复制 PagePath</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </section>

  <section class="content-panel">
    <div class="section-heading external-heading">
      <div>
        <h2>公众号与文章网页入口</h2>
        <p>来源标识会记录到挂号来源，仅支持字母、数字、下划线和短横线</p>
      </div>
      <el-input v-model="entrySource" class="source-input" placeholder="来源标识，例如 article_01" maxlength="60" />
    </div>

    <div class="external-list">
      <div v-for="item in externalLinks" :key="item.name" class="external-row">
        <div class="external-name">
          <strong>{{ item.name }}</strong>
          <span>{{ item.scene }}</span>
        </div>
        <el-input :model-value="item.url" readonly />
        <el-button type="primary" plain :icon="CopyDocument" @click="copyText(item.url, `${item.name}链接`)">复制链接</el-button>
      </div>
    </div>
  </section>

  <section class="content-panel">
    <div class="section-heading">
      <div>
        <h2>需要业务 ID 的页面</h2>
        <p>模板中的中文占位内容必须替换成后台对应数据的真实 ID</p>
      </div>
    </div>
    <div class="template-grid">
      <div v-for="item in parameterPages" :key="item.name" class="template-item">
        <div>
          <strong>{{ item.name }}</strong>
          <span>{{ item.scene }}</span>
        </div>
        <code>{{ item.path }}</code>
        <el-button text type="primary" :icon="CopyDocument" @click="copyText(item.path, '路径模板')">复制模板</el-button>
      </div>
    </div>
  </section>

  <el-alert
    type="info"
    :closable="false"
    show-icon
    title="在线咨询使用微信小程序客服能力，不是独立页面，因此没有可复制的页面链接。"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { CopyDocument } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

interface PageLinkItem {
  name: string;
  path: string;
  scene: string;
}

const miniAppId = import.meta.env.VITE_MINI_APP_ID || 'wx99b598314f56c2f1';
const entrySource = ref('article_01');
const publicBase = window.location.origin.includes('fxnadmin.')
  ? window.location.origin.replace('fxnadmin.', 'zbsfxn.')
  : 'https://zbsfxn.cqzbskq.com';

const directPages: PageLinkItem[] = [
  { name: '首页', path: '/pages/home/home', scene: '首页入口' },
  { name: '医生介绍', path: '/pages/doctors/doctors', scene: '医生列表' },
  { name: '预约挂号', path: '/pages/booking/booking', scene: '科室与项目预约' },
  { name: '推荐套餐', path: '/pages/packages/packages', scene: '套餐列表' },
  { name: '个人中心', path: '/pages/profile/profile', scene: '用户中心' },
  { name: '种牙优惠预约', path: '/pages/landing/landing', scene: '活动落地表单' },
  { name: '我的挂号', path: '/pages/appointments/appointments', scene: '原挂号记录' },
  { name: '预约记录', path: '/pages/records/records?type=DOCTOR_APPOINTMENT', scene: '医生预约记录' },
  { name: '购买记录', path: '/pages/records/records?type=PACKAGE_APPLICATION', scene: '套餐申请记录' },
  { name: '问诊记录', path: '/pages/records/records?mode=consultation', scene: '问诊记录入口' },
  { name: '隐私协议', path: '/pages/agreement/agreement?type=privacy', scene: '隐私协议' },
  { name: '用户协议', path: '/pages/agreement/agreement?type=user', scene: '用户协议' }
];

const parameterPages: PageLinkItem[] = [
  { name: '医生详情', path: '/pages/doctor-detail/doctor-detail?id=医生ID', scene: '需要医生 ID' },
  { name: '选择医生', path: '/pages/booking-doctors/booking-doctors?categoryId=科室ID&projectId=项目ID', scene: '需要科室与项目 ID' },
  { name: '医生预约表单', path: '/pages/booking-form/booking-form?doctorId=医生ID', scene: '需要医生 ID' },
  { name: '套餐详情', path: '/pages/package-detail/package-detail?id=套餐ID', scene: '需要套餐 ID' },
  { name: '套餐申请', path: '/pages/package-apply/package-apply?id=套餐ID', scene: '需要套餐 ID' },
  { name: '挂号成功详情', path: '/pages/success/success?id=挂号ID', scene: '需要挂号 ID，且只能查看本人数据' }
];

const safeSource = computed(() =>
  entrySource.value.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'admin_link'
);

const externalLinks = computed(() => [
  {
    name: '种牙优惠预约',
    scene: '公众号菜单、阅读原文、二维码或推广页',
    url: `${publicBase}/wechat/oa/oauth?state=landing&source=${encodeURIComponent(safeSource.value)}`
  },
  {
    name: '我的挂号',
    scene: '公众号菜单或文章中的个人记录入口',
    url: `${publicBase}/wechat/oa/oauth?state=my&source=${encodeURIComponent(safeSource.value)}`
  }
]);

function toPagePath(path: string) {
  return path.replace(/^\//, '');
}

async function copyText(value: string, label: string) {
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
  ElMessage.success(`${label}已复制`);
}
</script>

<style scoped>
.page-heading,
.section-heading,
.app-id-panel,
.external-heading,
.external-row,
.template-item {
  display: flex;
  align-items: center;
}

.page-heading,
.section-heading,
.external-heading {
  justify-content: space-between;
  gap: 18px;
}

.page-heading {
  margin-bottom: 18px;
}

.page-heading .page-title {
  margin-bottom: 2px;
}

.page-heading p,
.section-heading p,
.external-name span,
.template-item span {
  margin: 0;
  color: var(--admin-text-muted);
  font-size: 13px;
}

.content-panel + .content-panel {
  margin-top: 16px;
}

.app-id-panel {
  justify-content: flex-start;
  gap: 16px;
  padding-top: 16px;
  padding-bottom: 16px;
}

.field-label {
  color: var(--admin-text-secondary);
  font-size: 13px;
}

code {
  color: #244357;
  font-family: Consolas, Monaco, monospace;
}

.section-heading {
  margin-bottom: 18px;
}

.section-heading h2 {
  margin: 0 0 4px;
  color: var(--admin-text);
  font-size: 16px;
}

.path-code {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  padding: 5px 8px;
  background: #f4f7f9;
  border-radius: 4px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-actions {
  display: flex;
  align-items: center;
  white-space: nowrap;
}

.copy-actions :deep(.el-button + .el-button) {
  margin-left: 4px;
}

.source-input {
  width: min(340px, 100%);
}

.external-list {
  display: grid;
  gap: 12px;
}

.external-row {
  grid-template-columns: 220px minmax(0, 1fr) auto;
  gap: 14px;
}

.external-name {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.template-item {
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--admin-border);
  border-radius: 6px;
}

.template-item > div {
  display: flex;
  flex: 0 0 120px;
  flex-direction: column;
  gap: 3px;
}

.template-item code {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-item .el-button {
  flex: 0 0 auto;
}

@media (max-width: 960px) {
  .external-row {
    align-items: stretch;
    grid-template-columns: 1fr;
  }

  .external-row .el-button {
    justify-self: start;
  }

  .template-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .page-heading,
  .external-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
