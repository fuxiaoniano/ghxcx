<template>
  <section class="creative-page">
    <div class="page-heading">
      <div><h1 class="page-title">新建创意</h1><p>按腾讯广告当前账户、营销单元和创意规格生成组合；提交后逐条回查确认。</p></div>
      <el-button v-if="activeTab === 'create'" @click="activeTab = 'records'; loadTasks()">批量创建记录</el-button>
      <el-button v-else-if="canCreate" type="primary" @click="activeTab = 'create'">新建批次</el-button>
    </div>

    <el-alert title="当前使用腾讯营销接口第三版：普通创意与动态多素材创意会按所选规格分别提交。同一腾讯业务单元素材直接引用平台素材编号，不复制或重新上传到账户。" type="info" show-icon :closable="false" class="notice" />
    <el-alert v-if="options && !hasTencentUserToken" type="error" show-icon :closable="false" class="notice"><template #title>腾讯创建接口需要实名认证令牌（User Token），当前尚未配置，系统已停止提交以避免整批失败。</template><router-link to="/operations/sync-settings">前往推广数据同步设置</router-link></el-alert>

    <template v-if="activeTab === 'create'">
      <div class="content-panel steps-panel"><el-steps :active="step" finish-status="success" align-center><el-step title="账户" /><el-step title="营销单元" /><el-step title="创意规格" /><el-step title="素材与组合" /><el-step title="预览" /><el-step title="创建结果" /></el-steps></div>

      <div class="content-panel wizard-panel" v-loading="loading">
        <div v-if="step === 0" class="step-content">
          <h2>选择腾讯广告账户</h2>
          <el-form label-position="top">
            <el-form-item label="腾讯广告账户" required>
              <el-select v-model="form.accountId" filterable placeholder="请选择已授权账户" @change="accountChanged">
                <el-option v-for="item in options?.accounts || []" :key="item.id" :value="item.id" :disabled="!item.authorized || !item.canCreate" :label="`${item.name} · ${item.accountNo} · ${item.project}`"><span>{{ item.name }} · {{ item.accountNo }}</span><small class="option-note">{{ item.authorizationMessage }}</small></el-option>
              </el-select>
            </el-form-item>
          </el-form>
        </div>

        <div v-else-if="step === 1" class="step-content">
          <div class="section-title"><div><h2>选择营销单元</h2><p>仅可选择腾讯广告返回为可创建创意的营销单元。</p></div><el-input v-model="adgroupSearch" clearable placeholder="名称、ID、目标或状态" @keyup.enter="loadAdgroups"><template #append><el-button @click="loadAdgroups">查询</el-button></template></el-input></div>
          <div class="select-table-wrap">
            <el-table :data="adgroups" stripe><el-table-column width="56"><template #default="{ row }"><el-radio v-model="form.adgroupId" :value="row.id" :disabled="!row.canCreate"><span /></el-radio></template></el-table-column><el-table-column prop="name" label="营销单元" min-width="180" show-overflow-tooltip /><el-table-column prop="id" label="营销单元 ID" min-width="132" /><el-table-column label="推广目标" min-width="130"><template #default="{ row }">{{ platformEnumLabel(row.marketingGoal) }}</template></el-table-column><el-table-column label="优化目标" min-width="130"><template #default="{ row }">{{ platformEnumLabel(row.optimizationGoal) }}</template></el-table-column><el-table-column label="系统状态" min-width="180"><template #default="{ row }"><el-tag :type="row.canCreate ? 'success' : 'danger'">{{ adgroupStatusLabel(row.systemStatus) }}</el-tag><small v-if="row.unavailableReason">{{ row.unavailableReason }}</small></template></el-table-column></el-table>
          </div>
          <el-pagination v-model:current-page="adgroupPage" :page-size="20" :total="adgroupTotal" layout="prev, pager, next" @current-change="loadAdgroups" />
        </div>

        <div v-else-if="step === 2" class="step-content">
          <div class="section-title"><div><h2>获取并选择腾讯创意规格</h2><p>规格、必填项和数量限制均来自当前账户与营销单元的腾讯接口返回。</p></div><el-input v-model="templateSearch" clearable placeholder="搜索规格名称、ID 或样式" @keyup.enter="searchTemplates"><template #append><el-button @click="searchTemplates">查询</el-button></template></el-input></div>
          <div class="mode-grid">
            <label><span>投放模式</span><el-radio-group v-model="form.deliveryMode" @change="templateModeChanged"><el-radio-button value="DELIVERY_MODE_COMPONENT">组件化</el-radio-button><el-radio-button value="DELIVERY_MODE_CUSTOMIZE">自定义</el-radio-button></el-radio-group></label>
            <label><span>创意类型</span><el-radio-group v-model="form.dynamicCreativeType" @change="templateModeChanged"><el-radio-button value="DYNAMIC_CREATIVE_TYPE_COMMON">普通创意</el-radio-button><el-radio-button value="DYNAMIC_CREATIVE_TYPE_PROGRAM">动态创意</el-radio-button></el-radio-group></label>
          </div>
          <div class="template-grid">
            <button v-for="item in templates" :key="item.id" type="button" class="template-card" :class="{ selected: form.templateId === item.id }" @click="selectTemplate(item)"><img v-if="item.sampleImage" :src="item.sampleImage" alt="创意规格预览" /><div><strong>{{ item.name }}</strong><span>ID {{ item.id }} · {{ item.style || '未返回样式名' }}</span><small>{{ item.size || '尺寸由规格详情决定' }}</small></div></button>
          </div>
          <el-empty v-if="!templates.length" description="腾讯广告未返回当前营销单元可用的创意规格" />
          <el-pagination v-if="templateTotal" v-model:current-page="templatePage" :page-size="20" :total="templateTotal" layout="prev, pager, next" @current-change="loadTemplates" />
          <div v-if="templateDetail" class="requirements"><div class="panel-heading"><div><h3>规格字段要求</h3><p>数量、尺寸和必填状态均以当前腾讯规格为准。</p></div><el-tag effect="plain">规格 ID {{ form.templateId }}</el-tag></div><div v-if="templateDetail.requirements?.length" class="requirement-grid"><div v-for="item in templateDetail.requirements" :key="item.path || item.name" :class="{ optional: !item.required }"><strong>{{ componentFieldLabel(item.path || item.name) }}</strong><el-tag v-if="item.required" type="danger" size="small">必填</el-tag><el-tag v-else type="info" size="small">可选</el-tag><span>{{ requirementSummary(item) }}</span><small v-if="item.compatibilityNote" class="compatibility-note">{{ item.compatibilityNote }}</small></div></div><el-empty v-else :image-size="56" description="腾讯接口未返回该规格的字段约束，请切换规格或刷新后重试" /></div>
        </div>

        <div v-else-if="step === 3" class="step-content assets-step">
          <div class="section-title"><div><h2>选择素材并设置组合</h2><p>账户资产仅来自已选账户；业务单元资产来自腾讯营销后台所属业务单元，不再使用管理后台项目归组。</p></div><el-button :loading="assetsLoading" @click="loadAssets(true)">刷新平台素材</el-button></div>
          <div class="asset-controls"><el-radio-group v-model="assetSource" @change="assetFilterChanged"><el-radio-button value="ACCOUNT">账户资产</el-radio-button><el-radio-button value="BUSINESS_UNIT">业务单元资产</el-radio-button></el-radio-group><el-select v-model="assetType" @change="assetTypeChanged"><el-option v-for="type in compatibleAssetTypes" :key="type.value" :value="type.value" :label="type.label" /></el-select><el-select v-if="assetType === 'MEDIA'" v-model="assetDimensions" clearable placeholder="全部尺寸" @change="assetFilterChanged"><el-option v-for="item in availableDimensions" :key="item" :value="item" :label="item" /></el-select><el-select v-model="assetSortBy" @change="assetFilterChanged"><el-option label="按创建时间" value="CREATED_TIME" /><el-option label="按名称" value="NAME" /><el-option label="按近7天消费" value="SPEND_7_DAYS" /><el-option label="按近15天消费" value="SPEND_15_DAYS" /><el-option label="按状态" value="STATUS" /></el-select><el-select v-model="assetSortOrder" @change="assetFilterChanged"><el-option label="降序" value="DESC" /><el-option label="升序" value="ASC" /></el-select><el-input v-model="assetSearch" clearable placeholder="搜索名称或素材 ID" @keyup.enter="assetSearchSubmit"><template #append><el-button @click="assetSearchSubmit">搜索</el-button></template></el-input></div>
          <div class="asset-layout">
            <div class="asset-list-table">
              <div class="asset-table-scroll">
                <el-table :data="assets" stripe row-key="id" :row-class-name="assetRowClass" @row-click="toggleAsset" @sort-change="assetTableSortChanged">
                  <el-table-column label="选择" width="88" align="center"><template #default="{ row }"><el-button class="asset-select-button" size="small" :type="selectedAssetIds.has(row.id) ? 'success' : 'primary'" :plain="!selectedAssetIds.has(row.id)" :disabled="!row.usable" @click.stop="toggleAsset(row)">{{ selectedAssetIds.has(row.id) ? '已选' : '选择' }}</el-button></template></el-table-column>
                  <el-table-column label="素材内容" min-width="260"><template #default="{ row }"><div class="asset-content-cell"><strong :title="assetContent(row)">{{ assetContent(row) }}</strong><small v-if="row.contentSummary && row.contentSummary !== row.name" :title="row.type === 'BRAND' ? row.contentSummary : row.name">{{ row.type === 'BRAND' ? `品牌内容：${row.contentSummary}` : `组件名称：${row.name}` }}</small><span v-if="row.unavailableReason" class="asset-error">{{ row.unavailableReason }}</span></div></template></el-table-column>
                  <el-table-column v-if="['TEXT_LINK', 'ACTION_BUTTON', 'MINI_CARD_LINK'].includes(assetType)" label="关联落地页组件" min-width="280"><template #default="{ row }"><div v-if="row.linkedLandingPage" class="asset-content-cell linked-page-cell"><strong :title="row.linkedLandingPage.name">{{ row.linkedLandingPage.name }}</strong><small>page_id：{{ row.linkedLandingPage.pageId }}</small></div><span v-else class="asset-error">未关联落地页</span></template></el-table-column>
                  <el-table-column label="类型" width="138"><template #default="{ row }">{{ assetTypeLabel(row.type, row) }}</template></el-table-column>
                  <el-table-column label="来源" min-width="150"><template #default="{ row }">{{ row.source === 'ACCOUNT' ? '账户资产' : '腾讯业务单元资产' }}<small class="block">{{ row.sourceAccount.name }}</small></template></el-table-column>
                  <el-table-column prop="platformAssetId" label="素材编号" min-width="128" show-overflow-tooltip />
                  <el-table-column v-if="assetType === 'MEDIA'" prop="dimensions" label="素材尺寸" width="118"><template #default="{ row }">{{ row.dimensions || '待同步' }}</template></el-table-column>
                  <el-table-column prop="spend7Days" label="近7天消费" width="118" sortable="custom"><template #default="{ row }">{{ formatSpend(row.spend7Days) }}</template></el-table-column>
                  <el-table-column prop="spend15Days" label="近15天消费" width="124" sortable="custom"><template #default="{ row }">{{ formatSpend(row.spend15Days) }}</template></el-table-column>
                  <el-table-column prop="createdTime" label="创建时间" width="168" sortable="custom"><template #default="{ row }">{{ row.createdTime ? formatTime(row.createdTime) : '—' }}</template></el-table-column>
                  <el-table-column prop="status" label="状态" width="112" sortable="custom"><template #default="{ row }"><el-tag :type="row.usable ? 'success' : 'danger'" size="small">{{ row.usable ? '可直接引用' : '不可用' }}</el-tag></template></el-table-column>
                </el-table>
              </div>
              <div class="asset-mobile-list">
                <article v-for="row in assets" :key="row.id" class="asset-mobile-card" :class="{ selected: selectedAssetIds.has(row.id), disabled: !row.usable }" @click="toggleAsset(row)">
                  <header><el-tag size="small" effect="plain">{{ assetTypeLabel(row.type, row) }}</el-tag><el-button size="small" :type="selectedAssetIds.has(row.id) ? 'success' : 'primary'" :plain="!selectedAssetIds.has(row.id)" :disabled="!row.usable" @click.stop="toggleAsset(row)">{{ selectedAssetIds.has(row.id) ? '已选择' : '选择' }}</el-button></header>
                  <strong :title="assetContent(row)">{{ assetContent(row) }}</strong>
                  <p v-if="row.contentSummary && row.contentSummary !== row.name">组件名称：{{ row.name }}</p>
                  <dl><div><dt>来源</dt><dd>{{ row.source === 'ACCOUNT' ? '账户资产' : '腾讯业务单元' }}</dd></div><div><dt>编号</dt><dd>{{ row.platformAssetId }}</dd></div><div v-if="row.dimensions"><dt>尺寸</dt><dd>{{ row.dimensions }}</dd></div><div v-if="row.linkedLandingPage"><dt>关联落地页</dt><dd>{{ row.linkedLandingPage.name }}</dd></div><div><dt>近7天</dt><dd>{{ formatSpend(row.spend7Days) }}</dd></div><div><dt>近15天</dt><dd>{{ formatSpend(row.spend15Days) }}</dd></div></dl>
                  <span v-if="row.unavailableReason" class="asset-error">{{ row.unavailableReason }}</span>
                </article>
              </div>
              <el-empty v-if="!assets.length && !assetsLoading" description="当前创意规格下没有符合要求的素材" />
              <el-pagination v-model:current-page="assetPage" :page-size="20" :total="assetTotal" layout="prev, pager, next" @current-change="loadAssets()" />
            </div>
            <aside class="selected-assets"><div class="selected-heading"><h3>已选素材 <el-tag>{{ selectedAssets.length }}</el-tag></h3><el-button v-if="selectedAssets.length" text type="danger" @click="clearSelectedAssets">清空</el-button></div><p class="selected-help">核心素材按数量规则组合；品牌、行动按钮、文字链等固定组件会带入每条创意。腾讯九图组件不能与单图混选。</p><div v-for="item in selectedAssets" :key="item.id" class="selected-row"><div><strong :title="assetContent(item)">{{ assetContent(item) }}</strong><small>{{ assetTypeLabel(item.type, item) }} · {{ isFixedAsset(item) ? '固定组件' : '组合素材' }}</small></div><el-button text type="danger" @click.stop="removeAsset(item)">移除</el-button></div><el-empty v-if="!selectedAssets.length" :image-size="64" description="尚未选择素材" /></aside>
          </div>
          <div class="combination-panel">
            <div class="combination-heading"><h3>组合策略与每条创意素材数量</h3><el-tag :type="estimatedCount > (options?.maxBatchSize || 50) ? 'danger' : estimatedCount > 20 ? 'warning' : 'success'">预计 {{ estimatedCount }} 条</el-tag></div>
            <el-radio-group v-model="form.combinationMode"><el-radio-button value="BALANCED">均衡组合（推荐）</el-radio-button><el-radio-button value="CARTESIAN">全组合</el-radio-button></el-radio-group>
            <el-alert class="combination-tip" type="info" :closable="false" title="只需设置会变化的素材数量；品牌形象、行动按钮、文字链、浮层卡片等固定组件会自动加入每条创意。" />
            <el-alert v-if="form.dynamicCreativeType === 'DYNAMIC_CREATIVE_TYPE_COMMON'" class="combination-tip" type="success" :closable="false" title="普通创意已支持视频、图片、文案和落地页多选；每条数量仍不能超过当前腾讯规格上限。" />
            <div class="count-grid"><label v-for="item in visibleCountFields" :key="item.key"><span>{{ countFieldLabel(item) }}</span><el-input-number v-model="form.rules[item.key]" :min="0" :max="ruleMax(item.key)" /></label></div>
            <el-form label-position="top"><el-form-item label="创意命名规则" required><el-input ref="namePatternInput" v-model="form.namePattern" maxlength="120" show-word-limit /><div class="name-tokens"><span>点击插入：</span><el-button v-for="token in nameTokens" :key="token" size="small" plain @click="insertNameToken(token)">{{ token }}</el-button></div><small class="name-tip">组件通配符会自动读取每条组合的第一个对应组件名称；多个同类组件会以“+”连接。</small></el-form-item></el-form>
          </div>
        </div>

        <div v-else-if="step === 4" class="step-content">
          <div class="section-title"><div><h2>组合预览</h2><p>每一条均为服务端根据真实规格重新校验后生成的实际提交结构。</p></div><el-tag :type="preview?.requiresConfirmation ? 'warning' : 'success'">预计 {{ preview?.items.length || 0 }} 条</el-tag></div>
          <el-alert v-if="preview?.requiresConfirmation" title="本批次超过 20 条，请确认素材组合与腾讯账户无误后再提交。" type="warning" show-icon :closable="false" />
          <div class="publish-status-setting"><div><strong>创建后投放状态</strong><small>默认开启投放；如需先检查腾讯后台内容，可手动选择暂停。</small></div><el-radio-group v-model="configuredStatus"><el-radio-button value="AD_STATUS_NORMAL">开启投放</el-radio-button><el-radio-button value="AD_STATUS_SUSPEND">暂停投放</el-radio-button></el-radio-group></div>
          <el-collapse class="preview-list"><el-collapse-item v-for="item in preview?.items || []" :key="item.sequence" :title="`${item.sequence}. ${item.name}`"><div class="preview-chips"><span v-for="asset in item.materials" :key="String(asset.id)">{{ asset.name }} · {{ assetTypeLabel(String(asset.type)) }} · {{ asset.source === 'ACCOUNT' ? '账户资产' : '腾讯业务单元资产' }}</span></div><div class="preview-fields"><strong>实际提交组件：</strong><span v-for="field in Object.keys(item.creativeComponents || {})" :key="field">{{ componentFieldLabel(field) }}</span></div></el-collapse-item></el-collapse>
        </div>

        <div v-else class="step-content">
          <div class="section-title"><div><h2>创建结果</h2><p>只有腾讯广告回查确认账户、营销单元和创意规格一致后才标记成功。</p></div><el-button @click="refreshCurrentTask">刷新</el-button></div>
          <div v-if="currentTask" class="task-summary"><strong>{{ taskStatusLabel(currentTask.status) }}</strong><span>总计 {{ currentTask.totalCount }}</span><span>成功 {{ currentTask.successCount }}</span><span>失败 {{ currentTask.failedCount }}</span><span>待确认 {{ currentTask.unknownCount }}</span></div>
          <el-table :data="currentTask?.items || []" stripe><el-table-column prop="sequence" label="#" width="56" /><el-table-column prop="creativeName" label="创意名称" min-width="190" show-overflow-tooltip /><el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="taskStatusType(row.status)">{{ taskStatusLabel(row.status) }}</el-tag></template></el-table-column><el-table-column prop="platformCreativeId" label="腾讯创意 ID" min-width="140" /><el-table-column label="错误与处理" min-width="260"><template #default="{ row }"><div class="error-copy"><strong v-if="row.errorCode">{{ row.errorCode }}</strong><span>{{ row.errorMessage || '—' }}</span><small>{{ row.recoverySuggestion }}</small></div></template></el-table-column></el-table>
          <div class="result-actions"><el-button v-if="canCancel && ['PENDING', 'PROCESSING'].includes(currentTask?.status || '')" :loading="actionLoading" type="danger" plain @click="cancelCurrent">取消未开始项</el-button><el-button v-if="canRetry && (currentTask?.failedCount || currentTask?.unknownCount)" :loading="actionLoading" :disabled="!hasTencentUserToken" @click="retryCurrent">仅重试失败/待确认</el-button><el-button v-if="canExport" @click="exportCurrent">导出结果</el-button></div>
        </div>
      </div>

      <div class="wizard-actions"><el-button v-if="step > 0 && step < 5" @click="step--">上一步</el-button><el-button v-if="step < 4 && canCreate" type="primary" :loading="loading" @click="nextStep">下一步</el-button><el-button v-if="step === 4 && canCreate" type="primary" :loading="submitting" @click="submitBatch">提交批量创建</el-button><el-button v-if="step === 5 && canCreate" type="primary" @click="startNew">新建下一批</el-button></div>
    </template>

    <div v-else class="content-panel records-panel">
      <div class="records-toolbar"><el-select v-model="taskFilter.status" clearable placeholder="全部状态" @change="loadTasks"><el-option v-for="status in taskStatuses" :key="status" :value="status" :label="taskStatusLabel(status)" /></el-select><el-select v-model="taskFilter.accountId" clearable filterable placeholder="全部账户" @change="loadTasks"><el-option v-for="item in options?.accounts || []" :key="item.id" :value="item.id" :label="`${item.name} · ${item.accountNo}`" /></el-select><el-button @click="loadTasks">刷新</el-button></div>
      <el-table :data="tasks" stripe @row-click="openTask"><el-table-column prop="createdAt" label="创建时间" width="172"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column><el-table-column label="账户" min-width="170"><template #default="{ row }">{{ row.account?.name }}<small class="block">{{ row.account?.accountNo }}</small></template></el-table-column><el-table-column prop="adgroupId" label="营销单元 ID" min-width="140" /><el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="taskStatusType(row.status)">{{ taskStatusLabel(row.status) }}</el-tag></template></el-table-column><el-table-column label="进度" min-width="190"><template #default="{ row }">成功 {{ row.successCount }}/{{ row.totalCount }} · 失败 {{ row.failedCount }} · 待确认 {{ row.unknownCount }}</template></el-table-column><el-table-column label="操作" width="110"><template #default="{ row }"><el-button link type="primary" @click.stop="openTask(row)">查看结果</el-button></template></el-table-column></el-table>
      <el-pagination v-model:current-page="taskFilter.page" :page-size="20" :total="taskTotal" layout="prev, pager, next" @current-change="loadTasks" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import {
  cancelPromotionCreativeBatch, createPromotionCreativeBatch, exportPromotionCreativeBatch, getPromotionCreativeAdgroups,
  getPromotionCreativeAssets, getPromotionCreativeBatchOptions, getPromotionCreativeBatchTask, getPromotionCreativeBatchTasks,
  getPromotionCreativeTemplateDetail, getPromotionCreativeTemplates, previewPromotionCreativeBatch, retryPromotionCreativeBatch,
  type PromotionCreativeAdgroup, type PromotionCreativeAsset, type PromotionCreativeBatchOptions, type PromotionCreativeBatchPayload,
  type PromotionCreativeBatchTask, type PromotionCreativeTemplate,
} from '../api/admin';

