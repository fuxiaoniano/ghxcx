<template>
  <div class="page-heading">
    <div>
      <h1 class="page-title">腾讯广告线索</h1>
      <p>接收腾讯广告线索平台推送，并在管理后台统一跟进。</p>
    </div>
    <span class="record-count">共 {{ total }} 条线索</span>
  </div>

  <div class="receiver-panel content-panel">
    <div class="receiver-heading">
      <div>
        <h3>推送接收地址</h3>
        <p>在腾讯广告线索平台新建“推送（POST）”配置时填写此地址。</p>
      </div>
      <el-tag :type="receiverConfig?.enabled ? 'success' : 'warning'" effect="light">
        {{ receiverConfig?.enabled ? '接收凭证已配置' : '接收凭证待配置' }}
      </el-tag>
    </div>
    <div class="endpoint-row">
      <code>{{ receiverConfig?.webhookUrl || '/api/tencent-ads/leads/push' }}</code>
      <el-button :icon="CopyDocument" @click="copyEndpoint">复制地址</el-button>
    </div>
    <el-alert
      v-if="receiverConfig && !receiverConfig.enabled"
      type="warning"
      :closable="false"
      show-icon
      title="请在服务端环境变量中配置 TENCENT_ADS_LEADS_TOKEN 和 TENCENT_ADS_LEADS_SECRET，然后重启服务。"
    />
    <p class="receiver-tip">腾讯侧密钥、Token 与服务端配置必须一致；支持 SHA1 / SHA256，签名时间戳默认允许 5 分钟偏差。</p>
  </div>

  <div class="content-panel">
    <div class="toolbar" aria-label="线索筛选">
      <el-input
        v-model.trim="query.keyword"
        clearable
        placeholder="线索 ID / 姓名 / 计划 / 广告"
        style="width: 260px"
        @keyup.enter="search"
      />
      <el-select v-model="query.status" clearable placeholder="跟进状态" style="width: 150px">
        <el-option v-for="item in statuses" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        start-placeholder="接收开始日期"
        end-placeholder="接收结束日期"
        value-format="YYYY-MM-DD"
      />
      <el-button type="primary" :loading="loading" @click="search">查询</el-button>
      <el-button :disabled="loading" @click="resetFilters">重置</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" empty-text="暂未收到腾讯广告线索" @row-click="openDetail">
      <el-table-column prop="leadsId" label="线索 ID" min-width="130" />
      <el-table-column prop="name" label="姓名" min-width="90">
        <template #default="{ row }">{{ row.name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="phoneMasked" label="手机号" min-width="125">
        <template #default="{ row }">{{ row.phoneMasked || '-' }}</template>
      </el-table-column>
      <el-table-column prop="area" label="所在地" min-width="130" show-overflow-tooltip />
      <el-table-column prop="campaignName" label="推广计划" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ row.campaignName || '-' }}</template>
      </el-table-column>
      <el-table-column prop="adName" label="广告" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ row.adName || '-' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)" effect="light" size="small">{{ row.statusText }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="线索提交时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.leadActionAt) }}</template>
      </el-table-column>
      <el-table-column label="接收时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.receivedAt) }}</template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-model:current-page="query.page"
      layout="prev, pager, next, total"
      :total="total"
      :page-size="query.pageSize"
      @current-change="load"
    />
  </div>

  <el-drawer v-model="drawerOpen" title="腾讯广告线索详情" size="680px" @closed="fullPhone = ''">
    <div v-if="detail" class="lead-detail">
      <div class="detail-summary">
        <div>
          <span>腾讯线索 ID</span>
          <strong>{{ detail.leadsId }}</strong>
        </div>
        <el-tag :type="statusTagType(detail.status)" effect="light">{{ detail.statusText }}</el-tag>
      </div>

      <el-descriptions :column="1" border class="detail-descriptions">
        <el-descriptions-item label="姓名">{{ detail.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="手机号">
          <strong class="phone-text">{{ fullPhone || detail.phoneMasked || '-' }}</strong>
          <el-button v-if="canRevealPhone && detail.phoneMasked" link type="primary" @click.stop="showFullPhone">
            查看完整号码
          </el-button>
        </el-descriptions-item>
        <el-descriptions-item label="所在地">{{ detail.area || detail.telLocation || '-' }}</el-descriptions-item>
        <el-descriptions-item label="微信 / QQ">{{ detail.wechat || '-' }} / {{ detail.qq || '-' }}</el-descriptions-item>
        <el-descriptions-item label="推广计划">{{ detail.campaignName || '-' }}（{{ detail.campaignId || '-' }}）</el-descriptions-item>
        <el-descriptions-item label="广告">{{ detail.adName || '-' }}（{{ detail.adId || '-' }}）</el-descriptions-item>
        <el-descriptions-item label="落地页">{{ detail.pageName || '-' }}（{{ detail.pageId || '-' }}）</el-descriptions-item>
        <el-descriptions-item label="组件">{{ detail.componentName || '-' }}（{{ detail.componentId || '-' }}）</el-descriptions-item>
        <el-descriptions-item label="线索类型">{{ detail.leadsType || '-' }} / {{ detail.leadsSubType || '-' }}</el-descriptions-item>
        <el-descriptions-item label="线索来源">{{ detail.leadsSource || '-' }} / {{ detail.leadsSubSource || '-' }}</el-descriptions-item>
        <el-descriptions-item label="腾讯标签">{{ detail.leadsTags || '-' }}</el-descriptions-item>
        <el-descriptions-item label="腾讯状态">{{ detail.leadsFollowTag || '-' }}</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ formatDateTime(detail.leadActionAt) }}</el-descriptions-item>
        <el-descriptions-item label="接收时间">{{ formatDateTime(detail.receivedAt) }}</el-descriptions-item>
      </el-descriptions>

      <el-divider content-position="left">广告表单内容</el-divider>
      <el-descriptions v-if="customFields.length" :column="1" border class="detail-descriptions">
        <el-descriptions-item v-for="(field, index) in customFields" :key="`${field.label}-${index}`" :label="field.label">
          {{ field.value }}
        </el-descriptions-item>
      </el-descriptions>
      <el-empty v-else description="本条线索未携带额外表单字段" :image-size="72" />

      <el-divider content-position="left">跟进处理</el-divider>
      <el-form label-width="100px" class="follow-form">
        <el-form-item label="跟进状态">
          <el-select v-model="detail.status" :disabled="!canManage" style="width: 220px">
            <el-option v-for="item in statuses" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="detail.status === 'INVALID'" label="无效原因">
          <el-select v-model="detail.ineffectiveReason" :disabled="!canManage" clearable placeholder="请选择无效原因">
            <el-option v-for="item in ineffectiveReasons" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="跟进备注">
          <el-input v-model="detail.adminRemark" :disabled="!canManage" type="textarea" :rows="4" maxlength="2000" show-word-limit />
        </el-form-item>
        <el-form-item v-if="canManage">
          <el-button type="primary" :loading="saving" @click="saveFollowup">保存跟进结果</el-button>
        </el-form-item>
      </el-form>

      <el-collapse class="raw-collapse">
        <el-collapse-item title="查看已脱敏的原始推送数据" name="raw">
          <pre>{{ JSON.stringify(detail.rawPayload || {}, null, 2) }}</pre>
        </el-collapse-item>
      </el-collapse>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { CopyDocument } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import {
  TencentAdLeadItem,
  TencentAdsReceiverConfig,
  getTencentAdLead,
  getTencentAdLeads,
  getTencentAdsReceiverConfig,
  revealTencentAdLeadPhone,
  updateTencentAdLead
} from '../api/admin';
import { useAuthStore } from '../stores/auth';

