<template>
  <div class="page-heading">
    <div><h1 class="page-title">官网设置</h1><p>维护资讯网站名称、首页说明、内容主题和搜索展示信息，保存后官网立即生效。</p></div>
  </div>
  <div class="content-panel">
    <el-form class="settings-form" label-width="116px">
      <h2 class="section-title">站点信息</h2>
      <div class="form-grid">
        <el-form-item label="网站名称"><el-input v-model="settings.brandName" maxlength="40" /></el-form-item>
        <el-form-item label="默认作者"><el-input v-model="settings.defaultAuthor" maxlength="60" /></el-form-item>
      </div>
      <el-form-item label="网站短句"><el-input v-model="settings.siteTagline" maxlength="60" placeholder="例如：把口腔知识讲清楚" /></el-form-item>
      <el-form-item label="首页主标题"><el-input v-model="settings.heroTitle" maxlength="80" /></el-form-item>
      <el-form-item label="首页说明"><el-input v-model="settings.heroDescription" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>
      <el-form-item label="热门主题">
        <el-input v-model="settings.topics" maxlength="200" placeholder="牙周健康,儿童口腔,牙齿矫正" />
        <div class="field-tip">使用中文或英文逗号分隔，首页和资讯库会自动生成主题入口。</div>
      </el-form-item>

      <h2 class="section-title section-title--spaced">页脚与搜索信息</h2>
      <el-form-item label="页脚简介"><el-input v-model="settings.footerDescription" type="textarea" :rows="2" maxlength="500" show-word-limit /></el-form-item>
      <el-form-item label="备案号"><el-input v-model="settings.icpNumber" placeholder="取得备案后填写" /></el-form-item>
      <el-alert title="文章的 SEO 标题、关键词和描述请在“口腔资讯”中逐篇设置；官网已自动生成规范链接、结构化数据和 Sitemap。" type="info" :closable="false" show-icon />
      <el-form-item class="save-row"><el-button type="primary" :loading="saving" @click="save"><el-icon><Check /></el-icon>保存官网设置</el-button></el-form-item>
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
  brandName: '', siteTagline: '', heroTitle: '', heroDescription: '', topics: '',
  footerDescription: '', icpNumber: '', defaultAuthor: ''
});
async function load() { Object.assign(settings, await getWebsiteSettings()); }
async function save() {
  saving.value = true;
  try { Object.assign(settings, await updateWebsiteSettings(settings)); ElMessage.success('官网设置已保存'); }
  finally { saving.value = false; }
}
onMounted(load);
</script>
<style scoped>
.settings-form { max-width: 980px; }.section-title { margin: 0 0 18px; color: var(--admin-text); font-size: 16px; font-weight: 650; }
.section-title--spaced { margin-top: 10px; padding-top: 22px; border-top: 1px solid var(--admin-border); }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 18px; }
.field-tip { margin-top: 5px; color: var(--admin-text-muted); font-size: 12px; }.save-row { margin-top: 22px; margin-bottom: 0; padding-top: 20px; border-top: 1px solid var(--admin-border); }
@media (max-width: 760px) { .form-grid { grid-template-columns: 1fr; }.settings-form { --el-form-label-width: 94px; } }
</style>
