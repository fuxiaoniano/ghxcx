<template>
  <div class="page-heading"><div><h1 class="page-title">推广数据同步设置</h1><p>配置腾讯营销与巨量引擎开放平台凭证。系统每天北京时间 10:00、14:00 自动同步前一天数据。</p></div></div>
  <el-alert title="请使用开放平台授权得到的 Access Token；令牌加密保存，保存后不会回显。账户页中的“户号”必须填写对应广告主 ID。" type="info" :closable="false" show-icon class="notice" />
  <div class="cards" v-loading="loading"><el-card v-for="item in configs" :key="item.provider"><template #header><div class="card-title"><span>{{ providerName(item.provider) }}</span><el-tag :type="item.enabled ? 'success' : 'info'">{{ item.enabled ? '已启用' : '未启用' }}</el-tag></div></template><el-form :model="forms[item.provider]" label-width="112px"><el-form-item label="启用自动同步"><el-switch v-model="forms[item.provider].enabled" /></el-form-item><el-form-item label="日报接口地址" required><el-input v-model="forms[item.provider].reportUrl" /></el-form-item><el-form-item label="Access Token"><el-input v-model="forms[item.provider].accessToken" type="password" show-password :placeholder="item.hasAccessToken ? '已保存；留空则不修改' : '请输入开放平台 Access Token'" /></el-form-item><el-form-item label="最近同步"><span>{{ item.lastSyncedAt ? new Date(item.lastSyncedAt).toLocaleString('zh-CN') : '尚未同步' }}</span></el-form-item><el-form-item v-if="item.lastSyncMessage" label="同步结果"><span>{{ item.lastSyncMessage }}</span></el-form-item><el-form-item><el-button type="primary" :loading="saving === item.provider" @click="save(item.provider)">保存设置</el-button></el-form-item></el-form></el-card></div>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getPromotionSyncConfigs, type PromotionDataSyncConfigItem, updatePromotionSyncConfig } from '../api/admin';
const configs = ref<PromotionDataSyncConfigItem[]>([]); const loading = ref(false); const saving = ref(''); const forms = reactive<Record<string, { enabled: boolean; reportUrl: string; accessToken: string }>>({});
const providerName = (provider: string) => provider === 'TENCENT_ADS' ? '腾讯营销' : '巨量引擎';
async function load() { loading.value = true; try { configs.value = await getPromotionSyncConfigs(); configs.value.forEach((item) => { forms[item.provider] = { enabled: item.enabled, reportUrl: item.reportUrl, accessToken: '' }; }); } finally { loading.value = false; } }
async function save(provider: 'TENCENT_ADS' | 'OCEANENGINE') { const form = forms[provider]; if (!form.reportUrl.trim()) return ElMessage.warning('请填写日报接口地址'); saving.value = provider; try { await updatePromotionSyncConfig({ provider, ...form }); ElMessage.success('同步设置已保存'); await load(); } finally { saving.value = ''; } }
onMounted(load);
</script>
<style scoped>.page-heading{margin-bottom:18px}.page-title{margin:0 0 6px}.page-heading p{margin:0;color:var(--admin-text-muted)}.notice{margin-bottom:18px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(440px,1fr));gap:18px}.card-title{display:flex;align-items:center;justify-content:space-between}</style>