const statuses: Array<{ value: TencentAdLeadItem['status']; label: string }> = [
  { value: 'NEW', label: '待联系' },
  { value: 'CONTACTED', label: '已联系' },
  { value: 'POTENTIAL', label: '潜在客户' },
  { value: 'HIGH_INTENT', label: '高意向客户' },
  { value: 'CONVERTED', label: '已成单' },
  { value: 'INVALID', label: '无效线索' }
];

const ineffectiveReasons = [
  { value: 'LEADS_INEFFECT_REASON_IDENTITY_MISMATCHED', label: '非本人' },
  { value: 'LEADS_INEFFECT_REASON_REGION_MISMATCHED', label: '定向条件外' },
  { value: 'LEADS_INEFFECT_REASON_DATA_DUPLICATION', label: '重复数据' },
  { value: 'LEADS_INEFFECT_REASON_TEL_NOT_CONNECTED', label: '未接通' },
  { value: 'LEADS_INEFFECT_REASON_NO_INTENTION', label: '无意向' },
  { value: 'LEADS_INEFFECT_REASON_OTHER', label: '其他' }
];

const auth = useAuthStore();
const canManage = computed(() => auth.hasPermission('MANAGE_APPOINTMENTS'));
const canRevealPhone = computed(() => auth.hasPermission('VIEW_FULL_PHONE'));
const customFields = computed(() => {
  const raw = detail.value?.rawPayload || {};
  const sections = ['bundle', 'layer_form_content', 'custom_qa'];
  const standardKeys = new Set([
    'leads_id', 'click_id', 'account_id', 'account_type', 'advertiser_id', 'wechat_appid',
    'agency_id', 'agency_name', 'wechat_spid', 'claim_advertiser_id', 'campaign_id',
    'campaign_name', 'adgroup_id', 'adgroup_name', 'creative_id', 'creative_name', 'ad_id',
    'ad_name', 'adcreative_id', 'adcreative_name', 'dynamic_creative_id', 'dynamic_creative_name',
    'page_id', 'page_name', 'page_url', 'component_id', 'component_name', 'leads_type',
    'leads_sub_type', 'chat_id', 'leads_tags', 'leads_source', 'leads_sub_source',
    'leads_potential_score', 'leads_touch_tag', 'leads_follow_tag', 'leads_name', 'leads_tel',
    'tel_location', 'leads_area', 'leads_email', 'leads_qq', 'leads_wechat', 'leads_gender',
    'nationality', 'working_years', 'age', 'profession', 'id_number', 'address', 'leads_create_time',
    'leads_action_time', 'shop_name', 'shop_address', 'call_middle_num', 'call_consumer_hotline',
    'call_touch_tag', 'call_duration', 'call_record_url', 'leads_pool_id', 'nick_name',
    'is_broad_cast_leads', 'owner_name', 'all_follow_records', 'leads_response_duration',
    'chat_record_url', ...sections
  ]);
  const fields: Array<{ label: string; value: string }> = [];
  sections.forEach((section) => {
    const source = raw[section];
    if (!source) return;
    let parsed: unknown = source;
    if (typeof source === 'string') {
      try {
        parsed = JSON.parse(source);
      } catch {
        parsed = source;
      }
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      Object.entries(parsed as Record<string, unknown>).forEach(([label, value]) => {
        fields.push({ label, value: typeof value === 'string' ? value : JSON.stringify(value) });
      });
    } else {
      fields.push({ label: section, value: String(parsed) });
    }
  });
  Object.entries(raw).forEach(([label, value]) => {
    if (standardKeys.has(label) || value === undefined || value === null || value === '') return;
    fields.push({ label, value: typeof value === 'string' ? value : JSON.stringify(value) });
  });
  return fields;
});
const receiverConfig = ref<TencentAdsReceiverConfig | null>(null);
const rows = ref<TencentAdLeadItem[]>([]);
const detail = ref<TencentAdLeadItem | null>(null);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const drawerOpen = ref(false);
const fullPhone = ref('');
const dateRange = ref<string[]>([]);
const query = reactive({ page: 1, pageSize: 20, keyword: '', status: '', dateFrom: '', dateTo: '' });

