<template>
  <div class="page-heading">
    <div>
      <h1 class="page-title">回访接口</h1>
      <p>配置挂号成功后转发到院内回访系统的接收接口</p>
    </div>
  </div>

  <div class="content-panel">
    <div class="section-heading">
      <div>
        <h3>接收接口配置</h3>
        <p>保存后立即生效，新的挂号记录会按此配置转发</p>
      </div>
      <el-tag v-if="config" :type="config.enabled ? 'success' : 'info'" effect="light">
        {{ config.enabled ? '已启用' : '未启用' }}
      </el-tag>
    </div>

    <el-form v-if="config" label-width="150px" class="forward-form">
      <el-form-item label="启用转发">
        <el-switch v-model="config.enabled" />
      </el-form-item>
      <el-form-item label="接收接口地址">
        <el-input v-model="config.url" placeholder="https://hospital.example.com/api/appointments" />
      </el-form-item>
      <el-form-item label="鉴权 Header">
        <el-input v-model="config.authHeader" placeholder="Authorization" />
      </el-form-item>
      <el-form-item label="鉴权前缀">
        <el-input v-model="config.authScheme" placeholder="Bearer" />
      </el-form-item>
      <el-form-item label="接口密钥">
        <div class="token-row">
          <el-input v-model="tokenInput" type="password" show-password placeholder="留空则保留当前密钥" />
          <el-tag v-if="config.hasAuthToken" type="success" effect="light">{{ config.authTokenMasked }}</el-tag>
          <el-tag v-else type="info" effect="light">未配置</el-tag>
        </div>
      </el-form-item>
      <el-form-item label="请求超时">
        <el-input-number v-model="config.timeoutMs" :min="1000" :max="60000" :step="1000" controls-position="right" />
        <span class="form-help">毫秒</span>
      </el-form-item>
      <el-form-item label="转完整手机号">
        <el-switch v-model="config.includeFullPhone" active-text="转完整号" inactive-text="仅脱敏号" />
      </el-form-item>
      <el-form-item label="额外 Header">
        <el-input
          v-model="headersText"
          type="textarea"
          :rows="6"
          placeholder='{"X-Hospital-Code":"demo"}'
        />
      </el-form-item>
      <el-form-item class="save-row">
        <el-button type="primary" :loading="saving" @click="save">保存接收接口</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  FollowupForwardConfig,
  getFollowupForwardConfig,
  updateFollowupForwardConfig
} from '../api/admin';

const config = ref<FollowupForwardConfig | null>(null);
const tokenInput = ref('');
const headersText = ref('');
const saving = ref(false);

async function load() {
  config.value = await getFollowupForwardConfig();
  tokenInput.value = '';
  headersText.value = JSON.stringify(config.value.extraHeaders || {}, null, 2);
}

async function save() {
  if (!config.value) return;
  if (config.value.enabled && !config.value.url.trim()) {
    ElMessage.warning('启用转发前请填写接收接口地址');
    return;
  }

  let extraHeaders: Record<string, string> = {};
  try {
    const parsed = headersText.value.trim() ? JSON.parse(headersText.value) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('headers must be object');
    }
    extraHeaders = Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, String(value)])
    );
  } catch {
    ElMessage.warning('额外 Header 必须是 JSON 对象');
    return;
  }

  saving.value = true;
  try {
    const payload: Partial<FollowupForwardConfig> = {
      enabled: config.value.enabled,
      url: config.value.url.trim(),
      authHeader: config.value.authHeader.trim() || 'Authorization',
      authScheme: config.value.authScheme.trim(),
      timeoutMs: config.value.timeoutMs,
      includeFullPhone: config.value.includeFullPhone,
      extraHeaders
    };
    if (tokenInput.value.trim()) {
      payload.authToken = tokenInput.value.trim();
    }
    config.value = await updateFollowupForwardConfig(payload);
    tokenInput.value = '';
    headersText.value = JSON.stringify(config.value.extraHeaders || {}, null, 2);
    ElMessage.success('回访接口配置已保存');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.page-heading {
  margin-bottom: 18px;
}

.page-heading .page-title {
  margin-bottom: 2px;
}

.page-heading p,
.section-heading p {
  margin: 0;
  color: var(--admin-text-muted);
  font-size: 13px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--admin-border);
}

.section-heading h3 {
  margin: 0 0 3px;
  font-size: 16px;
}

.forward-form {
  max-width: 820px;
  padding: 4px 0;
}

.token-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.token-row .el-input {
  flex: 1;
}

.form-help {
  margin-left: 10px;
  color: var(--admin-text-muted);
  font-size: 13px;
}

.save-row {
  margin-top: 24px;
}

@media (max-width: 640px) {
  .section-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .forward-form :deep(.el-form-item) {
    display: block;
  }

  .forward-form :deep(.el-form-item__label) {
    display: block;
    width: auto !important;
    margin-bottom: 6px;
    text-align: left;
  }

  .token-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
