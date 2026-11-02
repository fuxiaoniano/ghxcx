<template>
  <section class="defaults-page">
    <div class="page-heading"><h1 class="page-title">账户默认组件</h1><p>按账户配置批量新建所需组件；每次创建前仍会向腾讯重新验证。</p></div>
    <el-alert type="info" :closable="false" title="解析优先级：账户+规格 → 账户+创意类型 → 账户+推广目标 → 账户通用默认。不会随机选取组件。" />
    <div class="panel">
      <div class="toolbar"><el-select v-model="accountId" filterable placeholder="选择腾讯账户" @change="accountChanged"><el-option v-for="item in options?.accounts || []" :key="item.id" :value="item.id" :label="`${item.name} · ${item.accountNo}`" /></el-select><el-button v-if="canManage" type="primary" :disabled="!accountId" @click="openCreate">新增默认组件</el-button></div>
      <div class="table-scroll"><el-table :data="rows" stripe>
        <el-table-column label="组件类别" min-width="150"><template #default="{ row }">{{ componentTypeLabel(row.componentType) }}</template></el-table-column>
        <el-table-column prop="componentName" label="组件名称" min-width="220" />
        <el-table-column prop="platformComponentId" label="腾讯组件编号" min-width="150" />
        <el-table-column prop="templateId" label="适用规格" min-width="130"><template #default="{ row }">{{ row.templateId || '通用' }}</template></el-table-column>
        <el-table-column label="创意类型" min-width="150"><template #default="{ row }">{{ creativeTypeLabel(row.creativeType) }}</template></el-table-column>
        <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status === 'ACTIVE' ? '使用中' : row.status === 'DISABLED' ? '已停用' : '状态未知' }}</el-tag></template></el-table-column>
        <el-table-column v-if="canManage" label="操作" width="100"><template #default="{ row }"><el-button link type="danger" :loading="disablingId === row.id" :disabled="row.status !== 'ACTIVE'" @click="disable(row.id)">{{ row.status === 'ACTIVE' ? '停用' : '已停用' }}</el-button></template></el-table-column>
      </el-table></div>
    </div>
    <el-dialog v-model="dialogOpen" title="新增账户默认组件" width="min(720px,94vw)" @closed="resetCreate">
      <el-form label-position="top">
        <el-form-item label="组件类别"><el-select v-model="assetType" @change="loadAssets"><el-option v-for="item in componentTypes" :key="item.value" :value="item.value" :label="item.label" /></el-select></el-form-item>
        <el-form-item label="腾讯组件" required>
          <el-select v-model="selectedId" filterable :loading="assetsLoading" popper-class="component-asset-popper" placeholder="搜索或选择腾讯组件" style="width:100%">
            <el-option v-for="item in componentOptions" :key="item.id" :value="item.id" :label="componentSearchLabel(item)">
              <div class="component-option">
                <div v-if="item.type === 'LABEL' && item.labelTexts?.length" class="component-label-texts"><span v-for="(labelText, index) in item.labelTexts" :key="index">{{ index + 1 }}. {{ labelText }}</span></div>
                <strong v-else>{{ componentDisplayName(item) }}</strong>
                <div v-if="showsLinkedPage(item)" class="component-linked-page"><span>关联落地页：{{ linkedPageName(item) }}</span><small v-if="item.linkedLandingPage">落地页编号：{{ item.linkedLandingPage.pageId }}</small></div>
                <small>组件名称：{{ item.name }} · 编号：{{ item.platformAssetId }}</small>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <div v-if="selectedAsset" class="selected-component-detail">
          <strong>当前选择的组件内容</strong>
          <div v-if="selectedAsset.type === 'LABEL' && selectedAsset.labelTexts?.length" class="component-label-texts"><span v-for="(labelText, index) in selectedAsset.labelTexts" :key="index">{{ index + 1 }}. {{ labelText }}</span></div>
          <p v-else>{{ componentDisplayName(selectedAsset) }}</p>
          <div v-if="showsLinkedPage(selectedAsset)" class="component-linked-page"><span>关联落地页：{{ linkedPageName(selectedAsset) }}</span><small v-if="selectedAsset.linkedLandingPage">落地页编号：{{ selectedAsset.linkedLandingPage.pageId }}</small></div>
          <small>组件名称：{{ selectedAsset.name }} · 编号：{{ selectedAsset.platformAssetId }}</small>
        </div>
        <el-form-item label="适用创意类型"><el-select v-model="creativeType" clearable><el-option label="普通创意" value="DYNAMIC_CREATIVE_TYPE_COMMON" /><el-option label="动态创意" value="DYNAMIC_CREATIVE_TYPE_PROGRAM" /></el-select></el-form-item>
        <el-form-item label="适用规格编号（留空为通用）"><el-input v-model="templateId" /></el-form-item>
        <el-form-item label="优先级"><el-input-number v-model="priority" :min="0" :max="1000" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogOpen = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存并验证</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { disableCreativeDefaultComponent, getCreativeDefaultComponents, getMultiAccountCreativeAssets, getMultiAccountCreativeOptions, saveCreativeDefaultComponent, type PromotionCreativeAsset, type PromotionCreativeBatchOptions } from '../api/admin';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const canManage = computed(() => auth.hasPermission('PROMOTION_CREATIVE_DEFAULT_COMPONENT_MANAGE'));