watch(dateRange, (value) => {
  query.dateFrom = value?.[0] || '';
  query.dateTo = value?.[1] || '';
});

function statusTagType(status: TencentAdLeadItem['status']) {
  const types: Record<TencentAdLeadItem['status'], 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    NEW: 'warning',
    CONTACTED: 'primary',
    POTENTIAL: 'success',
    HIGH_INTENT: 'success',
    CONVERTED: 'success',
    INVALID: 'danger'
  };
  return types[status];
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

async function load() {
  loading.value = true;
  try {
    const result = await getTencentAdLeads(query);
    rows.value = result.list;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function search() {
  query.page = 1;
  load();
}

function resetFilters() {
  query.keyword = '';
  query.status = '';
  query.page = 1;
  dateRange.value = [];
  load();
}

async function openDetail(row: TencentAdLeadItem) {
  fullPhone.value = '';
  detail.value = await getTencentAdLead(row.id);
  drawerOpen.value = true;
}

async function showFullPhone() {
  if (!detail.value) return;
  const result = await revealTencentAdLeadPhone(detail.value.id);
  fullPhone.value = result.phone;
}

async function saveFollowup() {
  if (!detail.value) return;
  if (detail.value.status === 'INVALID' && !detail.value.ineffectiveReason) {
    ElMessage.warning('请为无效线索选择无效原因');
    return;
  }
  saving.value = true;
  try {
    detail.value = await updateTencentAdLead(detail.value.id, {
      status: detail.value.status,
      ineffectiveReason: detail.value.ineffectiveReason,
      adminRemark: detail.value.adminRemark || ''
    });
    ElMessage.success('跟进结果已保存');
    await load();
  } finally {
    saving.value = false;
  }
}

async function copyEndpoint() {
  const endpoint = receiverConfig.value?.webhookUrl || '/api/tencent-ads/leads/push';
  try {
    await navigator.clipboard.writeText(endpoint);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = endpoint;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  ElMessage.success('推送地址已复制');
}

onMounted(async () => {
  [receiverConfig.value] = await Promise.all([getTencentAdsReceiverConfig(), load()]);
});
</script>

<style scoped>
.page-heading,
.receiver-heading,
.detail-summary,
.endpoint-row {
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

.page-heading p,
.receiver-heading p,
.receiver-tip {
  margin: 0;
  color: var(--admin-text-muted);
  font-size: 13px;
}

.record-count {
  color: var(--admin-text-secondary);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.receiver-panel {
  margin-bottom: 18px;
}

.receiver-heading {
  margin-bottom: 12px;
}

.receiver-heading h3 {
  margin: 0 0 3px;
  font-size: 16px;
}

.endpoint-row {
  gap: 12px;
  padding: 12px;
  background: #f5f8fc;
  border: 1px solid var(--admin-border);
  border-radius: 6px;
}

.endpoint-row code {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #244357;
  font-family: Consolas, Monaco, monospace;
}

.receiver-panel :deep(.el-alert) {
  margin-top: 12px;
}

.receiver-tip {
  margin-top: 10px;
  line-height: 1.6;
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

.detail-summary strong,
.phone-text {
  font-variant-numeric: tabular-nums;
}

.detail-descriptions :deep(.el-descriptions__label) {
  width: 112px;
  color: var(--admin-text-secondary);
  font-weight: 500;
}

.phone-text {
  margin-right: 8px;
  font-size: 16px;
}

.follow-form :deep(.el-form-item__content) {
  gap: 10px;
}

.follow-form :deep(.el-textarea),
.follow-form :deep(.el-select) {
  flex: 1;
}

.raw-collapse pre {
  max-height: 360px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  color: #334155;
  background: #f8fafc;
  border-radius: 6px;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .record-count {
    display: none;
  }

  .receiver-heading,
  .endpoint-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .endpoint-row .el-button {
    width: 100%;
  }

  :deep(.el-drawer) {
    width: 100% !important;
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
