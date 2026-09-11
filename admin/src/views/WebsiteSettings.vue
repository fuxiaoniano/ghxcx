<template>
  <div class="page-heading">
    <div>
      <h1 class="page-title">官网设置</h1>
      <p>维护官网品牌、首屏文案、预约入口和页脚联系信息，保存后官网立即生效。</p>
    </div>
  </div>

  <div class="content-panel">
    <el-form class="settings-form" label-width="116px">
      <h2 class="section-title">品牌与首屏</h2>
      <div class="form-grid">
        <el-form-item label="品牌名称"><el-input v-model="settings.brandName" maxlength="40" /></el-form-item>
        <el-form-item label="公众号名称"><el-input v-model="settings.wechatName" maxlength="40" /></el-form-item>
      </div>
      <el-form-item label="首屏眉题"><el-input v-model="settings.eyebrow" maxlength="80" /></el-form-item>
      <el-form-item label="首屏主标题"><el-input v-model="settings.heroTitle" maxlength="80" /></el-form-item>
      <el-form-item label="首屏说明"><el-input v-model="settings.heroDescription" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>

      <h2 class="section-title section-title--spaced">预约与联系</h2>
      <div class="form-grid">
        <el-form-item label="预约按钮文案"><el-input v-model="settings.appointmentText" maxlength="40" /></el-form-item>
        <el-form-item label="预约链接"><el-input v-model="settings.appointmentUrl" placeholder="/landing/default 或完整网址" /></el-form-item>
      </div>
      <div class="form-grid">
        <el-form-item label="咨询电话"><el-input v-model="settings.phone" /></el-form-item>
        <el-form-item label="服务时间"><el-input v-model="settings.serviceHours" /></el-form-item>
      </div>
      <el-form-item label="机构地址"><el-input v-model="settings.address" /></el-form-item>

      <h2 class="section-title section-title--spaced">页脚信息</h2>
      <el-form-item label="页脚简介"><el-input v-model="settings.footerDescription" type="textarea" :rows="2" maxlength="500" show-word-limit /></el-form-item>
      <el-form-item label="备案号"><el-input v-model="settings.icpNumber" placeholder="取得备案后填写" /></el-form-item>
      <el-form-item class="save-row">
        <el-button type="primary" :loading="saving" @click="save">
          <el-icon><Check /></el-icon>保存官网设置
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { Check } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { getWebsiteSettings, updateWebsiteSettings, type WebsiteSettings } from '../api/admin';

const saving = ref(false);
const settings = reactive<WebsiteSettings>({
  brandName: '', eyebrow: '', heroTitle: '', heroDescription: '', appointmentUrl: '', appointmentText: '',
  phone: '', serviceHours: '', address: '', footerDescription: '', icpNumber: '', wechatName: ''
});

async function load() {
  Object.assign(settings, await getWebsiteSettings());
}

async function save() {
  saving.value = true;
  try {
    Object.assign(settings, await updateWebsiteSettings(settings));
    ElMessage.success('官网设置已保存');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.settings-form { max-width: 980px; }
.section-title { margin: 0 0 18px; color: var(--admin-text); font-size: 16px; font-weight: 650; }
.section-title--spaced { margin-top: 10px; padding-top: 22px; border-top: 1px solid var(--admin-border); }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 18px; }
.save-row { margin-top: 22px; margin-bottom: 0; padding-top: 20px; border-top: 1px solid var(--admin-border); }
@media (max-width: 760px) {
  .form-grid { grid-template-columns: 1fr; }
  .settings-form { --el-form-label-width: 94px; }
}
</style>
