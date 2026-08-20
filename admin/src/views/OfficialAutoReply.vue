<template>
  <div class="page-heading"><h1 class="page-title">公众号自动回复</h1><p>配置关注、消息兜底和关键词自动回复</p></div>
  <div class="content-panel">
    <el-alert
      class="page-tip"
      type="info"
      :closable="false"
      show-icon
      title="自动回复在公众号服务器回调里立即生效。若公众号后台使用安全模式，建议先切换为明文或兼容模式后测试文本回复。"
    />

    <el-form v-if="config" label-width="140px">
      <el-divider content-position="left">总开关</el-divider>
      <el-form-item label="启用自动回复">
        <el-switch v-model="config.enabled" active-text="启用" inactive-text="停用" />
      </el-form-item>

      <el-divider content-position="left">被关注回复</el-divider>
      <el-form-item label="关注后回复">
        <el-switch v-model="config.subscribeReplyEnabled" active-text="启用" inactive-text="停用" />
      </el-form-item>
      <el-form-item label="回复内容">
        <el-input v-model="config.subscribeReply" type="textarea" :rows="4" maxlength="600" show-word-limit />
      </el-form-item>

      <el-divider content-position="left">收到消息回复</el-divider>
      <el-form-item label="消息兜底回复">
        <el-switch v-model="config.messageReplyEnabled" active-text="启用" inactive-text="停用" />
      </el-form-item>
      <el-form-item label="回复内容">
        <el-input v-model="config.messageReply" type="textarea" :rows="4" maxlength="600" show-word-limit />
      </el-form-item>

      <el-divider content-position="left">关键词回复</el-divider>
      <el-form-item label="关键词回复">
        <el-switch v-model="config.keywordReplyEnabled" active-text="启用" inactive-text="停用" />
      </el-form-item>
      <div class="toolbar">
        <el-button type="primary" @click="addRule">新增关键词</el-button>
      </div>
      <el-table :data="config.keywordRules" border>
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" />
          </template>
        </el-table-column>
        <el-table-column label="关键词" width="180">
          <template #default="{ row }">
            <el-input v-model="row.keyword" maxlength="50" placeholder="例如：挂号" />
          </template>
        </el-table-column>
        <el-table-column label="匹配方式" width="150">
          <template #default="{ row }">
            <el-select v-model="row.matchMode">
              <el-option label="包含关键词" value="CONTAINS" />
              <el-option label="完全相等" value="EXACT" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="回复内容">
          <template #default="{ row }">
            <el-input v-model="row.replyContent" type="textarea" :rows="2" maxlength="600" show-word-limit />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template #default="{ $index }">
            <el-button text type="danger" @click="removeRule($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-form-item class="save-row">
        <el-button type="primary" :loading="saving" @click="save">保存自动回复配置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  OfficialAutoReplyConfig,
  OfficialAutoReplyKeywordRule,
  getOfficialAutoReply,
  updateOfficialAutoReply
} from '../api/admin';

const config = ref<OfficialAutoReplyConfig | null>(null);
const saving = ref(false);

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function load() {
  config.value = await getOfficialAutoReply();
}

function addRule() {
  if (!config.value) return;
  const rule: OfficialAutoReplyKeywordRule = {
    id: newId(),
    keyword: '',
    matchMode: 'CONTAINS',
    replyContent: '',
    enabled: true,
    createdAt: new Date().toISOString()
  };
  config.value.keywordRules.push(rule);
}

function removeRule(index: number) {
  config.value?.keywordRules.splice(index, 1);
}

async function save() {
  if (!config.value || saving.value) return;
  saving.value = true;
  try {
    config.value = await updateOfficialAutoReply(config.value);
    ElMessage.success('公众号自动回复配置已保存');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.page-heading { margin-bottom: 18px; }
.page-heading .page-title { margin-bottom: 2px; }
.page-heading p { margin: 0; color: var(--admin-text-muted); font-size: 13px; }

.page-tip {
  margin-bottom: 16px;
}

.toolbar {
  margin-bottom: 12px;
}

.save-row {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--admin-border);
}

:deep(.el-divider) { margin: 30px 0 22px; }
:deep(.el-divider:first-of-type) { margin-top: 22px; }

@media (max-width: 640px) {
  :deep(.el-form-item) { display: block; }
  :deep(.el-form-item__label) { display: block; width: auto !important; margin-bottom: 6px; text-align: left; }
}
</style>