const options = ref<PromotionCreativeBatchOptions | null>(null);
const accountId = ref('');
const rows = ref<any[]>([]);
const dialogOpen = ref(false);
const assets = ref<PromotionCreativeAsset[]>([]);
const assetsLoading = ref(false);
const assetType = ref('LANDING_PAGE');
const selectedId = ref('');
const creativeType = ref('');
const templateId = ref('');
const priority = ref(0);
const saving = ref(false);
const disablingId = ref('');
// 与“新建创意”共享的类别保持同名同序；额外类别保留以兼容已有默认组件配置。
const componentTypes = [{ label: '落地页', value: 'LANDING_PAGE' }, { label: '品牌形象', value: 'BRAND' }, { label: '行动按钮', value: 'ACTION_BUTTON' }, { label: '图文链接', value: 'MINI_CARD_LINK' }, { label: '文字链', value: 'TEXT_LINK' }, { label: '浮层卡片', value: 'FLOATING_ZONE' }, { label: '标签', value: 'LABEL' }, { label: '首评回复', value: 'SOCIAL_SKILL' }, { label: '转化组件', value: 'CONVERSION' }, { label: '视频号授权', value: 'WECHAT_CHANNELS' }, { label: '其他组件', value: 'OTHER' }];
const componentOptions = computed(() => assets.value.filter((item) => (item.platformAssetKind === 'COMPONENT' || (assetType.value === 'LANDING_PAGE' && item.platformAssetKind === 'REFERENCE')) && item.usable));
const selectedAsset = computed(() => componentOptions.value.find((item) => item.id === selectedId.value));
const hasResolvedLinkedPage = (item: PromotionCreativeAsset) => Boolean(item.linkedLandingPage?.name && !item.linkedLandingPage.name.startsWith('腾讯落地页 '));
const componentDisplayName = (item: PromotionCreativeAsset) => item.type === 'LANDING_PAGE' ? (hasResolvedLinkedPage(item) ? item.linkedLandingPage!.name : item.contentSummary || item.name) : item.type === 'BRAND' ? item.name : item.contentSummary || item.name;
const showsLinkedPage = (item: PromotionCreativeAsset) => ['text_link', 'mini_card_link', 'action_button', 'chosen_button'].includes(String(item.componentField || '').toLowerCase()) || ['TEXT_LINK', 'MINI_CARD_LINK', 'ACTION_BUTTON'].includes(item.type);
const linkedPageName = (item: PromotionCreativeAsset) => item.linkedLandingPage?.name || '腾讯未返回关联落地页';
const componentSearchLabel = (item: PromotionCreativeAsset) => [componentDisplayName(item), hasResolvedLinkedPage(item) ? item.linkedLandingPage!.name : '', item.name, item.platformAssetId].filter(Boolean).join(' · ');
const componentNames: Record<string, string> = {
  main_jump_info: '落地页', jump_info: '落地页', end_page: '落地页',
  title: '标题文案', description: '描述文案', image: '图片', image_list: '图片组', video: '视频', video_list: '视频组',
  brand: '品牌形象', channels_brand: '视频号品牌形象', wechat_channels: '视频号授权',
  action_button: '行动按钮', chosen_button: '行动按钮', mini_card_link: '图文链接', text_link: '文字链',
  floating_zone: '浮层卡片', floating_zone_list: '浮层卡片', label: '标签', social_skill: '首评回复',
  consult: '咨询组件', phone: '电话组件', form: '表单组件', marketing_pendant: '营销挂件',
  show_data: '数据展示', count_down: '倒计时', barrage: '弹幕', shop_image: '商品图片',
  app_gift_pack_code: '礼包码', living_desc: '直播文案', short_video: '短视频', element_story: '故事组件',
  wxgame_playable_page: '小游戏试玩页', wxgame_direct_page: '小游戏直达页',
  app_promotion_video: '应用推广视频', video_showcase: '视频橱窗', image_showcase: '图片橱窗',
  video_channels_content: '视频号内容', wechat_shop_activity: '微信小店活动',
  doctor_card: '医生名片', channels_live_feed: '视频号直播动态', rewarded_browse: '激励浏览', audio: '音频',
};
function componentTypeLabel(value: string | null | undefined) {
  if (!value) return '其他组件';
  return componentNames[value.toLowerCase()] || componentTypes.find((item) => item.value === value)?.label || '其他组件';
}
function creativeTypeLabel(value: string | null | undefined) {
  if (!value) return '通用';
  return ({ DYNAMIC_CREATIVE_TYPE_COMMON: '普通创意', DYNAMIC_CREATIVE_TYPE_PROGRAM: '动态创意' } as Record<string, string>)[value] || '其他创意类型';
}