type RuleKey = keyof PromotionCreativeBatchPayload['rules'];
const auth = useAuthStore();
const route = useRoute();
const activeTab = ref<'create' | 'records'>('create'); const step = ref(0); const loading = ref(false); const submitting = ref(false); const actionLoading = ref(false);
const options = ref<PromotionCreativeBatchOptions | null>(null); const adgroups = ref<PromotionCreativeAdgroup[]>([]); const templates = ref<PromotionCreativeTemplate[]>([]); const templateDetail = ref<any>(null);
const adgroupSearch = ref(''); const adgroupPage = ref(1); const adgroupTotal = ref(0);
const templateSearch = ref(''); const templatePage = ref(1); const templateTotal = ref(0);
const assetSource = ref<'ACCOUNT' | 'BUSINESS_UNIT'>('ACCOUNT'); const assetType = ref('MEDIA'); const assetDimensions = ref(''); const availableDimensions = ref<string[]>([]); const assetSearch = ref(''); const assets = ref<PromotionCreativeAsset[]>([]); const assetsLoading = ref(false); const assetPage = ref(1); const assetTotal = ref(0); const selectedAssets = ref<PromotionCreativeAsset[]>([]);
const assetSortBy = ref<'CREATED_TIME' | 'NAME' | 'SPEND_7_DAYS' | 'SPEND_15_DAYS' | 'STATUS'>('CREATED_TIME'); const assetSortOrder = ref<'ASC' | 'DESC'>('DESC');
const preview = ref<Awaited<ReturnType<typeof previewPromotionCreativeBatch>> | null>(null); const currentTask = ref<PromotionCreativeBatchTask | null>(null); let pollTimer: number | undefined;
const tasks = ref<PromotionCreativeBatchTask[]>([]); const taskTotal = ref(0); const taskFilter = reactive({ accountId: '', status: '', page: 1 });
const emptyMaterials = () => ({ titles: [], videos: [], landingPages: [], conversionComponents: [], images: [], otherComponents: [] });
const form = reactive<PromotionCreativeBatchPayload>({ accountId: '', businessUnitKey: '', adgroupId: '', templateId: '', deliveryMode: 'DELIVERY_MODE_COMPONENT', dynamicCreativeType: 'DYNAMIC_CREATIVE_TYPE_COMMON', combinationMode: 'BALANCED', namePattern: `批量创意+${new Date().toISOString().slice(0, 10)}+{序号}`, materials: emptyMaterials(), rules: { titleCount: 1, videoCount: 1, landingPageCount: 1, conversionCount: 0, imageCount: 0 }, manualGroups: [], options: { configuredStatus: 'AD_STATUS_NORMAL' } });
const assetTypes = [{ value: 'MEDIA', label: '图片/视频' }, { value: 'COPY', label: '文案' }, { value: 'LANDING_PAGE', label: '落地页' }, { value: 'BRAND', label: '品牌形象' }, { value: 'ACTION_BUTTON', label: '行动按钮' }, { value: 'MINI_CARD_LINK', label: '图文链接' }, { value: 'TEXT_LINK', label: '文字链' }, { value: 'FLOATING_ZONE', label: '浮层卡片' }, { value: 'LABEL', label: '标签' }, { value: 'SOCIAL_SKILL', label: '首评回复' }];
const countFields: Array<{ key: RuleKey; label: string }> = [{ key: 'titleCount', label: '每条文案数' }, { key: 'videoCount', label: '每条视频数' }, { key: 'landingPageCount', label: '每条落地页数' }, { key: 'imageCount', label: '每条图片数' }];
const nameTokens = ['{账户}', '{标题}', '{视频}', '{图片}', '{品牌形象}', '{营销组件}', '{落地页}', '{日期}', '{序号}'];
const taskStatuses = ['PENDING', 'PROCESSING', 'PARTIAL_SUCCESS', 'SUCCEEDED', 'FAILED', 'UNKNOWN', 'CANCELLED'];
const selectedAssetIds = computed(() => new Set(selectedAssets.value.map((item) => item.id))); const canCreate = computed(() => auth.hasPermission('PROMOTION_CREATIVE_BATCH_CREATE')); const canRetry = computed(() => auth.hasPermission('PROMOTION_CREATIVE_BATCH_RETRY')); const canCancel = computed(() => auth.hasPermission('PROMOTION_CREATIVE_BATCH_CANCEL')); const canExport = computed(() => auth.hasPermission('PROMOTION_CREATIVE_RESULT_EXPORT'));
const compatibleAssetTypes = computed(() => {
  const fields = new Set((templateDetail.value?.requirements || []).map((item: any) => String(item.path || item.name || '').split('.').pop()));
  if (!fields.size) return assetTypes;
  const compatibility: Record<string, string[]> = {
    MEDIA: ['image', 'image_list', 'video', 'video_list', 'short_video'], COPY: ['title', 'description'], LANDING_PAGE: ['main_jump_info', 'jump_info', 'end_page'],
    BRAND: ['brand', 'channels_brand'], ACTION_BUTTON: ['action_button', 'chosen_button'], MINI_CARD_LINK: ['mini_card_link'], TEXT_LINK: ['text_link'],
    FLOATING_ZONE: ['floating_zone', 'floating_zone_list'], LABEL: ['label'], SOCIAL_SKILL: ['social_skill'],
  };
  return assetTypes.filter((type) => compatibility[type.value]?.some((field) => fields.has(field)));
});
const visibleCountFields = computed(() => countFields.filter((field) => (templateDetail.value?.requirements || []).some((item: any) => requirementRuleKey(item.path || item.name) === field.key)));
const hasTencentUserToken = computed(() => Boolean(options.value?.accounts.some((item) => item.hasUserToken)));
const configuredStatus = computed<'AD_STATUS_NORMAL' | 'AD_STATUS_SUSPEND'>({
  get: () => form.options?.configuredStatus || 'AD_STATUS_NORMAL',
  set: (value) => { form.options = { ...(form.options || {}), configuredStatus: value }; },
});
const estimatedCount = computed(() => {
  const countByType = (type: string) => selectedAssets.value.filter((item) => materialGroup(item.type) === type).length;
  const pairs: Array<[number, number]> = [[countByType('TITLE'), form.rules.titleCount], [countByType('VIDEO'), form.rules.videoCount], [countByType('LANDING_PAGE'), form.rules.landingPageCount], [countByType('IMAGE'), form.rules.imageCount]];
  const fixedGroupSizes = new Map<string, number>();
  selectedAssets.value.filter(isFixedAsset).forEach((asset) => { const field = canonicalComponentField(asset.componentField || asset.type); fixedGroupSizes.set(field, (fixedGroupSizes.get(field) || 0) + 1); });
  if (pairs.some(([available, needed]) => needed > available)) return 0;
  if (form.combinationMode === 'BALANCED') return Math.max(1, ...pairs.map(([available, needed]) => needed ? Math.ceil(available / needed) : 0), ...fixedGroupSizes.values());
  const choose = (n: number, k: number) => { if (!k) return 1; let value = 1; for (let index = 1; index <= k; index += 1) value = value * (n - index + 1) / index; return Math.round(value); };
  return pairs.reduce((total, [available, needed]) => total * choose(available, needed), 1) * [...fixedGroupSizes.values()].reduce((total, size) => total * size, 1);
});

