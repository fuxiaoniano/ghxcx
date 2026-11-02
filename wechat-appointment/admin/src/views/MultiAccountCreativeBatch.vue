<template>
  <section class="multi-creative-page">
    <div class="page-heading"><div><h1 class="page-title">批量新建</h1><p>多个账户 × 多个营销单元 × 多个素材组合；腾讯返回创意 ID 后仍需二次回查确认。</p></div><div class="page-heading-actions"><el-button v-if="activeView === 'records' && canCreate" type="primary" :disabled="submitting || preflighting" @click="startNextTask">新建下一个任务</el-button><el-button v-if="canCreate || activeView === 'create'" @click="activeView = activeView === 'records' ? 'create' : 'records'; activeView === 'records' && loadTasks()">{{ activeView === 'records' ? '返回创建' : '任务记录' }}</el-button></div></div>
    <el-alert type="warning" show-icon :closable="false" title="确认提交后将使用系统现有腾讯授权真实创建广告创意；Token 和 User Token 始终只在服务端使用。" />

    <template v-if="activeView === 'create'">
      <div class="panel steps"><el-steps :active="step" finish-status="success" align-center><el-step title="选择素材" /><el-step title="账户与营销单元" /><el-step title="规格与规则" /><el-step title="预检确认" /></el-steps></div>
      <div class="panel" v-loading="loading">
        <div v-if="step === 0">
          <h2>选择图片或视频及文案素材</h2><p class="muted">图片和视频至少选择一种，文案至少选择一项；具体数量以所选腾讯创意规格为准。</p>
          <div class="toolbar" :class="{ 'toolbar--no-dimensions': !['IMAGE', 'VIDEO'].includes(assetType) }"><el-select v-model="sourceAccountId" filterable placeholder="素材来源账户" @change="sourceChanged"><el-option v-for="item in options?.accounts || []" :key="item.id" :value="item.id" :label="`${item.name} · ${item.accountNo}`" /></el-select><el-radio-group v-model="assetSource" @change="assetFilterChanged"><el-radio-button value="ACCOUNT">账户资产</el-radio-button><el-radio-button value="BUSINESS_UNIT">腾讯业务单元资产</el-radio-button></el-radio-group><el-select v-model="assetType" @change="assetTypeChanged"><el-option label="视频" value="VIDEO" /><el-option label="图片" value="IMAGE" /><el-option label="文案" value="COPY" /></el-select><el-select v-if="['IMAGE', 'VIDEO'].includes(assetType)" v-model="assetDimensions" clearable placeholder="全部尺寸" @change="assetFilterChanged"><el-option v-if="assetType === 'IMAGE'" label="九图组件" value="NINE_IMAGE" /><el-option v-for="item in availableDimensions" :key="item" :value="item" :label="item" /></el-select><el-select v-model="assetSortBy" @change="assetFilterChanged"><el-option label="按创建时间" value="CREATED_TIME" /><el-option label="按名称" value="NAME" /><el-option label="按近7天消费" value="SPEND_7_DAYS" /><el-option label="按近15天消费" value="SPEND_15_DAYS" /><el-option label="按实际转化成本（近7天）" value="ACTUAL_CPA" /><el-option label="按状态" value="STATUS" /></el-select><el-select v-model="assetSortOrder" @change="assetFilterChanged"><el-option label="降序" value="DESC" /><el-option label="升序" value="ASC" /></el-select><el-input v-model="assetSearch" clearable placeholder="搜索名称或素材 ID" @keyup.enter="assetSearchSubmit"><template #append><el-button @click="assetSearchSubmit">查询</el-button></template></el-input></div>
          <div class="table-scroll"><el-table v-loading="assetLoading" :data="assets" stripe @row-click="toggleAsset" @sort-change="assetTableSortChanged"><el-table-column label="序号" width="70"><template #default="{ $index }">{{ (assetPage - 1) * 20 + $index + 1 }}</template></el-table-column><el-table-column width="122"><template #header><el-checkbox class="asset-select-all" :model-value="allUsablePageSelected" :disabled="assetLoading || !assets.some((item)=>item.usable)" @change="toggleAssetPage">全选本页</el-checkbox></template><template #default="{ row }"><el-checkbox :model-value="selectedIds.has(row.id)" :disabled="!row.usable" @click.stop @change="toggleAsset(row)" /></template></el-table-column><el-table-column label="预览" width="92"><template #default="{ row }"><el-image v-if="row.previewUrl && row.type === 'IMAGE'" class="asset-preview" :src="row.previewUrl" :preview-src-list="[row.previewUrl]" preview-teleported fit="cover" @click.stop /><a v-else-if="row.previewUrl" :href="row.previewUrl" target="_blank" rel="noopener" @click.stop>打开预览</a><span v-else class="muted">暂无</span></template></el-table-column><el-table-column prop="name" label="素材内容" width="210" sortable="custom"><template #default="{ row }"><strong>{{ row.contentSummary || row.name }}</strong><small class="block">{{ row.name }}</small></template></el-table-column><el-table-column v-if="['TEXT_LINK', 'ACTION_BUTTON', 'MINI_CARD_LINK'].includes(assetType)" label="关联落地页" min-width="280"><template #default="{ row }"><div v-if="row.linkedLandingPage" class="linked-page-cell"><strong :title="row.linkedLandingPage.name">{{ row.linkedLandingPage.name }}</strong><small class="block">page_id：{{ row.linkedLandingPage.pageId }}</small></div><span v-else class="asset-error">未关联落地页</span></template></el-table-column><el-table-column label="类型" width="90"><template #default="{ row }">{{ assetLabel(row.type,row) }}</template></el-table-column><el-table-column prop="platformAssetId" label="腾讯素材 ID" min-width="140" /><el-table-column prop="dimensions" label="规格" width="120" /><el-table-column prop="spend7Days" label="近7天消费" width="124" sortable="custom"><template #default="{ row }">{{ formatSpend(row.spend7Days) }}</template></el-table-column><el-table-column prop="spend15Days" label="近15天消费" width="132" sortable="custom"><template #default="{ row }">{{ formatSpend(row.spend15Days) }}</template></el-table-column><el-table-column prop="actualCpa7Days" label="实际转化成本（近7天）" width="174" sortable="custom"><template #default="{ row }">{{ formatSpend(row.actualCpa7Days) }}</template></el-table-column><el-table-column prop="createdTime" label="创建时间" width="172" sortable="custom"><template #default="{ row }">{{ row.createdTime ? formatTime(row.createdTime) : '—' }}</template></el-table-column><el-table-column prop="status" label="状态" width="120" sortable="custom"><template #default="{ row }"><el-tag :type="row.usable ? 'success' : 'danger'">{{ row.usable ? '可预检' : '不可用' }}</el-tag></template></el-table-column></el-table></div>
          <el-pagination v-model:current-page="assetPage" :page-size="20" :total="assetTotal" layout="prev,pager,next" @current-change="loadAssets" />
          <div class="selected-strip"><strong>已选 {{ selectedAssets.length }} 项：</strong><el-tag v-for="item in selectedAssets" :key="item.id" closable @close="removeAsset(item.id)">{{ assetLabel(item.type,item) }} · {{ item.contentSummary || item.name }}</el-tag></div>
        </div>

        <div v-else-if="step === 1">
          <h2>选择目标账户和营销单元</h2><p class="muted">只展示当前成员数据范围内且已有腾讯授权的账户；每个账户可选择多个营销单元。</p>
          <el-input v-model="targetSearch" clearable placeholder="搜索账户、户号或营销单元" class="target-search" />
          <el-collapse class="account-tree">
            <el-collapse-item v-for="account in filteredAccounts" :key="account.id" :name="account.id"><template #title><div class="account-title"><el-checkbox :model-value="selectedAccountIds.has(account.id)" :disabled="!account.canCreate" @click.stop @change="toggleAccount(account)" /><strong>{{ account.name }}</strong><span>{{ account.accountNo }} · {{ account.project }}</span><el-tag :type="account.canCreate ? 'success' : 'danger'">{{ account.canCreate ? '授权有效' : '不可创建' }}</el-tag></div></template><el-button size="small" :loading="adgroupLoading.has(account.id)" @click="refreshAdgroups(account)">刷新营销单元</el-button><div class="adgroup-list"><label v-for="group in filteredAdgroups(account.id)" :key="group.id"><el-checkbox :model-value="selectedAdgroupKeys.has(targetKey(account.id, group.id))" :disabled="!group.canCreate" @change="toggleAdgroup(account.id, group)" /><span><strong>{{ group.name }}</strong><small>{{ group.id }} · {{ adgroupStatusLabel(group.systemStatus || group.configuredStatus) }}</small></span><em v-if="!group.canCreate">{{ group.unavailableReason }}</em></label></div></el-collapse-item>
          </el-collapse>
        </div>

        <div v-else-if="step === 2">
          <h2>创意规格与生成规则</h2>
          <div class="mode-grid"><label>投放模式<el-select v-model="form.deliveryMode" @change="clearTemplates"><el-option label="组件化" value="DELIVERY_MODE_COMPONENT" /><el-option label="自定义" value="DELIVERY_MODE_CUSTOMIZE" /></el-select></label><label>创意类型<el-select v-model="form.creativeType" @change="clearTemplates"><el-option label="普通创意" value="DYNAMIC_CREATIVE_TYPE_COMMON" /><el-option label="动态创意" value="DYNAMIC_CREATIVE_TYPE_PROGRAM" /></el-select></label><label>组合方式<el-select v-model="form.combinationMode"><el-option label="按顺序配对" value="SEQUENTIAL" /><el-option label="限量随机组合" value="RANDOM_LIMITED" /><el-option label="笛卡尔组合" value="CARTESIAN" /></el-select></label></div>
          <div class="batch-template-toolbar"><div><strong>批量设置创意规格</strong><small>以首个营销单元的可选规格为候选；逐个向腾讯验证，未通过的目标保留原规格。</small></div><el-select v-model="batchTemplateId" filterable clearable placeholder="选择要批量应用的规格" @visible-change="(open:boolean) => open && selectedTargets[0] && loadTemplates(selectedTargets[0])"><el-option v-for="item in batchTemplateOptions" :key="item.id" :value="item.id" :label="`${item.name} · ${item.id}`" /></el-select><el-button type="primary" plain :loading="batchApplyingTemplates" :disabled="!batchTemplateId || !selectedTargets.length" @click="applyBatchTemplate">批量应用</el-button></div>
          <div class="table-scroll"><el-table :data="selectedTargets" stripe><el-table-column label="账户" min-width="150"><template #default="{ row }">{{ accountById(row.accountId)?.name }}</template></el-table-column><el-table-column prop="adgroup.name" label="营销单元" min-width="190" /><el-table-column label="腾讯创意规格" min-width="260"><template #default="{ row }"><el-select v-model="row.templateId" filterable placeholder="请选择兼容规格" @change="templateChanged(row)" @visible-change="(open:boolean) => open && loadTemplates(row)"><el-option v-for="item in templateMap[targetKey(row.accountId,row.adgroup.id)] || []" :key="item.id" :value="item.id" :label="`${item.name} · ${item.id}`" /></el-select></template></el-table-column><el-table-column v-if="canManageDefaults" label="组件覆盖" width="150"><template #default="{ row }"><el-button link type="primary" @click="openOverrides(row)">{{ row.componentOverrides?.length ? `已覆盖 ${row.componentOverrides.length} 项` : '覆盖默认组件' }}</el-button></template></el-table-column></el-table></div>
          <section class="default-components">
            <div class="default-heading">
              <div><h3>账户默认组件</h3><p class="muted">按账户和营销单元展示全部适用配置；同一类型只使用当前开启的一项。</p></div>
              <el-button size="small" @click="loadDefaultComponents(true)">刷新组件</el-button>
            </div>
            <section v-for="target in selectedTargets" :key="targetKey(target.accountId,target.adgroup.id)" class="default-target">
              <div class="default-target-heading"><strong>{{ accountById(target.accountId)?.name }} · {{ target.adgroup.name }}</strong><small>已启用 {{ defaultChoices(target).filter((item) => defaultSupported(target,item.componentType) && activeDefaultId(target,item.componentType) === item.id).length }} 项</small></div>
              <div v-if="defaultChoices(target).length" class="default-switches">
                <div v-for="item in defaultChoices(target)" :key="item.id" class="default-switch">
                  <div class="default-info"><span class="default-type">{{ componentLabel(item.componentType) }}</span><strong :title="item.componentName">{{ item.componentName }}</strong><small>{{ item.platformComponentId }}</small><small v-if="!defaultSupported(target,item.componentType)" class="default-unavailable">{{ target.templateId ? (templateLoading.has(targetKey(target.accountId,target.adgroup.id)) ? '正在读取创意规格…' : '当前规格不支持自动带入') : '请先选择创意规格' }}</small></div>
                  <el-switch :model-value="defaultSupported(target,item.componentType) && activeDefaultId(target,item.componentType) === item.id" :disabled="!defaultSupported(target,item.componentType) || (!canManageDefaults && activeDefaultId(target,item.componentType) !== item.id)" :aria-label="`使用${componentLabel(item.componentType)}：${item.componentName}`" @change="(enabled:boolean) => toggleDefault(target,item,enabled)" />
                </div>
              </div>
              <p v-else class="muted">{{ defaultLoading.has(target.accountId) ? '正在获取默认组件…' : '此账户暂无适用的已启用默认组件，请检查账户配置并预检。' }}</p>
            </section>
          </section>
          <div class="rules-grid"><label>每条标题数<el-input-number v-model="form.rules.titleCount" :min="1" :max="Math.max(1, selectedAssets.filter(item => item.type === 'TITLE' || ['title', 'description'].includes(String(item.componentField || ''))).length)" /></label><label v-if="selectedAssets.some(item => item.type === 'VIDEO')">每条视频数<el-input-number v-model="form.rules.videoCount" :min="0" :max="selectedAssets.filter(item => item.type === 'VIDEO').length" /></label><label v-if="selectedAssets.some(item => item.type === 'IMAGE')">每条图片数<el-input-number v-model="form.rules.imageCount" :min="0" :max="Math.min(imageCountMax, selectedAssets.filter(item => item.type === 'IMAGE').length)" /><small>已选图片可分配到多条创意；单条数量以所选腾讯规格为准。</small></label><label>单营销单元上限<el-input-number v-model="form.rules.maxPerAdgroup" :min="1" :max="50" /></label><label>单账户上限<el-input-number v-model="form.rules.maxPerAccount" :min="1" :max="200" /></label><label>单次任务上限<el-input-number v-model="form.rules.maxTotal" :min="1" :max="500" /></label></div>
          <p class="muted" aria-live="polite">当前设置：每条创意 {{ form.rules.titleCount }} 条标题、{{ form.rules.videoCount }} 条视频、{{ form.rules.imageCount }} 张图片；每个营销单元预计 {{ localCreativeCount }} 条。{{ !form.rules.allowMaterialReuse ? '素材不复用时，数量受最少的素材类型限制。' : '' }}最终数量以腾讯规格和预检结果为准。</p>
          <el-form label-position="top"><el-form-item label="创意命名规则"><el-input v-model="form.namePattern" maxlength="120" /><div class="name-tokens"><span>点击插入：</span><el-button v-for="token in nameTokens" :key="token" size="small" plain @click="insertNameToken(token)">{{ token }}</el-button></div><small>通配符之间默认使用“+”分隔。</small></el-form-item><el-form-item><el-checkbox v-model="form.rules.allowMaterialReuse">允许素材重复参与不同组合</el-checkbox></el-form-item></el-form>
        </div>

        <div v-else>
          <div class="preflight-heading"><div><h2>预检矩阵与最终确认</h2><p class="muted">每个账户 × 营销单元独立校验 Token、权限、规格、素材映射和默认组件。</p></div><el-button type="primary" plain :loading="preflighting" @click="runPreflight">重新预检</el-button></div>
          <div v-if="preflight" class="summary-grid"><div><strong>{{ preflight.accountCount }}</strong><span>目标账户</span></div><div><strong>{{ preflight.adgroupCount }}</strong><span>营销单元</span></div><div><strong>{{ preflight.estimatedCreativeCount }}</strong><span>预计创意</span></div><div><strong>{{ preflight.failedCount }}</strong><span>阻断目标</span></div></div>
          <div class="table-scroll"><el-table :data="preflight?.targets || []" stripe><el-table-column label="账户/营销单元" min-width="210"><template #default="{ row }"><strong>{{ row.account.name }}</strong><small class="block">{{ row.adgroup.name }} · {{ row.adgroup.id }}</small></template></el-table-column><el-table-column label="规格" min-width="180"><template #default="{ row }">{{ row.template.name || row.template.id }}</template></el-table-column><el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="row.status === 'PASSED' ? 'success' : 'danger'">{{ row.status === 'PASSED' ? '通过' : '阻断' }}</el-tag></template></el-table-column><el-table-column label="创意数" width="90" prop="creativeCount" /><el-table-column label="素材映射与默认组件" min-width="300"><template #default="{ row }"><div class="matrix-details"><span v-for="item in row.mappings" :key="item.assetId" :class="item.status === 'AVAILABLE' || item.status === 'AUTHORIZED' ? 'ok' : 'bad'">{{ item.name }}：{{ mappingLabel(item.status) }}</span><span v-for="item in row.defaultComponents" :key="item.type" class="ok">{{ componentLabel(item.type) }}：{{ item.name }}</span><b v-for="reason in row.reasons" :key="reason">{{ reason }}</b></div></template></el-table-column></el-table></div>
          <el-checkbox v-model="form.allowSkipInvalid" :disabled="!preflight?.failedCount">跳过不合格目标，继续创建合格目标（默认关闭）</el-checkbox>
          <el-alert v-if="form.allowSkipInvalid && preflight?.failedCount" type="warning" :closable="false" title="已启用跳过：提交时将再次预检，并明确跳过当前不合格目标。" />
        </div>
      </div>
      <div class="wizard-actions"><el-button v-if="step > 0" @click="step--">上一步</el-button><el-button v-if="step < 2" type="primary" @click="next">下一步</el-button><el-button v-else-if="step === 2" type="primary" :loading="preflighting" @click="runPreflight">进入预检</el-button><el-button v-else type="danger" :disabled="!preflight || (!form.allowSkipInvalid && !!preflight.failedCount)" :loading="submitting" @click="submit">确认并真实提交腾讯</el-button></div>
    </template>

    <div v-else class="panel">
      <div class="records-toolbar"><el-select v-model="taskFilter.status" clearable placeholder="全部状态"><el-option v-for="status in taskStatuses" :key="status" :value="status" :label="statusLabel(status)" /></el-select><el-select v-model="taskFilter.accountId" clearable filterable placeholder="全部账户"><el-option v-for="item in options?.accounts || []" :key="item.id" :value="item.id" :label="`${item.name} · ${item.accountNo}`" /></el-select><el-input v-model="taskFilter.adgroupId" clearable placeholder="营销单元 ID" /><el-input v-model="taskFilter.createdByAdminId" clearable placeholder="创建人成员 ID" /><el-date-picker v-model="taskFilter.dateRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" /><el-button type="primary" @click="taskFilter.page=1;loadTasks()">查询</el-button></div>
      <div class="table-scroll"><el-table :data="tasks" stripe @row-click="openTask"><el-table-column prop="taskNo" label="任务编号" min-width="180" /><el-table-column prop="createdAt" label="创建时间" width="170"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column><el-table-column label="范围" width="170"><template #default="{ row }">{{ row.totalAccountCount }} 账户 · {{ row.totalAdgroupCount }} 营销单元</template></el-table-column><el-table-column label="状态" width="140"><template #default="{ row }"><el-tag>{{ statusLabel(row.status) }}</el-tag></template></el-table-column><el-table-column label="结果" min-width="250"><template #default="{ row }">确认 {{ row.confirmedCount }}/{{ row.totalCreativeCount }} · 失败 {{ row.failedCount }} · 待核验 {{ row.pendingVerifyCount }} · 跳过 {{ row.skippedCount }}</template></el-table-column><el-table-column label="操作" width="100"><template #default="{ row }"><el-button link type="primary" @click.stop="openTask(row)">详情</el-button></template></el-table-column></el-table></div>
      <el-pagination v-model:current-page="taskFilter.page" :page-size="20" :total="taskTotal" layout="prev,pager,next" @current-change="loadTasks" />
      <el-drawer v-model="detailOpen" title="多账户创意任务详情" size="min(980px, 100%)"><template v-if="currentTask"><el-descriptions :column="2" border><el-descriptions-item label="任务编号">{{ currentTask.taskNo }}</el-descriptions-item><el-descriptions-item label="状态">{{ statusLabel(currentTask.status) }}</el-descriptions-item></el-descriptions><div v-for="target in currentTask.targets || []" :key="target.id" class="target-result"><h3>{{ target.account.name }} · {{ target.adgroupName || target.adgroupId }}</h3><div class="table-scroll"><el-table :data="target.items"><el-table-column prop="sequence" label="#" width="54" /><el-table-column prop="creativeName" label="创意名称" min-width="220" /><el-table-column label="状态" width="140"><template #default="{ row }">{{ statusLabel(row.status) }}</template></el-table-column><el-table-column prop="platformCreativeId" label="腾讯创意 ID" min-width="150" /><el-table-column label="错误" min-width="220"><template #default="{ row }">{{ row.errorCode }} {{ row.errorMessage }}</template></el-table-column></el-table></div></div><div class="drawer-actions"><el-button v-if="canRetry" @click="retryTask">安全重试/回查</el-button><el-button v-if="canCancel" type="danger" plain @click="cancelTask">取消未开始项</el-button><el-button v-if="canExport" @click="exportTask">导出结果</el-button></div></template></el-drawer>
    </div>
    <el-dialog v-model="overrideDialog" title="为单个目标覆盖默认组件" width="min(720px,94vw)"><p class="muted">覆盖只作用于当前账户与营销单元，并在提交前重新向腾讯验证。</p><el-form label-position="top"><el-form-item label="选择组件配置"><el-select v-model="overrideSelectionIds" multiple filterable style="width:100%"><el-option v-for="item in overrideRows" :key="item.id" :value="item.id" :label="`${item.componentType} · ${item.componentName} · ${item.platformComponentId}`" /></el-select></el-form-item><el-form-item label="覆盖原因" required><el-input v-model="overrideReason" type="textarea" maxlength="500" show-word-limit /></el-form-item></el-form><template #footer><el-button @click="overrideDialog=false">取消</el-button><el-button type="primary" @click="saveOverrides">应用覆盖</el-button></template></el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAuthStore } from '../stores/auth';