let loadSequence = 0;
async function init() { options.value = await getMultiAccountCreativeOptions(); accountId.value = options.value.accounts[0]?.id || ''; if (accountId.value) await accountChanged(); }
async function accountChanged() { rows.value = await getCreativeDefaultComponents(accountId.value); resetCreate(); }
function resetCreate() { loadSequence += 1; assets.value = []; selectedId.value = ''; assetType.value = 'LANDING_PAGE'; creativeType.value = ''; templateId.value = ''; priority.value = 0; assetsLoading.value = false; }
async function openCreate() { resetCreate(); dialogOpen.value = true; await loadAssets(); }
async function loadAssets() {
  if (!accountId.value) return;
  const sequence = ++loadSequence;
  const requestedAccountId = accountId.value;
  const requestedAssetType = assetType.value;
  assets.value = [];
  selectedId.value = '';
  assetsLoading.value = true;
  try {
    const first = await getMultiAccountCreativeAssets({ accountId: requestedAccountId, source: 'ACCOUNT', assetType: requestedAssetType, page: 1, pageSize: 100, refresh: true });
    const list = [...first.list];
    for (let page = 2; page <= first.pageInfo.totalPage && page <= 50; page += 1) {
      if (sequence !== loadSequence) return;
      const next = await getMultiAccountCreativeAssets({ accountId: requestedAccountId, source: 'ACCOUNT', assetType: requestedAssetType, page, pageSize: 100, refresh: false });
      list.push(...next.list);
    }
    if (sequence !== loadSequence) return;
    assets.value = list;
    selectedId.value = '';
    if (!list.length) ElMessage.info('腾讯后台未返回此类别的可用组件');
  } catch (error) {
    if (sequence === loadSequence) { assets.value = []; selectedId.value = ''; ElMessage.error(error instanceof Error ? error.message : '腾讯组件列表读取失败，请检查账户授权后重试'); }
  } finally { if (sequence === loadSequence) assetsLoading.value = false; }
}
async function save() {
  if (assetsLoading.value || saving.value) return;
  const asset = selectedAsset.value;
  if (!asset) return ElMessage.warning('请选择腾讯组件');
  if (!asset.componentField) return ElMessage.warning('腾讯返回的该组件缺少组件字段，不能设为默认值');
  saving.value = true;
  try {
    await saveCreativeDefaultComponent({ accountId: accountId.value, componentType: asset.componentField, platformComponentId: asset.platformAssetId, componentName: componentDisplayName(asset), creativeType: creativeType.value || undefined, templateId: templateId.value || undefined, priority: priority.value });
    ElMessage.success('默认组件已保存并通过腾讯账户可用性验证');
    dialogOpen.value = false;
    await accountChanged();
  } finally { saving.value = false; }
}
async function disable(id: string) {
  try { await ElMessageBox.confirm('停用后该配置保留为历史记录，状态显示“已停用”，新任务不再使用。', '确认停用', { type: 'warning' }); }
  catch { return; }
  disablingId.value = id;
  try {
    await disableCreativeDefaultComponent(id);
    await accountChanged();
    ElMessage.success('默认组件已停用');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '停用失败，请重试');
  } finally { disablingId.value = ''; }
}
onMounted(init);
</script>

<style scoped>
.defaults-page{display:grid;gap:16px}.page-title{margin:0 0 6px}.page-heading p{margin:0;color:var(--admin-text-muted)}.panel{padding:18px;border:1px solid var(--admin-border);border-radius:14px;background:#fff}.toolbar{display:flex;gap:10px;margin-bottom:15px}.toolbar :deep(.el-select){width:min(420px,100%)}.table-scroll{overflow-x:auto}.table-scroll :deep(.el-table){min-width:820px}
.component-option{display:grid;gap:5px;min-width:0;white-space:normal;overflow-wrap:anywhere;line-height:1.45}.component-option strong{font-weight:600}.component-option small,.selected-component-detail small{color:var(--admin-text-muted);white-space:normal;overflow-wrap:anywhere}.component-label-texts{display:grid;gap:3px;white-space:normal;overflow-wrap:anywhere;line-height:1.45}.selected-component-detail{display:grid;gap:6px;padding:12px;margin:-2px 0 18px;border:1px solid var(--admin-border);border-radius:9px;background:#ffffff;overflow-wrap:anywhere}.selected-component-detail p{margin:0}
.component-linked-page{display:grid;gap:2px;white-space:normal;overflow-wrap:anywhere;line-height:1.45;color:var(--admin-primary);font-weight:600}.component-linked-page small{font-weight:400}
:global(.component-asset-popper .el-select-dropdown__item){height:auto;min-height:34px;line-height:normal;padding:9px 12px;white-space:normal}
@media(max-width:600px){.toolbar{flex-direction:column}.toolbar :deep(.el-select),.toolbar :deep(.el-button){width:100%;margin:0}}
</style>