async function init() { loading.value = true; try { options.value = await getPromotionCreativeBatchOptions(); const initialAccountId = String(route.query.accountId || ''); if (initialAccountId && options.value.accounts.some((item) => item.id === initialAccountId && item.authorized && item.canCreate)) { form.accountId = initialAccountId; accountChanged(initialAccountId); } if (route.query.tab === 'records' || !canCreate.value) { activeTab.value = 'records'; await loadTasks(); } } finally { loading.value = false; } }
function accountChanged(id: string) { const account = options.value?.accounts.find((item) => item.id === id); form.businessUnitKey = account?.tencentBusinessUnitKey || `TENCENT_ACCOUNT:${account?.accountNo || id}`; form.adgroupId = ''; form.templateId = ''; adgroups.value = []; templates.value = []; templateDetail.value = null; selectedAssets.value = []; assetDimensions.value = ''; availableDimensions.value = []; form.materials = emptyMaterials(); preview.value = null; }
async function loadAdgroups() { if (!form.accountId) return; loading.value = true; try { const result = await getPromotionCreativeAdgroups({ accountId: form.accountId, search: adgroupSearch.value, page: adgroupPage.value, pageSize: 20 }); adgroups.value = result.list; adgroupTotal.value = result.pageInfo.totalNumber; } finally { loading.value = false; } }
function templateModeChanged() { form.templateId = ''; templates.value = []; templateDetail.value = null; templatePage.value = 1; loadTemplates(); }
function searchTemplates() { templatePage.value = 1; loadTemplates(); }
async function loadTemplates() { if (!form.accountId || !form.adgroupId) return; loading.value = true; try { const result = await getPromotionCreativeTemplates({ accountId: form.accountId, adgroupId: form.adgroupId, deliveryMode: form.deliveryMode, dynamicCreativeType: form.dynamicCreativeType, search: templateSearch.value, page: templatePage.value, pageSize: 20 }); templates.value = result.list; templateTotal.value = result.pageInfo.totalNumber; } finally { loading.value = false; } }
async function selectTemplate(item: PromotionCreativeTemplate) { form.templateId = item.id; loading.value = true; try { templateDetail.value = await getPromotionCreativeTemplateDetail({ accountId: form.accountId, adgroupId: form.adgroupId, templateId: item.id, deliveryMode: form.deliveryMode, dynamicCreativeType: form.dynamicCreativeType }); applyTemplateDefaults(); assetType.value = compatibleAssetTypes.value[0]?.value || 'MEDIA'; assetDimensions.value = ''; availableDimensions.value = []; assets.value = []; assetPage.value = 1; } finally { loading.value = false; } }
function requirementRuleKey(path: string): RuleKey | null {
  const field = String(path || '').split('.').pop() || '';
  if (['title', 'description'].includes(field)) return 'titleCount';
  if (/video/.test(field)) return 'videoCount';
  if (/image/.test(field)) return 'imageCount';
  if (/main_jump_info|^jump_info$|end_page/.test(field)) return 'landingPageCount';
  if (/form|consult|phone|button|pendant|social_skill|floating_zone|text_link|mini_card_link|count_down|barrage|show_data/.test(field)) return 'conversionCount';
  return null;
}
function ruleBounds(key: RuleKey) {
  const requirements = (templateDetail.value?.requirements || []).filter((item: any) => requirementRuleKey(item.path || item.name) === key);
  const countOf = (item: any, bound: 'min' | 'max') => key === 'imageCount' && Number(item[`item${bound === 'min' ? 'Min' : 'Max'}`] || 0) > 0
    ? Number(item[`item${bound === 'min' ? 'Min' : 'Max'}`])
    : Number(item[bound] || 0);
  return { min: requirements.filter((item: any) => item.required).reduce((total: number, item: any) => total + Math.max(1, countOf(item, 'min')), 0), max: Math.min(20, requirements.reduce((total: number, item: any) => total + Math.max(0, countOf(item, 'max')), 0) || 20) };
}
function ruleMax(key: RuleKey) { return ruleBounds(key).max; }
function countFieldLabel(item: { key: RuleKey; label: string }) { return item.key === 'imageCount' && selectedAssets.value.some(isImageListBundle) ? '每条九图组件数' : item.label; }
function applyTemplateDefaults() { for (const item of countFields) form.rules[item.key] = ruleBounds(item.key).min; form.rules.conversionCount = 0; }
async function loadAssets(refresh = false) { if (!form.accountId || !form.adgroupId || !form.templateId) return; assetsLoading.value = true; try { const result = await getPromotionCreativeAssets({ accountId: form.accountId, source: assetSource.value, businessUnitKey: form.businessUnitKey, assetType: assetType.value, dimensions: assetType.value === 'MEDIA' ? assetDimensions.value || undefined : undefined, search: assetSearch.value, adgroupId: form.adgroupId, templateId: form.templateId, deliveryMode: form.deliveryMode, dynamicCreativeType: form.dynamicCreativeType, sortBy: assetSortBy.value, sortOrder: assetSortOrder.value, page: assetPage.value, pageSize: 20, refresh }); assets.value = result.list; assetTotal.value = result.pageInfo.totalNumber; availableDimensions.value = result.availableDimensions || []; if (assetDimensions.value && !availableDimensions.value.includes(assetDimensions.value)) assetDimensions.value = ''; } finally { assetsLoading.value = false; } }
function assetFilterChanged() { assetPage.value = 1; void loadAssets(); }
function assetTypeChanged() { assetDimensions.value = ''; availableDimensions.value = []; assetFilterChanged(); }
function assetSearchSubmit() { assetPage.value = 1; void loadAssets(); }
function assetTableSortChanged({ prop, order }: { prop?: string; order?: 'ascending' | 'descending' | null }) {
  const fields: Record<string, typeof assetSortBy.value> = { spend7Days: 'SPEND_7_DAYS', spend15Days: 'SPEND_15_DAYS', createdTime: 'CREATED_TIME', status: 'STATUS' };
  if (!order || !fields[prop || '']) return;
  assetSortBy.value = fields[prop || '']; assetSortOrder.value = order === 'ascending' ? 'ASC' : 'DESC'; assetFilterChanged();
}
function assetRowClass({ row }: { row: PromotionCreativeAsset }) { return [!row.usable ? 'asset-row-disabled' : '', selectedAssetIds.value.has(row.id) ? 'asset-row-selected' : ''].filter(Boolean).join(' '); }
function assetContent(asset: PromotionCreativeAsset) { return asset.type === 'BRAND' ? asset.name : asset.contentSummary || asset.name; }
function canonicalComponentField(value?: string | null) { return ({ floating_zone_list: 'floating_zone', jump_info: 'main_jump_info', channels_brand: 'brand' } as Record<string, string>)[String(value || '')] || String(value || ''); }
function isFixedAsset(asset: PromotionCreativeAsset) { return ['CONVERSION', 'OTHER'].includes(materialGroup(asset.type)); }
function isImageListBundle(asset: PromotionCreativeAsset) { return canonicalComponentField(asset.componentField) === 'image_list' && Number(asset.bundleItemCount || 0) > 1; }
function toggleAsset(asset: PromotionCreativeAsset) {
  if (!asset.usable) return ElMessage.warning(asset.unavailableReason || '该素材不可用于当前账户');
  if (selectedAssetIds.value.has(asset.id)) return removeAsset(asset);
  if (materialGroup(asset.type) === 'IMAGE') {
    const selectingBundle = isImageListBundle(asset);
    const hasOppositeImageType = selectedAssets.value.some((item) => materialGroup(item.type) === 'IMAGE' && isImageListBundle(item) !== selectingBundle);
    if (hasOppositeImageType) {
      selectedAssets.value = selectedAssets.value.filter((item) => materialGroup(item.type) !== 'IMAGE');
      ElMessage.info(selectingBundle ? '已切换为腾讯九图组件模式，原单图选择已清除' : '已切换为单图组装模式，原九图组件选择已清除');
    }
  }
  selectedAssets.value.push(asset); syncMaterialIds();
}
function removeAsset(asset: PromotionCreativeAsset) { selectedAssets.value = selectedAssets.value.filter((item) => item.id !== asset.id); syncMaterialIds(); }
function clearSelectedAssets() { selectedAssets.value = []; syncMaterialIds(); preview.value = null; }
function materialGroup(type: string) { if (['MARKETING', 'CONVERSION'].includes(type)) return 'CONVERSION'; if (['BRAND', 'OTHER'].includes(type)) return 'OTHER'; return type; }
function syncMaterialIds() { const by = (type: string) => selectedAssets.value.filter((item) => materialGroup(item.type) === type).map((item) => item.id); form.materials = { titles: by('TITLE'), videos: by('VIDEO'), landingPages: by('LANDING_PAGE'), conversionComponents: by('CONVERSION'), images: by('IMAGE'), otherComponents: by('OTHER') }; form.rules.conversionCount = 0; const selectedImages = selectedAssets.value.filter((item) => materialGroup(item.type) === 'IMAGE'); if (selectedImages.some(isImageListBundle)) form.rules.imageCount = 1; else if (form.rules.imageCount === 1 && ruleBounds('imageCount').min > 1) form.rules.imageCount = ruleBounds('imageCount').min; }
function insertNameToken(token: string) { const current = form.namePattern.trimEnd(); const separator = current && !current.endsWith('+') ? '+' : ''; form.namePattern = `${current}${separator}${token}`.slice(0, 120); }
async function nextStep() {
  if (step.value === 0) { if (!form.accountId) return ElMessage.warning('请选择可创建创意的腾讯广告账户'); await loadAdgroups(); }
  else if (step.value === 1) { if (!form.adgroupId) return ElMessage.warning('请选择可投放营销单元'); const selected = adgroups.value.find((item) => item.id === form.adgroupId); if (selected) form.namePattern = `${selected.name}+{序号}`.slice(0, 120); await loadTemplates(); }
  else if (step.value === 2) {
    if (!form.templateId || !templateDetail.value) return ElMessage.warning('请选择并加载腾讯创意规格');
    // 素材同步可能需要分页读取腾讯接口。先立即进入素材步骤，再在新页面
    // 展示列表 Loading，避免用户停留在规格页误以为“下一步”卡死。
    step.value = 3;
    await nextTick();
    window.requestAnimationFrame(() => { void loadAssets().catch(() => undefined); });
    return;
  }
  else if (step.value === 3) { if (!selectedAssets.value.length) return ElMessage.warning('请至少选择一项可用素材'); loading.value = true; try { preview.value = await previewPromotionCreativeBatch(form); } finally { loading.value = false; } }
  step.value += 1;
}
async function submitBatch() { if (!preview.value?.items.length) return; if (preview.value.requiresConfirmation) await ElMessageBox.confirm(`本次将向腾讯广告提交 ${preview.value.items.length} 条创意，确认继续？`, '批量创建确认', { type: 'warning' }); submitting.value = true; try { const task = await createPromotionCreativeBatch(form); currentTask.value = task; step.value = 5; ElMessage.success(task.message || '任务已创建'); startPolling(); } finally { submitting.value = false; } }
function startPolling() { stopPolling(); pollTimer = window.setInterval(refreshCurrentTask, 3000); }
function stopPolling() { if (pollTimer) window.clearInterval(pollTimer); pollTimer = undefined; }
async function refreshCurrentTask() { if (!currentTask.value?.id) return; currentTask.value = await getPromotionCreativeBatchTask(currentTask.value.id); if (['SUCCEEDED', 'FAILED', 'PARTIAL_SUCCESS', 'UNKNOWN', 'CANCELLED'].includes(currentTask.value.status)) stopPolling(); }
async function retryCurrent() { if (!currentTask.value) return; actionLoading.value = true; try { currentTask.value = await retryPromotionCreativeBatch(currentTask.value.id); startPolling(); ElMessage.success('已先回查待确认项，并重新排队安全可重试项'); } finally { actionLoading.value = false; } }
async function cancelCurrent() { if (!currentTask.value) return; await ElMessageBox.confirm('仅会取消尚未提交腾讯广告的明细；已被平台接受的创意不会删除。', '取消批次', { type: 'warning' }); actionLoading.value = true; try { await cancelPromotionCreativeBatch(currentTask.value.id); currentTask.value = await getPromotionCreativeBatchTask(currentTask.value.id); stopPolling(); ElMessage.success('未开始项已取消'); } finally { actionLoading.value = false; } }
async function exportCurrent() { if (!currentTask.value) return; await exportPromotionCreativeBatch(currentTask.value.id); }
function startNew() { stopPolling(); currentTask.value = null; preview.value = null; step.value = 0; form.adgroupId = ''; form.templateId = ''; selectedAssets.value = []; form.materials = emptyMaterials(); form.options = { ...(form.options || {}), configuredStatus: 'AD_STATUS_NORMAL' }; }
async function loadTasks() { const result = await getPromotionCreativeBatchTasks({ accountId: taskFilter.accountId || undefined, status: taskFilter.status || undefined, page: taskFilter.page, pageSize: 20 }); tasks.value = result.list; taskTotal.value = result.pageInfo.totalNumber; }
async function openTask(task: PromotionCreativeBatchTask) { currentTask.value = await getPromotionCreativeBatchTask(task.id); activeTab.value = 'create'; step.value = 5; if (['PENDING', 'PROCESSING'].includes(currentTask.value.status)) startPolling(); }
function assetTypeLabel(type: string, asset?: PromotionCreativeAsset) { if (asset && isImageListBundle(asset)) return `腾讯九图组件（${asset.bundleItemCount} 张）`; return ({ TITLE: '文案', VIDEO: '图片/视频', IMAGE: '图片/视频', BRAND: '新版品牌形象', LANDING_PAGE: '落地页', ACTION_BUTTON: '行动按钮', MINI_CARD_LINK: '图文链接', TEXT_LINK: '文字链', FLOATING_ZONE: '浮层卡片', LABEL: '标签', SOCIAL_SKILL: '首评回复', MARKETING: '营销组件', CONVERSION: '营销组件', OTHER: '其他组件' } as Record<string, string>)[type] || type; }
function adgroupStatusLabel(value?: string | null) { return ({ ADGROUP_STATUS_NORMAL: '投放中', AD_STATUS_NORMAL: '投放中', ADGROUP_STATUS_SUSPEND: '已暂停', AD_STATUS_SUSPEND: '已暂停', ADGROUP_STATUS_PENDING: '待审核', ADGROUP_STATUS_DELETED: '已删除', ADGROUP_STATUS_CREATIVE_EMPTY: '缺少创意' } as Record<string, string>)[String(value || '')] || (value ? platformEnumLabel(value) : '腾讯未返回状态'); }
function platformEnumLabel(value?: string | null) { if (!value) return '—'; const exact = ({ MARKETING_GOAL_LEADS: '获取销售线索', MARKETING_GOAL_LEAD_RETENTION: '获取销售线索', MARKETING_GOAL_WECHAT: '微信生态推广', MARKETING_SUB_GOAL_UNKNOWN: '未明确子目标', MARKETING_CARRIER_TYPE_JUMP_PAGE: '跳转落地页', MARKETING_TARGET_TYPE_CONSUME_MEDICAL: '医疗服务', OPTIMIZATION_GOAL_CONVERSIONS: '转化量', OPTIMIZATIONGOAL_PAGE_RESERVATION: '页面预约', ADGROUP_STATUS_ACTIVE: '投放中', ADGROUP_STATUS_NORMAL: '投放中', ADGROUP_STATUS_SUSPEND: '已暂停', ADGROUP_STATUS_CREATIVE_EMPTY: '缺少创意' } as Record<string, string>)[value]; if (exact) return exact; const words: Record<string, string> = { ACTIVE: '投放中', NORMAL: '正常', SUSPEND: '已暂停', PENDING: '待处理', DELETED: '已删除', UNKNOWN: '未知', LEAD: '线索', RETENTION: '留资', CONSUME: '消费', MEDICAL: '医疗', PAGE: '页面', RESERVATION: '预约', JUMP: '跳转', COMPONENT: '组件', CUSTOMIZE: '自定义', COMMON: '普通创意', PROGRAM: '动态创意' }; const translated = value.split('_').map((word) => words[word]).filter(Boolean); return translated.length ? translated.join('') : '腾讯平台状态'; }
function componentFieldLabel(value?: string) { const field = String(value || '').split('.').pop() || ''; return ({ image: '图片', image_list: '图片', video: '视频', video_list: '视频', title: '标题', description: '文案', main_jump_info: '落地页', brand: '品牌形象', wechat_channels: '品牌形象', action_button: '行动按钮', chosen_button: '行动按钮', mini_card_link: '图文链接', text_link: '文字链', floating_zone: '浮层卡片', floating_zone_list: '浮层卡片', label: '标签', social_skill: '首评回复' } as Record<string, string>)[field] || value || '未命名字段'; }
function requirementSummary(item: any) { const restriction = item.restriction || {}; const nested = Array.isArray(item.itemRules) ? item.itemRules.filter((rule: any) => Number(rule.min || rule.max || rule.width || rule.height)) : []; const details = [nested.length ? `每组 ${Number(item.itemMin || 0)}–${Number(item.itemMax || 0)} 张` : `数量 ${Number(item.min ?? 0)}–${Number(item.max ?? 1)}`]; const dimensions = [...new Set(nested.filter((rule: any) => rule.width && rule.height).map((rule: any) => `${rule.width}×${rule.height}`))]; if (dimensions.length) details.push(`尺寸 ${dimensions.join(' / ')}`); else if (restriction.width && restriction.height) details.push(`尺寸 ${restriction.width}×${restriction.height}`); if (restriction.file_size_kb_limit) details.push(`不超过 ${restriction.file_size_kb_limit} KB`); if (restriction.min_length || restriction.max_length) details.push(`字数 ${Number(restriction.min_length || 0)}–${Number(restriction.max_length || '不限')}`); return `${componentFieldLabel(item.path || item.name)} · ${details.join(' · ')}`; }
function formatSpend(value?: number | null) { return value == null ? '暂无归因' : `¥${Number(value).toFixed(2)}`; }
function taskStatusLabel(status: string) { return ({ PENDING: '等待处理', PROCESSING: '处理中', VALIDATING: '校验中', PREPARING_ASSETS: '准备素材', SUBMITTING: '提交中', PLATFORM_ACCEPTED: '平台已接受', VERIFYING: '回查中', PARTIAL_SUCCESS: '部分成功', SUCCEEDED: '成功', FAILED: '失败', UNKNOWN: '待确认', SKIPPED: '已跳过', CANCELLED: '已取消' } as Record<string, string>)[status] || status; }
function taskStatusType(status: string) { return ['SUCCEEDED'].includes(status) ? 'success' : ['FAILED', 'CANCELLED'].includes(status) ? 'danger' : ['UNKNOWN', 'PARTIAL_SUCCESS'].includes(status) ? 'warning' : 'info'; }
function formatTime(value: string) { return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)); }
onMounted(init); onUnmounted(stopPolling);
</script>