import {
  cancelMultiAccountCreativeBatch, createMultiAccountCreativeBatch, exportMultiAccountCreativeBatch,
  getCreativeDefaultComponents,
  getPromotionCreativeTemplateDetail,
  getMultiAccountCreativeAdgroups, getMultiAccountCreativeAssets, getMultiAccountCreativeOptions,
  getMultiAccountCreativeTask, getMultiAccountCreativeTasks, getMultiAccountCreativeTemplates,
  preflightMultiAccountCreativeBatch, retryMultiAccountCreativeBatch,
  type MultiAccountCreativePayload, type MultiAccountCreativePreflight, type MultiAccountCreativeTask,
  type PromotionCreativeAdgroup, type PromotionCreativeAsset, type PromotionCreativeBatchOptions, type PromotionCreativeTemplate,
} from '../api/admin';

const auth = useAuthStore(); const activeView = ref<'create'|'records'>('create'); const step = ref(0); const loading = ref(false); const assetLoading = ref(false); const preflighting = ref(false); const submitting = ref(false);
const options = ref<PromotionCreativeBatchOptions | null>(null); const sourceAccountId = ref(''); const assetSource = ref<'ACCOUNT'|'BUSINESS_UNIT'>('ACCOUNT'); const assetType = ref('VIDEO'); const assetDimensions = ref(''); const availableDimensions = ref<string[]>([]); const assetSearch = ref(''); const assetSortBy = ref('CREATED_TIME'); const assetSortOrder = ref<'ASC'|'DESC'>('DESC'); const assetPage = ref(1); const assetTotal = ref(0); const assets = ref<PromotionCreativeAsset[]>([]); const selectedAssets = ref<PromotionCreativeAsset[]>([]);
type SelectedTarget = { accountId:string; adgroup:PromotionCreativeAdgroup; templateId:string; componentOverrides?:Array<{componentType:string;configId:string}>; overrideReason?:string; disabledDefaultComponentTypes?:string[] };
type DefaultComponentRow = { id:string; componentType:string; componentName:string; platformComponentId:string; status:string; templateId?:string|null; creativeType?:string|null; marketingGoal?:string|null; priority?:number };
const selectedIds = computed(() => new Set(selectedAssets.value.map((item) => item.id))); const allUsablePageSelected = computed(() => assets.value.some((item)=>item.usable) && assets.value.filter((item)=>item.usable).every((item)=>selectedIds.value.has(item.id))); const selectedAccountIds = ref(new Set<string>()); const adgroupMap = reactive<Record<string, PromotionCreativeAdgroup[]>>({}); const adgroupLoading = ref(new Set<string>()); const selectedAdgroupKeys = ref(new Set<string>()); const selectedTargets = ref<SelectedTarget[]>([]); const templateMap = reactive<Record<string, PromotionCreativeTemplate[]>>({}); const targetSearch = ref('');
const overrideDialog=ref(false),overrideTarget=ref<SelectedTarget|null>(null),overrideRows=ref<DefaultComponentRow[]>([]),overrideSelectionIds=ref<string[]>([]),overrideReason=ref('');
const defaultComponentMap=reactive<Record<string,DefaultComponentRow[]>>({});const defaultLoading=ref(new Set<string>());const templateFields=reactive<Record<string,string[]>>({});const templateImageCaps=reactive<Record<string,number>>({});const templateLoading=ref(new Set<string>());const batchTemplateId=ref('');const batchApplyingTemplates=ref(false);
const imageCountMax=computed(()=>Math.min(20,...selectedTargets.value.map((target)=>templateImageCaps[targetKey(target.accountId,target.adgroup.id)]||20)));
const batchTemplateOptions=computed(()=>selectedTargets.value[0]?templateMap[targetKey(selectedTargets.value[0].accountId,selectedTargets.value[0].adgroup.id)]||[]:[]);
const newTaskForm = (): MultiAccountCreativePayload => ({ assetSnapshotIds: [], targets: [], deliveryMode: 'DELIVERY_MODE_COMPONENT', creativeType: 'DYNAMIC_CREATIVE_TYPE_COMMON', combinationMode: 'SEQUENTIAL', namePattern: '{营销单元}+{日期}+{标题}+{视频}+{图片}+{序号}', rules: { titleCount: 1, videoCount: 1, imageCount: 0, maxPerAdgroup: 20, maxPerAccount: 100, maxTotal: 200, allowMaterialReuse: true, randomLimit: 20 }, allowSkipInvalid: false, configuredStatus: 'AD_STATUS_NORMAL' });
const preflight = ref<MultiAccountCreativePreflight | null>(null); const form = reactive<MultiAccountCreativePayload>(newTaskForm());
const localCreativeCount = computed(() => {
  const groups = {
    titles: selectedAssets.value.filter((item) => item.type === 'TITLE' || ['title', 'description'].includes(String(item.componentField || ''))).map((item) => item.id),
    videos: selectedAssets.value.filter((item) => item.type === 'VIDEO').map((item) => item.id),
    images: selectedAssets.value.filter((item) => item.type === 'IMAGE').map((item) => item.id),
  };
  const counts = [form.rules.titleCount, form.rules.videoCount, form.rules.imageCount];
  const values = [groups.titles, groups.videos, groups.images];
  if (!counts[0] || (!counts[1] && !counts[2]) || values.some((items, index) => items.length < counts[index])) return 0;
  const limit = form.rules.maxPerAdgroup;
  if (form.combinationMode === 'RANDOM_LIMITED') return Math.min(form.rules.randomLimit || limit, limit);
  if (form.combinationMode === 'CARTESIAN') {
    const chooseCount = (length: number, count: number) => {
      let result = 1;
      for (let index = 1; index <= count; index += 1) result = result * (length - index + 1) / index;
      return Math.round(result);
    };
    return values.reduce((total, items, index) => total * chooseCount(items.length, counts[index]), 1);
  }
  const sizes = values.map((items, index) => counts[index] ? Math.ceil(items.length / counts[index]) : 1);
  const count = Math.min(form.rules.allowMaterialReuse ? Math.max(...sizes) : Math.min(...sizes), limit);
  const seen = new Set<string>();
  for (let offset = 0; offset < count; offset += 1) {
    seen.add(JSON.stringify(values.map((items, index) => Array.from({ length: counts[index] }, (_, item) => items[(offset * counts[index] + item) % items.length]))));
  }
  return seen.size;
});
const canCreate = computed(() => auth.hasPermission('PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CREATE'));
async function startNextTask() {
  if (!canCreate.value || submitting.value || preflighting.value) return;
  selectedAssets.value = []; selectedAccountIds.value = new Set(); selectedAdgroupKeys.value = new Set(); selectedTargets.value = [];
  preflight.value = null; currentTask.value = null; detailOpen.value = false;
  overrideDialog.value = false; overrideTarget.value = null; overrideRows.value = []; overrideSelectionIds.value = []; overrideReason.value = '';
  batchTemplateId.value = ''; targetSearch.value = ''; Object.assign(form, newTaskForm());
  assetSearch.value = ''; assetDimensions.value = ''; assetType.value = 'VIDEO'; assetPage.value = 1;
  step.value = 0; activeView.value = 'create'; await loadAssets();
}
const nameTokens=['{营销单元}','{账户}','{规格}','{日期}','{标题}','{视频}','{图片}','{序号}'];
const tasks = ref<MultiAccountCreativeTask[]>([]); const taskTotal = ref(0); const taskFilter = reactive({ status: '', accountId:'', adgroupId:'', createdByAdminId:'', dateRange:[] as string[], page: 1 }); const currentTask = ref<MultiAccountCreativeTask | null>(null); const detailOpen = ref(false);
const canRetry = computed(() => auth.hasPermission('PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_RETRY')); const canCancel = computed(() => auth.hasPermission('PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CANCEL')); const canExport = computed(() => auth.hasPermission('PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_RESULT_EXPORT'));
const canManageDefaults = computed(() => auth.hasPermission('PROMOTION_CREATIVE_DEFAULT_COMPONENT_MANAGE'));
const targetKey = (accountId:string, adgroupId:string) => `${accountId}:${adgroupId}`; const accountById = (id:string) => options.value?.accounts.find((item) => item.id === id); const filteredAccounts = computed(() => (options.value?.accounts || []).filter((item) => !targetSearch.value || `${item.name} ${item.accountNo} ${item.project}`.toLowerCase().includes(targetSearch.value.toLowerCase()) || filteredAdgroups(item.id).length));
function filteredAdgroups(accountId:string) { const value = targetSearch.value.toLowerCase(); return (adgroupMap[accountId] || []).filter((item) => !value || `${item.name} ${item.id}`.toLowerCase().includes(value)); }
async function init(){ loading.value=true; try { options.value=await getMultiAccountCreativeOptions(); sourceAccountId.value=options.value.accounts.find((item)=>item.canCreate)?.id || ''; if(!canCreate.value){activeView.value='records';await loadTasks();}else if(sourceAccountId.value) await loadAssets(); } finally { loading.value=false; } }
async function sourceChanged(){ selectedAssets.value=[]; syncMediaRules(); preflight.value=null; assetDimensions.value=''; availableDimensions.value=[]; assetPage.value=1; await loadAssets(); }
async function assetFilterChanged(){ assetPage.value=1; await loadAssets(); }
async function assetTypeChanged(){ assetDimensions.value=''; availableDimensions.value=[]; await assetFilterChanged(); }
async function assetSearchSubmit(){ assetPage.value=1; await loadAssets(); }
async function loadAssets(){ if(!sourceAccountId.value)return; assetLoading.value=true; try { const result=await getMultiAccountCreativeAssets({ accountId:sourceAccountId.value, source:assetSource.value, businessUnitKey:accountById(sourceAccountId.value)?.tencentBusinessUnitKey, assetType:assetType.value==='IMAGE'&&assetDimensions.value==='NINE_IMAGE'?'NINE_IMAGE':assetType.value, dimensions:['IMAGE','VIDEO'].includes(assetType.value)&&assetDimensions.value!=='NINE_IMAGE'?assetDimensions.value||undefined:undefined, search:assetSearch.value||undefined, sortBy:assetSortBy.value, sortOrder:assetSortOrder.value, page:assetPage.value, pageSize:20 }); assets.value=result.list; assetTotal.value=result.pageInfo.totalNumber; if(assetDimensions.value!=='NINE_IMAGE')availableDimensions.value=result.availableDimensions||[]; if(assetDimensions.value&&assetDimensions.value!=='NINE_IMAGE'&&!availableDimensions.value.includes(assetDimensions.value))assetDimensions.value=''; } finally { assetLoading.value=false; } }
async function assetTableSortChanged({ prop, order }:{prop:string;order:'ascending'|'descending'|null}){ if(!order)return; assetSortBy.value=prop==='spend7Days'?'SPEND_7_DAYS':prop==='spend15Days'?'SPEND_15_DAYS':prop==='actualCpa7Days'?'ACTUAL_CPA':prop==='name'?'NAME':prop==='status'?'STATUS':'CREATED_TIME'; assetSortOrder.value=order==='ascending'?'ASC':'DESC'; assetPage.value=1; await loadAssets(); }
function syncMediaRules(){const videos=selectedAssets.value.filter((item)=>item.type==='VIDEO').length;const images=selectedAssets.value.filter((item)=>item.type==='IMAGE').length;form.rules.videoCount=videos?Math.max(1,Math.min(form.rules.videoCount,videos)):0;form.rules.imageCount=images?Math.max(1,Math.min(form.rules.imageCount,images)):0;}
function toggleAsset(item:PromotionCreativeAsset){ if(!item.usable)return; selectedAssets.value=selectedIds.value.has(item.id)?selectedAssets.value.filter((row)=>row.id!==item.id):[...selectedAssets.value,item];syncMediaRules();preflight.value=null; }
function removeAsset(id:string){selectedAssets.value=selectedAssets.value.filter((item)=>item.id!==id);syncMediaRules();preflight.value=null;}
function toggleAssetPage(){const selectable=assets.value.filter((item)=>item.usable);if(!selectable.length)return;const pageIds=new Set(selectable.map((item)=>item.id));selectedAssets.value=allUsablePageSelected.value?selectedAssets.value.filter((item)=>!pageIds.has(item.id)):[...selectedAssets.value,...selectable.filter((item)=>!selectedIds.value.has(item.id))];syncMediaRules();preflight.value=null;}
function insertNameToken(token:string){const current=form.namePattern.trimEnd();const separator=current&&!current.endsWith('+')?'+':'';form.namePattern=`${current}${separator}${token}`.slice(0,120);}
async function toggleAccount(account:any){
  const next=new Set(selectedAccountIds.value);
  if(next.has(account.id)){
    next.delete(account.id);
    selectedTargets.value=selectedTargets.value.filter((row)=>row.accountId!==account.id);
    selectedAdgroupKeys.value=new Set([...selectedAdgroupKeys.value].filter((key)=>!key.startsWith(`${account.id}:`)));
  }else{
    try{
      const groups=await loadAdgroups(account);
      const usable=groups.filter((group)=>group.canCreate);
      if(!usable.length)return ElMessage.warning('该账户没有可创建创意的营销单元');
      next.add(account.id);
      const keys=new Set(selectedAdgroupKeys.value);
      for(const group of usable){
        const key=targetKey(account.id,group.id);
        if(keys.has(key))continue;
        keys.add(key);
        selectedTargets.value.push({accountId:account.id,adgroup:group,templateId:''});
      }
      selectedAdgroupKeys.value=keys;
    }catch{return ElMessage.error('营销单元未能完整加载，请重试选择账户');}
  }
  selectedAccountIds.value=next;
  preflight.value=null;
}
async function loadAdgroups(account:any){
  const loadingSet=new Set(adgroupLoading.value);loadingSet.add(account.id);adgroupLoading.value=loadingSet;
  try{
    const first=await getMultiAccountCreativeAdgroups({accountId:account.id,page:1,pageSize:100});
    const totalPages=Math.max(1,Number(first.pageInfo.totalPage||1));
    if(totalPages>100)throw new Error('营销单元超过单次可安全加载的数量');
    const groups=[...first.list];
    for(let page=2;page<=totalPages;page++){
      const result=await getMultiAccountCreativeAdgroups({accountId:account.id,page,pageSize:100});
      groups.push(...result.list);
    }
    adgroupMap[account.id]=groups;
    return groups;
  }finally{const done=new Set(adgroupLoading.value);done.delete(account.id);adgroupLoading.value=done;}
}
async function refreshAdgroups(account:any){try{await loadAdgroups(account);}catch{ElMessage.error('营销单元刷新失败，请稍后重试');}}
function toggleAdgroup(accountId:string,group:PromotionCreativeAdgroup){const key=targetKey(accountId,group.id);const next=new Set(selectedAdgroupKeys.value);if(next.has(key)){next.delete(key);selectedTargets.value=selectedTargets.value.filter((row)=>targetKey(row.accountId,row.adgroup.id)!==key);}else{next.add(key);selectedTargets.value.push({accountId,adgroup:group,templateId:''});}selectedAdgroupKeys.value=next;preflight.value=null;}
async function loadTemplates(row:{accountId:string;adgroup:PromotionCreativeAdgroup}){const key=targetKey(row.accountId,row.adgroup.id);if(templateMap[key]?.length)return;const result=await getMultiAccountCreativeTemplates({accountId:row.accountId,adgroupId:row.adgroup.id,deliveryMode:form.deliveryMode,dynamicCreativeType:form.creativeType,page:1,pageSize:100});templateMap[key]=result.list;}
function clearTemplates(){for(const key of Object.keys(templateMap))delete templateMap[key];for(const key of Object.keys(templateFields))delete templateFields[key];for(const key of Object.keys(templateImageCaps))delete templateImageCaps[key];for(const target of selectedTargets.value){target.templateId='';target.disabledDefaultComponentTypes=[];target.componentOverrides=[];target.overrideReason=undefined;}batchTemplateId.value='';preflight.value=null;}
type TemplateDetail=Awaited<ReturnType<typeof getPromotionCreativeTemplateDetail>>;
function applyTemplateDetail(target:SelectedTarget,requestedTemplateId:string,detail:TemplateDetail){
  if(String(detail.template.creative_template_id||'')!==requestedTemplateId)throw new Error('腾讯未返回所选规格');
  const key=targetKey(target.accountId,target.adgroup.id);
  const fields=detail.requirements.map((item)=>canonicalComponentField(String(item.path||item.name||'').split('.').pop()||''));
  const imageLimits=detail.requirements.filter((item)=>['image','image_list'].includes(String(item.path||item.name||'').split('.').pop()||'')).map((item)=>{
    return Number(item.max||0);
  }).filter((limit)=>limit>0);
  if(imageLimits.length)templateImageCaps[key]=Math.min(20,...imageLimits);
  else delete templateImageCaps[key];
  if(form.rules.imageCount>imageCountMax.value){form.rules.imageCount=imageCountMax.value;ElMessage.info(`已按所选创意规格将每条图片数调整为 ${imageCountMax.value}；其余已选图片仍可生成其他创意`);}
  const sites=(detail.template.site_set||detail.template.siteSet) as string[]|undefined;
  const videoFields=['video','video_list','short_video','app_promotion_video','video_showcase'];
  if(Array.isArray(sites)&&sites.includes('SITE_SET_CHANNELS')&&fields.some((field)=>videoFields.includes(field)))fields.push('text_link','mini_card_link','floating_zone','wechat_channels');
  target.templateId=requestedTemplateId;target.disabledDefaultComponentTypes=[];templateFields[key]=[...new Set(fields)];
  const choices=defaultChoices(target);
  if(choices.some((item)=>item.componentType==='text_link'&&defaultSupported(target,item.componentType))&&choices.some((item)=>item.componentType==='mini_card_link'&&defaultSupported(target,item.componentType)))target.disabledDefaultComponentTypes=['mini_card_link'];
  preflight.value=null;
}
async function templateChanged(target:SelectedTarget){target.disabledDefaultComponentTypes=[];target.componentOverrides=[];target.overrideReason=undefined;preflight.value=null;const key=targetKey(target.accountId,target.adgroup.id);delete templateFields[key];delete templateImageCaps[key];if(!target.templateId)return;const requestedTemplateId=target.templateId;const pending=new Set(templateLoading.value);pending.add(key);templateLoading.value=pending;try{const detail=await getPromotionCreativeTemplateDetail({accountId:target.accountId,adgroupId:target.adgroup.id,templateId:requestedTemplateId,deliveryMode:form.deliveryMode,dynamicCreativeType:form.creativeType});if(!selectedTargets.value.includes(target)||target.templateId!==requestedTemplateId)return;applyTemplateDetail(target,requestedTemplateId,detail);}catch{if(target.templateId===requestedTemplateId){target.templateId='';ElMessage.error(`读取${target.adgroup.name}的腾讯创意规格失败，请重选规格后重试`);}}finally{const done=new Set(templateLoading.value);done.delete(key);templateLoading.value=done;}}
async function applyBatchTemplate(){
  const templateId=batchTemplateId.value;
  if(!templateId||!selectedTargets.value.length)return;
  const targets=[...selectedTargets.value],deliveryMode=form.deliveryMode,creativeType=form.creativeType;
  batchApplyingTemplates.value=true;
  let applied=0;const failed:string[]=[];
  try{
    for(let index=0;index<targets.length;index+=3){
      await Promise.all(targets.slice(index,index+3).map(async(target)=>{
        try{
          const detail=await getPromotionCreativeTemplateDetail({accountId:target.accountId,adgroupId:target.adgroup.id,templateId,deliveryMode,dynamicCreativeType:creativeType});
          if(!selectedTargets.value.includes(target)||form.deliveryMode!==deliveryMode||form.creativeType!==creativeType||batchTemplateId.value!==templateId)return;
          applyTemplateDetail(target,templateId,detail);applied++;
        }catch{failed.push(`${accountById(target.accountId)?.name||'账户'} / ${target.adgroup.name}`);}
      }));
    }
    if(failed.length)ElMessage({type:applied?'warning':'error',message:`已应用 ${applied} 个目标，${failed.length} 个不兼容或读取失败并保留原规格：${failed.slice(0,3).join('、')}${failed.length>3?'等':''}`,duration:7000});
    else ElMessage.success(`已为 ${applied} 个营销单元设置规格；提交前仍将逐项预检`);
  }finally{batchApplyingTemplates.value=false;}
}
function canonicalComponentField(field:string){return ({jump_info:'main_jump_info',floating_zone_list:'floating_zone'} as Record<string,string>)[field]||field;}
function defaultSupported(target:SelectedTarget,field:string){return (templateFields[targetKey(target.accountId,target.adgroup.id)]||[]).includes(canonicalComponentField(field));}
async function loadDefaultComponents(force=false){await Promise.all([...new Set(selectedTargets.value.map((target)=>target.accountId))].map(async(accountId)=>{if(!force&&defaultComponentMap[accountId])return;const pending=new Set(defaultLoading.value);pending.add(accountId);defaultLoading.value=pending;try{defaultComponentMap[accountId]=(await getCreativeDefaultComponents(accountId)).filter((item)=>item.status==='ACTIVE');}catch{ElMessage.error(`获取${accountById(accountId)?.name||'账户'}默认组件失败，请重试`);}finally{const done=new Set(defaultLoading.value);done.delete(accountId);defaultLoading.value=done;}}));}
function defaultChoices(target:SelectedTarget){const candidates=(defaultComponentMap[target.accountId]||[]).filter((item)=>!item.templateId||item.templateId===target.templateId).filter((item)=>!item.creativeType||item.creativeType===form.creativeType).filter((item)=>!item.marketingGoal||item.marketingGoal===target.adgroup.marketingGoal);const score=(item:DefaultComponentRow)=>(item.templateId?400:0)+(item.creativeType?300:0)+(item.marketingGoal?200:0);return [...candidates].sort((a,b)=>a.componentType.localeCompare(b.componentType)||score(b)-score(a)||(b.priority||0)-(a.priority||0));}
function activeDefaultId(target:SelectedTarget,type:string){if((target.disabledDefaultComponentTypes||[]).includes(type))return null;const selected=target.componentOverrides?.find((item)=>item.componentType===type);return selected?.configId||defaultChoices(target).find((item)=>item.componentType===type)?.id||null;}
function componentLabel(field:string){return ({brand:'品牌形象',main_jump_info:'落地页',conversion_component:'转化组件',text_link:'文字链',mini_card_link:'图文链接',floating_zone:'浮层卡片',wechat_channels:'视频号授权',action_button:'行动按钮',label:'标签',first_comment:'首评回复'} as Record<string,string>)[field]||field;}
function toggleDefault(target:SelectedTarget,item:DefaultComponentRow,enabled:boolean){const type=item.componentType;const disabled=new Set(target.disabledDefaultComponentTypes||[]);const overrides=(target.componentOverrides||[]).filter((entry)=>entry.componentType!==type);if(enabled){disabled.delete(type);const preferred=defaultChoices(target).find((row)=>row.componentType===type);if(preferred?.id!==item.id){if(!canManageDefaults.value)return ElMessage.warning('选择非优先默认组件需要维护默认组件权限');overrides.push({componentType:type,configId:item.id});}if(type==='text_link')disabled.add('mini_card_link');if(type==='mini_card_link')disabled.add('text_link');}else disabled.add(type);target.componentOverrides=overrides;target.disabledDefaultComponentTypes=[...disabled];target.overrideReason=overrides.length?`批量新建时手动选择：${overrides.map((entry)=>{const selected=defaultChoices(target).find((row)=>row.id===entry.configId);return `${componentLabel(entry.componentType)} ${selected?.componentName||entry.configId}`;}).join('；')}`.slice(0,500):undefined;preflight.value=null;}
async function openOverrides(row:SelectedTarget){overrideTarget.value=row;overrideRows.value=(await getCreativeDefaultComponents(row.accountId)).filter((item)=>item.status==='ACTIVE');overrideSelectionIds.value=(row.componentOverrides||[]).map((item)=>item.configId);overrideReason.value=row.overrideReason||'';overrideDialog.value=true;}
function saveOverrides(){if(!overrideTarget.value)return;const chosen=overrideRows.value.filter((item)=>overrideSelectionIds.value.includes(item.id));const fields=new Set(chosen.map((item)=>item.componentType));if(fields.size!==chosen.length)return ElMessage.warning('同一组件字段只能覆盖一个配置');if(fields.has('text_link')&&fields.has('mini_card_link'))return ElMessage.warning('文字链和图文链接只能选择其中一种');if(chosen.length&&!overrideReason.value.trim())return ElMessage.warning('请填写覆盖原因');overrideTarget.value.componentOverrides=chosen.map((item)=>({componentType:item.componentType,configId:item.id}));overrideTarget.value.overrideReason=overrideReason.value.trim()||undefined;overrideDialog.value=false;preflight.value=null;}
function payload(){return {...form,assetSnapshotIds:selectedAssets.value.map((item)=>item.id),targets:selectedTargets.value.map((row)=>({accountId:row.accountId,adgroupIds:[row.adgroup.id],templateId:row.templateId,componentOverrides:row.componentOverrides,overrideReason:row.overrideReason,disabledDefaultComponentTypes:row.disabledDefaultComponentTypes}))} as MultiAccountCreativePayload;}
async function next(){if(step.value===0){const hasMedia=selectedAssets.value.some((item)=>item.type==='VIDEO'||item.type==='IMAGE');const hasTitle=selectedAssets.value.some((item)=>item.type==='TITLE'||['title','description'].includes(String(item.componentField||'')));if(!hasMedia||!hasTitle)return ElMessage.warning('图片或视频至少选一项，文案至少选一项');}if(step.value===1){if(!selectedTargets.value.length)return ElMessage.warning('请至少选择一个账户下的一个营销单元');step.value++;await loadDefaultComponents();if(selectedTargets.value[0])try{await loadTemplates(selectedTargets.value[0]);}catch{ElMessage.warning('首个营销单元的规格列表读取失败，请在规格选择框中重试');}return;}step.value++;}
async function runPreflight(){if(selectedTargets.value.some((row)=>!row.templateId))return ElMessage.warning('请为每个账户和营销单元选择创意规格');if(selectedTargets.value.some((row)=>!templateFields[targetKey(row.accountId,row.adgroup.id)]))return ElMessage.warning('部分目标的腾讯创意规格尚未读取成功，请重选规格后重试');if(!form.rules.videoCount&&!form.rules.imageCount)return ElMessage.warning('每条创意至少包含一项图片或视频');for(const [label,type,count] of [['标题/文案','TITLE',form.rules.titleCount],['视频','VIDEO',form.rules.videoCount],['图片','IMAGE',form.rules.imageCount]] as const){const available=selectedAssets.value.filter((item)=>type==='TITLE'?(item.type==='TITLE'||['title','description'].includes(String(item.componentField||''))):item.type===type).length;if(count>available)return ElMessage.warning(`${label}已选 ${available} 项，少于每条创意设置的 ${count} 项；请减少数量或返回素材步骤补选`);}preflighting.value=true;try{preflight.value=await preflightMultiAccountCreativeBatch(payload());step.value=3;}finally{preflighting.value=false;}}
async function submit(){if(!preflight.value)return;await ElMessageBox.confirm(`将向腾讯广告真实提交 ${preflight.value.estimatedCreativeCount} 条创意，只有二次回查一致才计为成功。确认继续？`,'真实创建确认',{type:'warning'});if(form.allowSkipInvalid&&preflight.value.failedCount)await ElMessageBox.confirm(`将跳过 ${preflight.value.failedCount} 个不合格目标，仅创建通过预检的目标。`,'跳过确认',{type:'warning'});submitting.value=true;try{const task=await createMultiAccountCreativeBatch(payload());ElMessage.success(task.message||'任务已创建');activeView.value='records';await loadTasks();await openTask(task);}finally{submitting.value=false;}}
async function loadTasks(){const result=await getMultiAccountCreativeTasks({status:taskFilter.status||undefined,accountId:taskFilter.accountId||undefined,adgroupId:taskFilter.adgroupId||undefined,createdByAdminId:taskFilter.createdByAdminId||undefined,dateFrom:taskFilter.dateRange?.[0],dateTo:taskFilter.dateRange?.[1],page:taskFilter.page,pageSize:20});tasks.value=result.list;taskTotal.value=result.pageInfo.totalNumber;}
async function openTask(row:MultiAccountCreativeTask){currentTask.value=await getMultiAccountCreativeTask(row.id);detailOpen.value=true;}
async function retryTask(){if(!currentTask.value)return;currentTask.value=await retryMultiAccountCreativeBatch(currentTask.value.id);ElMessage.success('已优先回查有腾讯创意 ID 的项目；仅明确失败且无 ID 的项目会重新排队');}
async function cancelTask(){if(!currentTask.value)return;await ElMessageBox.confirm('仅取消尚未开始的项目；腾讯已受理的项目仍保留待核验。','取消任务',{type:'warning'});await cancelMultiAccountCreativeBatch(currentTask.value.id);currentTask.value=await getMultiAccountCreativeTask(currentTask.value.id);}
async function exportTask(){if(currentTask.value)await exportMultiAccountCreativeBatch(currentTask.value.id);}
const assetLabel=(type:string,item?:PromotionCreativeAsset)=>item?.componentField==='image_list'&&Number(item.bundleItemCount||0)>1?`九图组件（${item.bundleItemCount} 张）`:({VIDEO:'视频',IMAGE:'图片',TITLE:'文案'}[type]||type);const adgroupStatusLabel=(status?:string|null)=>({SMART_ADGROUP_STATUS_USING:'智能营销单元投放中',ADGROUP_STATUS_ACTIVE:'投放中',AD_STATUS_NORMAL:'启用',AD_STATUS_SUSPEND:'暂停',ADGROUP_STATUS_SUSPEND:'暂停'}[String(status||'')]||'状态需核对');const mappingLabel=(status:string)=>({AVAILABLE:'目标账户可用',AUTHORIZED:'腾讯业务单元授权可用',NEED_DISTRIBUTION:'需要分发',NOT_AVAILABLE:'不可用',INVALID:'已失效',UNKNOWN:'待确认'}[status]||status);const statusLabel=(status:string)=>({DRAFT:'草稿',PREFLIGHTING:'预检中',PREFLIGHT_FAILED:'预检失败',READY:'待执行',RUNNING:'处理中',PARTIAL_SUCCESS:'部分成功',SUCCEEDED:'全部已确认',FAILED:'失败',CANCELLED:'已取消',COMPLETED_WITH_EXCEPTIONS:'完成但有例外',PENDING:'待处理',SUBMITTING:'提交中',PLATFORM_ACCEPTED:'腾讯已受理待核验',VERIFYING:'核验中',CONFIRMED:'已确认创建',UNKNOWN_NEEDS_REVIEW:'待人工处理',SKIPPED:'已跳过'}[status]||status);const taskStatuses=['READY','RUNNING','PARTIAL_SUCCESS','SUCCEEDED','FAILED','CANCELLED','COMPLETED_WITH_EXCEPTIONS'];const formatTime=(value:string)=>new Date(value).toLocaleString('zh-CN');const formatSpend=(value:number|null|undefined)=>value===null||value===undefined?'—':`¥${Number(value).toFixed(2)}`;
onMounted(init);
</script>

