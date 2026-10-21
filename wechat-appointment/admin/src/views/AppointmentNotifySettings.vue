<template>
  <section>
    <div class="page-heading"><div><h1 class="page-title">预约通知</h1><p>配置新预约提醒。成员个人接收开关仍在“成员管理”中设置。</p></div></div>
    <div class="content-panel notify-panel" v-loading="loading">
      <div class="section-heading"><div><h2>通知设置</h2><p>总开关关闭后，所有成员都不会收到新预约通知。</p></div><el-switch v-model="form.enabled" inline-prompt active-text="已启用" inactive-text="已关闭" /></div>
      <el-form label-position="top"><el-form-item label="公众号消息模板 ID"><el-input v-model="form.templateId" placeholder="请输入用于工作人员预约提醒的模板 ID" /></el-form-item><el-button type="primary" :loading="saving" @click="save">保存通知设置</el-button></el-form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getAppointmentNotifyConfig, updateAppointmentNotifyConfig } from '../api/admin';
const form = reactive({ enabled: true, templateId: '' });
const loading = ref(false);
const saving = ref(false);
onMounted(async () => { loading.value = true; try { const result = await getAppointmentNotifyConfig(); form.enabled = result.enabled; form.templateId = result.templateId || ''; } finally { loading.value = false; } });
async function save() { saving.value = true; try { await updateAppointmentNotifyConfig({ enabled: form.enabled, templateId: form.templateId.trim() }); ElMessage.success('预约通知设置已保存'); } finally { saving.value = false; } }
</script>