<style scoped>
.asset-select-button{min-width:54px;margin:0}
.linked-page-cell strong{overflow:visible;text-overflow:clip;white-space:normal;word-break:break-word;line-height:1.45}
.creative-page{padding-bottom:96px}.page-heading,.section-title,.panel-heading,.combination-heading,.selected-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.page-heading{margin-bottom:16px}.page-heading p,.section-title p,.panel-heading p{margin:5px 0 0;color:var(--admin-text-muted);line-height:1.55}.notice{margin-bottom:14px}.steps-panel{padding:18px;margin-bottom:14px;overflow:hidden}.wizard-panel{min-height:440px;padding:24px}.step-content{max-width:1280px;margin:auto;min-width:0}.step-content h2{margin:0 0 18px}.step-content :deep(.el-select),.step-content :deep(.el-input),.step-content :deep(.el-input-number){width:100%}.option-note{float:right;margin-left:20px;color:#909399}.section-title{margin-bottom:16px}.section-title h2,.panel-heading h3,.combination-heading h3,.selected-heading h3{margin:0}.section-title>.el-input{max-width:390px}.select-table-wrap{overflow:auto;border-radius:10px}.select-table-wrap small{display:block;color:#c45656;margin-top:4px}.mode-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:18px}.mode-grid label,.count-grid label,.manual-grid label{display:flex;min-width:0;flex-direction:column;gap:8px}.mode-grid span,.count-grid span{font-weight:600}.template-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.template-card{display:flex;min-width:0;gap:12px;padding:14px;border:1px solid var(--admin-border);border-radius:12px;background:#fff;text-align:left;cursor:pointer;transition:border-color .18s,box-shadow .18s,transform .18s}.template-card:hover{border-color:var(--admin-primary);transform:translateY(-1px)}.template-card.selected{border-color:var(--admin-primary);box-shadow:0 0 0 2px rgba(69,126,169,.15)}.template-card img{width:92px;height:72px;flex:none;object-fit:cover;border-radius:8px}.template-card div{display:flex;min-width:0;flex-direction:column;gap:5px}.template-card strong,.template-card span,.template-card small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.template-card span,.template-card small{color:var(--admin-text-muted)}.requirements,.combination-panel{margin-top:20px;padding:17px;border:1px solid var(--admin-border);border-radius:12px;background:#f8fbfd}.requirement-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.requirement-grid>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;padding:12px;border:1px solid #e7eff5;border-radius:9px;background:#fff}.requirement-grid>div.optional{background:#fbfcfd}.requirement-grid strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.requirement-grid span,.requirement-grid small{grid-column:1/-1;color:var(--admin-text-muted);font-size:12px;line-height:1.45}.requirement-grid .compatibility-note{color:#2f7d54;font-weight:600}.asset-controls{display:grid;grid-template-columns:minmax(220px,auto) minmax(130px,160px) minmax(120px,150px) minmax(140px,170px) minmax(100px,120px) minmax(220px,1fr);gap:10px;margin-bottom:14px}.asset-layout{display:grid;grid-template-columns:minmax(0,2.35fr) minmax(280px,.65fr);align-items:start;gap:14px}.asset-list-table{min-width:0}.asset-table-scroll{overflow:auto;border:1px solid var(--admin-border);border-radius:11px}.asset-list-table :deep(.el-table){min-width:1080px}.asset-list-table>.el-pagination{margin-top:12px;overflow-x:auto;padding-bottom:4px}.asset-content-cell{display:flex;min-width:0;flex-direction:column;gap:3px}.asset-content-cell strong,.asset-content-cell small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.asset-content-cell small,.block{color:var(--admin-text-muted)}.asset-error{color:#c45656;font-size:12px;line-height:1.45;overflow-wrap:anywhere}.asset-list-table :deep(.asset-row-selected td.el-table__cell){background:#edf7ff!important}.asset-list-table :deep(.asset-row-disabled){opacity:.62}.asset-mobile-list{display:none}.selected-assets{position:sticky;top:76px;max-height:590px;overflow:auto;padding:14px;border:1px solid var(--admin-border);border-radius:12px;background:#fbfdff}.selected-heading{align-items:center}.selected-heading h3{display:flex;align-items:center;gap:8px}.selected-help{margin:8px 0;color:var(--admin-text-muted);font-size:12px;line-height:1.55}.selected-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--admin-border)}.selected-row>div{display:flex;min-width:0;flex-direction:column;gap:3px}.selected-row strong,.selected-row small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.selected-row small{color:var(--admin-text-muted)}.count-grid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:12px;margin:16px 0}.name-tokens{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:9px}.name-tokens span,.name-tip{color:var(--admin-text-muted);font-size:12px}.name-tip{display:block;margin-top:7px}.manual-groups{display:grid;gap:10px}.manual-title,.manual-groups article header{display:flex;justify-content:space-between;align-items:center}.manual-groups article{padding:12px;background:#fff;border-radius:9px}.manual-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}.preview-list{margin-top:14px}.preview-chips,.preview-fields{display:flex;gap:7px;flex-wrap:wrap}.preview-chips span,.preview-fields span{max-width:100%;padding:5px 8px;border-radius:999px;background:#edf5fa;color:#315f81;font-size:12px;overflow-wrap:anywhere}.preview-fields{align-items:center;margin-top:10px}.wizard-actions{position:sticky;z-index:10;bottom:10px;display:flex;justify-content:flex-end;gap:10px;margin-top:16px;padding:13px 20px;border:1px solid var(--admin-border);border-radius:12px;background:rgba(255,255,255,.97);box-shadow:0 -6px 22px rgba(37,69,91,.1);backdrop-filter:blur(8px)}.task-summary{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}.task-summary>*{padding:7px 11px;border-radius:8px;background:#eef5fa}.error-copy{display:flex;min-width:0;flex-direction:column;gap:3px;overflow-wrap:anywhere}.error-copy strong{color:#c45656}.error-copy small{color:#a66a17}.result-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:14px}.records-toolbar{display:grid;grid-template-columns:180px minmax(220px,360px) auto;gap:10px;margin-bottom:14px}.records-panel>.el-pagination{margin-top:14px}.combination-tip{margin-top:12px}.publish-status-setting{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:14px 0;padding:13px 15px;border:1px solid var(--admin-border);border-radius:10px;background:#f8fbfd}.publish-status-setting>div{display:flex;flex-direction:column;gap:4px}.publish-status-setting small{color:var(--admin-text-muted)}
@media(max-width:1180px){.asset-controls{grid-template-columns:repeat(3,minmax(0,1fr))}.asset-controls>.el-input{grid-column:2/-1}.asset-layout{grid-template-columns:minmax(0,1fr) 290px}.requirement-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:900px){.wizard-panel{padding:18px}.template-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.asset-layout{grid-template-columns:1fr}.selected-assets{position:static;max-height:360px}.count-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.manual-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.creative-page{padding-bottom:122px}.page-heading,.section-title,.panel-heading{flex-direction:column;align-items:stretch}.page-heading :deep(.el-button),.section-title :deep(.el-button){width:100%;margin:0}.steps-panel{overflow-x:auto;padding:12px 8px}.steps-panel :deep(.el-steps){min-width:660px}.wizard-panel{padding:14px;border-radius:12px}.step-content h2{font-size:20px}.mode-grid,.template-grid,.requirement-grid,.asset-controls,.count-grid,.manual-grid{grid-template-columns:1fr}.asset-controls>.el-input{grid-column:auto}.asset-controls :deep(.el-radio-group),.mode-grid :deep(.el-radio-group){display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.asset-controls :deep(.el-radio-button),.asset-controls :deep(.el-radio-button__inner),.mode-grid :deep(.el-radio-button),.mode-grid :deep(.el-radio-button__inner){width:100%;min-width:0}.asset-table-scroll{display:none}.asset-mobile-list{display:grid;gap:10px}.asset-mobile-card{display:grid;gap:9px;padding:13px;border:1px solid var(--admin-border);border-radius:11px;background:#fff}.asset-mobile-card.selected{border-color:var(--admin-primary);background:#f1f8fd;box-shadow:0 0 0 1px rgba(69,126,169,.12)}.asset-mobile-card.disabled{opacity:.65}.asset-mobile-card header{display:flex;align-items:center;justify-content:space-between;gap:10px}.asset-mobile-card>strong,.asset-mobile-card>p{margin:0;overflow-wrap:anywhere}.asset-mobile-card>p{color:var(--admin-text-muted);font-size:12px}.asset-mobile-card dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 12px;margin:0}.asset-mobile-card dl>div{min-width:0}.asset-mobile-card dt{color:var(--admin-text-muted);font-size:11px}.asset-mobile-card dd{margin:2px 0 0;font-size:12px;overflow-wrap:anywhere}.asset-list-table>.el-pagination{justify-content:flex-start}.selected-assets{max-height:320px}.combination-panel,.requirements{padding:13px}.combination-heading{align-items:flex-start}.combination-heading :deep(.el-tag){flex:none}.publish-status-setting{align-items:stretch;flex-direction:column}.publish-status-setting :deep(.el-radio-group){display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.publish-status-setting :deep(.el-radio-button),.publish-status-setting :deep(.el-radio-button__inner){width:100%}.wizard-actions{bottom:max(8px,env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding:10px}.wizard-actions :deep(.el-button){width:100%;min-height:42px;margin:0;white-space:normal}.records-toolbar{grid-template-columns:1fr}.records-panel{overflow:auto}.records-panel :deep(.el-table){min-width:820px}.template-card img{width:70px;height:64px}.section-title>.el-input{max-width:none}.result-actions{display:grid;grid-template-columns:1fr}.result-actions :deep(.el-button){width:100%;min-height:42px;margin:0}.preview-chips span,.preview-fields span{border-radius:8px}.task-summary>*{flex:1 1 42%;text-align:center}}
@media(max-width:375px){.wizard-panel{padding:11px}.steps-panel :deep(.el-steps){min-width:610px}.asset-mobile-card dl{grid-template-columns:1fr}.wizard-actions{grid-template-columns:1fr}.task-summary>*{flex-basis:100%}.name-tokens :deep(.el-button){flex:1 1 42%;margin:0}.template-card{padding:11px}.template-card img{width:58px;height:58px}}
</style>