<style scoped>
.page-heading-actions{display:flex;flex-wrap:wrap;gap:8px;flex-shrink:0}.page-heading-actions :deep(.el-button){margin:0;white-space:normal;min-height:36px;height:auto;padding:9px 15px}
@media(max-width:600px){.page-heading-actions{width:100%;display:grid;grid-template-columns:minmax(0,1fr)}}
.batch-template-toolbar{display:grid;grid-template-columns:minmax(210px,1fr) minmax(230px,360px) auto;align-items:center;gap:12px;margin:16px 0 10px;padding:13px 15px;border:1px solid var(--admin-border);border-radius:10px;background:#ffffff}.batch-template-toolbar>div{display:grid;gap:3px}.batch-template-toolbar small{color:var(--admin-text-muted);line-height:1.45}.batch-template-toolbar :deep(.el-select){width:100%}
@media(max-width:760px){.batch-template-toolbar{grid-template-columns:minmax(0,1fr)}.batch-template-toolbar :deep(.el-button){width:100%;margin:0}}
.linked-page-cell strong{display:block;white-space:normal;word-break:break-word;line-height:1.45}
.multi-creative-page{display:grid;gap:16px}.page-heading,.preflight-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.page-title{margin:0 0 6px}.page-heading p,.muted{margin:0;color:var(--admin-text-muted)}.panel{padding:20px;border:1px solid var(--admin-border);border-radius:14px;background:#fff}.steps{overflow-x:auto}.toolbar{display:grid;grid-template-columns:minmax(180px,1fr) auto 150px 130px 150px 100px minmax(220px,1fr);gap:10px;margin:16px 0}.records-toolbar{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr)) minmax(230px,1.4fr) auto;gap:10px;margin:16px 0}.table-scroll{overflow-x:auto}.table-scroll :deep(.el-table){min-width:1260px}.asset-preview{width:54px;height:40px;border-radius:6px}.block{display:block;margin-top:4px;color:var(--admin-text-muted)}.selected-strip,.name-tokens{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:15px}.name-tokens span{color:var(--admin-text-muted);font-size:12px}.target-search{margin:14px 0}.account-title{display:flex;align-items:center;gap:12px;width:100%}.account-title span{color:var(--admin-text-muted)}.account-title .el-tag{margin-left:auto}.adgroup-list{display:grid;gap:8px;margin-top:12px}.adgroup-list>label{display:grid;grid-template-columns:22px minmax(0,1fr) minmax(180px,auto);gap:10px;align-items:center;padding:12px;border:1px solid var(--admin-border);border-radius:10px}.adgroup-list>label>.el-checkbox{width:22px;margin:0}.adgroup-list small{display:block;color:var(--admin-text-muted)}.adgroup-list em{color:var(--el-color-danger);font-style:normal}.mode-grid,.rules-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:16px 0}.mode-grid label,.rules-grid label{display:grid;gap:7px}.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:15px 0}.summary-grid>div{padding:14px;border-radius:10px;background:var(--el-fill-color-light)}.summary-grid strong,.summary-grid span{display:block}.summary-grid strong{font-size:24px}.matrix-details{display:grid;gap:4px}.matrix-details .ok{color:var(--el-color-success)}.matrix-details .bad,.matrix-details b{color:var(--el-color-danger)}.wizard-actions,.drawer-actions{position:sticky;bottom:0;z-index:3;display:flex;justify-content:flex-end;gap:10px;padding:14px;background:rgba(255,255,255,.96);border-top:1px solid var(--admin-border)}.target-result{margin-top:18px}.target-result h3{margin:0 0 10px}
@media(max-width:900px){.panel{padding:14px}.toolbar,.records-toolbar{grid-template-columns:1fr 1fr}.mode-grid,.rules-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.summary-grid{grid-template-columns:repeat(2,1fr)}.page-heading{align-items:stretch}.wizard-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.wizard-actions :deep(.el-button){width:100%;margin:0}}
@media(max-width:600px){.page-heading,.preflight-heading{flex-direction:column}.page-heading :deep(.el-button),.preflight-heading :deep(.el-button){width:100%}.toolbar,.records-toolbar,.mode-grid,.rules-grid{grid-template-columns:1fr}.toolbar :deep(.el-radio-group){display:grid;grid-template-columns:1fr 1fr}.toolbar :deep(.el-radio-button),.toolbar :deep(.el-radio-button__inner){width:100%}.account-title{align-items:flex-start;flex-wrap:wrap}.account-title .el-tag{margin-left:0}.adgroup-list>label{grid-template-columns:22px minmax(0,1fr)}.adgroup-list em{grid-column:2}.wizard-actions{grid-template-columns:1fr}.summary-grid{grid-template-columns:1fr 1fr}}
.table-scroll :deep(.el-table){min-width:1100px}
.linked-page-cell strong{overflow:visible;text-overflow:clip;white-space:normal;overflow-wrap:anywhere}
.asset-select-all{margin:0;white-space:nowrap}.asset-select-all :deep(.el-checkbox__label){padding-left:6px;font-size:12px}
.default-components{margin:18px 0 4px;padding:16px;border:1px solid var(--admin-border);border-radius:12px;background:#ffffff}
.default-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}.default-heading h3{margin:0 0 4px;font-size:16px}.default-heading p{line-height:1.5}.default-heading .el-button{flex:none;margin:0}
.default-target{min-width:0;padding:14px;border:1px solid var(--admin-border);border-radius:10px;background:#fff}.default-target+.default-target{margin-top:12px}.default-target-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}.default-target-heading strong{min-width:0;overflow-wrap:anywhere}.default-target-heading small{flex:none;color:var(--admin-text-muted)}
.default-switches{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.default-switch{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;min-height:76px;padding:10px 12px;border:1px solid var(--admin-border);border-radius:8px;background:#fff}.default-info{display:grid;gap:3px;min-width:0}.default-info strong,.default-info small{min-width:0;white-space:normal;overflow-wrap:anywhere;line-height:1.4}.default-info strong{font-size:13px}.default-info small{color:var(--admin-text-muted);font-size:11px}.default-info .default-unavailable{color:var(--el-color-warning)}.default-type{color:var(--admin-primary);font-size:12px;font-weight:600}.default-switch :deep(.el-switch){flex:none}
@media(max-width:900px){.default-switches{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.default-heading{flex-direction:column}.default-switches{grid-template-columns:1fr}.default-switch{min-height:50px}}
</style>
<style scoped>
/* Keep every wizard step inside the viewport; wide data stays swipeable. */
.toolbar > :deep(.el-input:last-child) { min-width: 0; }
.toolbar > :deep(.el-input:last-child .el-input-group__append) { flex: 0 0 auto; }
.toolbar > :deep(.el-input:last-child .el-input-group__append .el-button) { min-width: 64px; white-space: nowrap; }
@media (min-width: 901px) and (max-width: 1800px) {
  .toolbar { grid-template-columns: minmax(180px, 1fr) auto repeat(4, minmax(105px, 1fr)); }
  .toolbar > :deep(.el-input:last-child) { grid-column: 1 / -1; width: 100%; }
}
@media (min-width: 1801px) {
  .toolbar--no-dimensions { grid-template-columns: minmax(180px, 1fr) auto 150px 150px 100px minmax(260px, 1fr); }
}
@media (min-width: 901px) and (max-width: 1800px) {
  .toolbar--no-dimensions { grid-template-columns: minmax(180px, 1fr) auto repeat(3, minmax(105px, 1fr)); }
}
.multi-creative-page,.multi-creative-page>.panel,.table-scroll,.account-tree,.default-components{min-width:0;max-width:100%}
.table-scroll{overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
.selected-strip :deep(.el-tag){max-width:100%;height:auto;min-height:28px;white-space:normal;text-align:left}
.selected-strip :deep(.el-tag__content){min-width:0;overflow-wrap:anywhere;line-height:1.35}
.account-title{min-width:0;padding-right:4px}
.account-title strong,.account-title span{min-width:0;overflow-wrap:anywhere}
.matrix-details>*{overflow-wrap:anywhere}
@media(max-width:760px){
  .steps:before,.table-scroll:before{display:block;margin-bottom:8px;color:var(--admin-text-muted);font-size:12px;content:'左右滑动查看完整内容'}
  .steps :deep(.el-steps){min-width:610px}
  .multi-creative-page>.panel{padding:12px;overflow:hidden}
  .table-scroll{overflow-x:auto}
  .table-scroll :deep(.el-table){min-width:980px}
  .toolbar,.records-toolbar,.mode-grid,.rules-grid{grid-template-columns:minmax(0,1fr)}
  .toolbar :deep(.el-select),.toolbar :deep(.el-input),.records-toolbar :deep(.el-select),.records-toolbar :deep(.el-input),.records-toolbar :deep(.el-date-editor){width:100%;min-width:0}
  .account-tree :deep(.el-collapse-item__header){height:auto;min-height:76px;gap:8px;padding:10px 4px;line-height:1.35}
  .account-tree :deep(.el-collapse-item__arrow){flex:none;margin-right:2px}
  .account-title{display:grid;grid-template-columns:22px minmax(0,1fr);gap:3px 8px;align-items:start}
  .account-title :deep(.el-checkbox){grid-row:1/4;margin-right:0}
  .account-title strong,.account-title span,.account-title .el-tag{grid-column:2;margin:0}
  .account-title .el-tag{justify-self:start;max-width:100%}
  .adgroup-list>label{min-width:0;padding:10px}
  .adgroup-list>label span,.adgroup-list>label small{min-width:0;overflow-wrap:anywhere}
  .selected-strip{align-items:flex-start}
  .selected-strip>strong{width:100%}
  .default-info small{white-space:normal;overflow-wrap:anywhere;text-overflow:clip}
  .wizard-actions{bottom:max(0px,env(safe-area-inset-bottom));grid-template-columns:repeat(2,minmax(0,1fr));max-width:100%;padding:10px}
  .wizard-actions :deep(.el-button){min-width:0;min-height:42px;white-space:normal;overflow-wrap:anywhere}
  .records-toolbar :deep(.el-date-editor){max-width:100%}
  .drawer-actions{flex-wrap:wrap;padding:10px}
  .drawer-actions :deep(.el-button){flex:1 1 130px;min-height:42px;margin:0;white-space:normal}
}
@media(max-width:380px){.wizard-actions{grid-template-columns:minmax(0,1fr)}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
