<template>
  <div class="page-heading"><h1 class="page-title">系统配置</h1><p>管理落地页展示内容、表单文案和门店信息</p></div>
  <div class="content-panel">
    <el-tabs>
      <el-tab-pane label="落地页配置">
        <el-alert
          class="page-tip"
          type="info"
          :closable="false"
          show-icon
          title="保存后，H5 落地页刷新立即生效；小程序端需要用户重新进入页面，若本次涉及新增展示能力，需重新上传发布小程序版本。"
        />
        <el-alert
          class="page-tip"
          type="warning"
          :closable="false"
          show-icon
          title="姓名、手机号授权、年龄、缺牙情况、隐私勾选等表单字段不提供隐藏开关，避免影响挂号提交。"
        />

        <el-form label-width="150px" v-if="landing" class="config-form">
          <el-divider content-position="left">表单上方图片</el-divider>
          <el-form-item label="显示图片">
            <el-switch v-model="landing.display.formTopImages" active-text="显示" inactive-text="隐藏" />
          </el-form-item>
          <el-form-item label="上传图片">
            <el-upload
              accept="image/*"
              :show-file-list="false"
              :http-request="uploadFormTopImage"
              :before-upload="beforeImageUpload"
            >
              <el-button type="primary">上传并替换顶部图片</el-button>
            </el-upload>
            <span class="help-text">支持 jpg、png、webp、gif，单张不超过 5MB。上传成功后会替换小程序顶部图片，保存后生效。</span>
          </el-form-item>
          <el-form-item label="图片地址">
            <el-input v-model="formTopImagesText" type="textarea" :rows="3" placeholder="顶部图片地址，通常保留一行即可" />
          </el-form-item>
          <el-form-item label="图片预览" v-if="landing.formTopImages.length">
            <div class="image-list">
              <div v-for="(url, index) in landing.formTopImages" :key="url + index" class="image-item">
                <el-image :src="url" fit="cover" class="image-thumb" />
                <div class="image-actions">
                  <el-button text type="danger" @click="removeFormTopImage(index)">删除</el-button>
                </div>
              </div>
            </div>
          </el-form-item>

          <el-divider content-position="left">顶部品牌</el-divider>
          <el-form-item label="顶部品牌区域">
            <el-switch v-model="landing.display.brandSection" active-text="显示" inactive-text="隐藏" />
          </el-form-item>
          <el-form-item label="Logo 文字">
            <div class="field-row">
              <el-input class="row-input" v-model="landing.text.logoText" maxlength="4" />
              <el-switch class="inline-switch" v-model="landing.display.logo" active-text="显示" inactive-text="隐藏" />
            </div>
          </el-form-item>
          <el-form-item label="品牌名称">
            <div class="field-row">
              <el-input class="row-input" v-model="landing.brandName" />
              <el-switch class="inline-switch" v-model="landing.display.brandName" active-text="显示" inactive-text="隐藏" />
            </div>
          </el-form-item>
          <el-form-item label="品牌副标题">
            <div class="field-row">
              <el-input class="row-input" v-model="landing.text.brandSubtitle" />
              <el-switch class="inline-switch" v-model="landing.display.brandSubtitle" active-text="显示" inactive-text="隐藏" />
            </div>
          </el-form-item>
          <el-form-item label="角标文案">
            <div class="field-row">
              <el-input class="row-input" v-model="landing.text.brandBadgeText" />
              <el-switch class="inline-switch" v-model="landing.display.brandBadge" active-text="显示" inactive-text="隐藏" />
            </div>
          </el-form-item>

          <el-divider content-position="left">活动与价格</el-divider>
          <el-form-item label="活动区域">
            <el-switch v-model="landing.display.bannerSection" active-text="显示" inactive-text="隐藏" />
          </el-form-item>
          <el-form-item label="活动标题">
            <div class="field-row">
              <el-input class="row-input" v-model="landing.activityTitle" />
              <el-switch class="inline-switch" v-model="landing.display.formTitle" active-text="显示表单标题" inactive-text="隐藏表单标题" />
            </div>
          </el-form-item>
          <el-form-item label="补贴文案">
            <div class="field-row">
              <el-input class="row-input" v-model="landing.subsidyText" />
              <el-switch class="inline-switch" v-model="landing.display.subsidyText" active-text="显示" inactive-text="隐藏" />
            </div>
          </el-form-item>
          <el-form-item label="价格卡片">
            <el-switch v-model="landing.display.priceCard" active-text="显示" inactive-text="隐藏" />
          </el-form-item>
          <el-form-item label="原价标签"><el-input v-model="landing.text.originalPriceLabel" /></el-form-item>
          <el-form-item label="原价"><el-input v-model="landing.originalPrice" /></el-form-item>
          <el-form-item label="活动价标签"><el-input v-model="landing.text.activityPriceLabel" /></el-form-item>
          <el-form-item label="活动价"><el-input v-model="landing.activityPrice" /></el-form-item>
          <el-form-item label="包含项目">
            <div class="field-row">
              <el-input class="row-input" v-model="includedItemsText" type="textarea" :rows="4" placeholder="每行一个项目" />
              <el-switch class="inline-switch" v-model="landing.display.includedItems" active-text="显示" inactive-text="隐藏" />
            </div>
          </el-form-item>

          <el-divider content-position="left">表单文案</el-divider>
          <el-form-item label="姓名标签"><el-input v-model="landing.text.nameLabel" /></el-form-item>
          <el-form-item label="姓名占位"><el-input v-model="landing.text.namePlaceholder" /></el-form-item>
          <el-form-item label="电话标签"><el-input v-model="landing.text.phoneLabel" /></el-form-item>
          <el-form-item label="授权后前缀"><el-input v-model="landing.text.phoneAuthorizedPrefix" /></el-form-item>
          <el-form-item label="手机号按钮"><el-input v-model="landing.text.phoneAuthorizeButtonText" /></el-form-item>
          <el-form-item label="年龄标签"><el-input v-model="landing.text.ageLabel" /></el-form-item>
          <el-form-item label="年龄段选项">
            <el-input v-model="ageRangesText" type="textarea" :rows="4" placeholder="每行一个选项" />
          </el-form-item>
          <el-form-item label="缺牙标签"><el-input v-model="landing.text.missingTeethLabel" /></el-form-item>
          <el-form-item label="缺牙情况选项">
            <el-input v-model="missingTeethTypesText" type="textarea" :rows="5" placeholder="每行一个选项" />
          </el-form-item>
          <el-form-item label="门店标签"><el-input v-model="landing.text.clinicLabel" /></el-form-item>
          <el-form-item label="门店占位"><el-input v-model="landing.text.clinicPlaceholder" /></el-form-item>
          <el-form-item label="备注标签"><el-input v-model="landing.text.remarkLabel" /></el-form-item>
          <el-form-item label="备注占位">
            <el-input v-model="landing.text.remarkPlaceholder" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="隐私勾选文案"><el-input v-model="landing.text.privacyCheckboxText" /></el-form-item>
          <el-form-item label="隐私协议">
            <div class="field-row">
              <el-input class="row-input" v-model="landing.privacyAgreement" type="textarea" :rows="4" />
              <el-switch class="inline-switch" v-model="landing.display.privacyAgreement" active-text="显示" inactive-text="隐藏" />
            </div>
          </el-form-item>
          <el-form-item label="提交按钮"><el-input v-model="landing.text.submitButtonText" /></el-form-item>
          <el-form-item label="提交后提示">
            <div class="field-row">
              <el-input class="row-input" v-model="landing.text.noticeText" />
              <el-switch class="inline-switch" v-model="landing.display.noticeText" active-text="显示" inactive-text="隐藏" />
            </div>
          </el-form-item>

          <el-divider content-position="left">授权弹窗与底部</el-divider>
          <el-form-item label="弹窗标题"><el-input v-model="landing.text.authModalTitle" /></el-form-item>
          <el-form-item label="弹窗说明">
            <el-input v-model="landing.text.authModalDescription" type="textarea" :rows="3" />
          </el-form-item>
          <el-form-item label="弹窗授权按钮"><el-input v-model="landing.text.authModalButtonText" /></el-form-item>
          <el-form-item label="弹窗取消按钮"><el-input v-model="landing.text.authModalCancelText" /></el-form-item>
          <el-form-item label="底部区域">
            <el-switch v-model="landing.display.footerSection" active-text="显示" inactive-text="隐藏" />
          </el-form-item>
          <el-form-item label="机构名称">
            <div class="field-row">
              <el-input class="row-input" v-model="landing.institutionName" />
              <el-switch class="inline-switch" v-model="landing.display.institutionName" active-text="显示" inactive-text="隐藏" />
            </div>
          </el-form-item>
          <el-form-item label="备案号">
            <div class="field-row">
              <el-input class="row-input" v-model="landing.filingNo" />
              <el-switch class="inline-switch" v-model="landing.display.filingNo" active-text="显示" inactive-text="隐藏" />
            </div>
          </el-form-item>
          <el-form-item label="底部说明">
            <div class="field-row">
              <el-input class="row-input" v-model="landing.footerText" />
              <el-switch class="inline-switch" v-model="landing.display.footerText" active-text="显示" inactive-text="隐藏" />
            </div>
          </el-form-item>
          <el-form-item label="客服电话标签"><el-input v-model="landing.text.customerServiceLabel" /></el-form-item>
          <el-form-item label="客服电话">
            <div class="field-row">
              <el-input class="row-input" v-model="landing.customerServicePhone" />
              <el-switch class="inline-switch" v-model="landing.display.customerServicePhone" active-text="显示" inactive-text="隐藏" />
            </div>
          </el-form-item>
          <el-form-item label="我的挂号按钮">
            <div class="field-row">
              <el-input class="row-input" v-model="landing.text.myAppointmentsButtonText" />
              <el-switch class="inline-switch" v-model="landing.display.myAppointmentsButton" active-text="显示" inactive-text="隐藏" />
            </div>
          </el-form-item>
          <el-form-item label="公众号模板 ID"><el-input v-model="landing.officialAccountTemplateId" /></el-form-item>
          <el-form-item label="订阅模板 ID"><el-input v-model="landing.miniSubscribeTemplateId" /></el-form-item>
          <el-form-item class="save-config-row">
            <el-button type="primary" @click="saveLanding">保存落地页配置</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="门店配置">
        <div class="toolbar">
          <el-button type="primary" @click="openClinic()">新增门店</el-button>
        </div>
        <el-table :data="clinics">
          <el-table-column prop="name" label="门店名称" />
          <el-table-column prop="address" label="地址" />
          <el-table-column prop="phone" label="电话" />
          <el-table-column prop="status" label="状态" width="120">
            <template #default="{ row }"><el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">{{ row.status === 'ACTIVE' ? '启用' : '停用' }}</el-tag></template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button text type="primary" @click="openClinic(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>

  <el-dialog v-model="clinicDialog" title="门店信息" width="520px">
    <el-form label-width="90px">
      <el-form-item label="门店名称"><el-input v-model="clinicForm.name" /></el-form-item>
      <el-form-item label="地址"><el-input v-model="clinicForm.address" /></el-form-item>
      <el-form-item label="电话"><el-input v-model="clinicForm.phone" /></el-form-item>
      <el-form-item label="状态">
        <el-select v-model="clinicForm.status" style="width: 180px">
          <el-option label="启用" value="ACTIVE" />
          <el-option label="停用" value="DISABLED" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="clinicDialog = false">取消</el-button>
      <el-button type="primary" @click="saveClinic">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  ClinicItem,
  createClinic,
  getClinics,
  getConfigs,
  updateClinic,
  updateConfigs,
  uploadLandingAsset
} from '../api/admin';

const defaultText = {
  logoText: '牙',
  brandSubtitle: '官方挂号咨询服务',
  brandBadgeText: '预约咨询',
  originalPriceLabel: '原价',
  activityPriceLabel: '活动价',
  nameLabel: '您的姓名',
  namePlaceholder: '请输入',
  phoneLabel: '您的电话',
  phoneAuthorizedPrefix: '已授权：',
  phoneAuthorizeButtonText: '点击授权手机号',
  ageLabel: '您的年龄',
  missingTeethLabel: '缺牙情况',
  clinicLabel: '期望门店',
  clinicPlaceholder: '请选择',
  remarkLabel: '备注',
  remarkPlaceholder: '可填写方便联系时间或其他需求',
  privacyCheckboxText: '我已阅读并同意隐私协议',
  submitButtonText: '点击丨领取种牙优惠名额',
  noticeText: '由于咨询人数较多，我们会在24小时内联系您。',
  myAppointmentsButtonText: '查看我的挂号',
  authModalTitle: '授权手机号',
  authModalDescription: '手机号由微信授权后传给后端加密保存，页面不会让您手动填写完整号码。',
  authModalButtonText: '授权手机号',
  authModalCancelText: '先浏览页面',
  customerServiceLabel: '客服电话'
};

const defaultDisplay = {
  brandSection: true,
  logo: true,
  brandName: true,
  brandSubtitle: true,
  brandBadge: true,
  bannerSection: true,
  subsidyText: true,
  priceCard: true,
  includedItems: true,
  formTopImages: true,
  formTitle: true,
  privacyAgreement: true,
  noticeText: true,
  footerSection: true,
  institutionName: true,
  filingNo: true,
  footerText: true,
  customerServicePhone: true,
  myAppointmentsButton: true
};

const landing = ref<Record<string, any> | null>(null);
const clinics = ref<ClinicItem[]>([]);
const clinicDialog = ref(false);
const clinicForm = reactive({ id: '', name: '', address: '', phone: '', status: 'ACTIVE' });

const formTopImagesText = computed({
  get: () => (landing.value?.formTopImages || []).join('\n'),
  set: (value: string) => {
    if (landing.value) landing.value.formTopImages = toLines(value);
  }
});

const includedItemsText = computed({
  get: () => (landing.value?.includedItems || []).join('\n'),
  set: (value: string) => {
    if (landing.value) landing.value.includedItems = toLines(value);
  }
});

const ageRangesText = computed({
  get: () => (landing.value?.formOptions?.ageRanges || []).join('\n'),
  set: (value: string) => {
    if (landing.value) landing.value.formOptions.ageRanges = toLines(value);
  }
});

const missingTeethTypesText = computed({
  get: () => (landing.value?.formOptions?.missingTeethTypes || []).join('\n'),
  set: (value: string) => {
    if (landing.value) landing.value.formOptions.missingTeethTypes = toLines(value);
  }
});

async function load() {
  const configs = await getConfigs();
  const row = configs.find((item) => item.key === 'landingPage');
  const value = (row?.valueJson || {}) as Record<string, any>;
  landing.value = {
    brandName: '',
    activityTitle: '',
    originalPrice: '',
    activityPrice: '',
    subsidyText: '',
    includedItems: [],
    filingNo: '',
    institutionName: '',
    privacyAgreement: '',
    customerServicePhone: '',
    footerText: '',
    officialAccountTemplateId: '',
    miniSubscribeTemplateId: '',
    formOptions: {
      ageRanges: ['40岁以下', '40-50岁', '50-60岁', '60岁以上'],
      missingTeethTypes: ['单颗缺失', '多颗缺失', '半口缺失', '全口缺失', '不确定']
    },
    ...value,
    formTopImages: Array.isArray(value.formTopImages) ? value.formTopImages : [],
    display: {
      ...defaultDisplay,
      ...(value.display || {})
    },
    text: {
      ...defaultText,
      ...(value.text || {})
    }
  };
  clinics.value = await getClinics();
}

async function uploadFormTopImage(options: any) {
  try {
    const result = await uploadLandingAsset(options.file as File);
    if (landing.value) {
      landing.value.formTopImages = [result.url];
      landing.value.display.formTopImages = true;
    }
    options.onSuccess?.(result);
    ElMessage.success('顶部图片已替换，请点击底部“保存落地页配置”后生效');
  } catch (error) {
    options.onError?.(error);
  }
}

function beforeImageUpload(file: File) {
  const isImage = file.type.startsWith('image/');
  const isLt5M = file.size / 1024 / 1024 <= 5;
  if (!isImage) ElMessage.warning('请上传图片文件');
  if (!isLt5M) ElMessage.warning('单张图片不能超过 5MB');
  return isImage && isLt5M;
}

function removeFormTopImage(index: number) {
  if (!landing.value) return;
  landing.value.formTopImages.splice(index, 1);
}

async function saveLanding() {
  if (!landing.value) return;
  landing.value.formTopImages = toLines(formTopImagesText.value);
  landing.value.display = {
    ...defaultDisplay,
    ...(landing.value.display || {})
  };
  await updateConfigs([{ key: 'landingPage', valueJson: landing.value, description: '小程序挂号落地页配置' }]);
  ElMessage.success('落地页配置已保存');
}

function openClinic(row?: ClinicItem) {
  clinicForm.id = row?.id || '';
  clinicForm.name = row?.name || '';
  clinicForm.address = row?.address || '';
  clinicForm.phone = row?.phone || '';
  clinicForm.status = row?.status || 'ACTIVE';
  clinicDialog.value = true;
}

async function saveClinic() {
  if (!clinicForm.name.trim()) {
    ElMessage.warning('请填写门店名称');
    return;
  }
  const data = {
    name: clinicForm.name.trim(),
    address: clinicForm.address.trim(),
    phone: clinicForm.phone.trim(),
    status: clinicForm.status
  };
  if (clinicForm.id) {
    await updateClinic(clinicForm.id, data);
  } else {
    await createClinic(data);
  }
  clinicDialog.value = false;
  ElMessage.success('门店已保存');
  clinics.value = await getClinics();
}

function toLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
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

.config-form {
  max-width: 1040px;
}

.config-form :deep(.el-divider) {
  margin: 32px 0 22px;
}

.config-form :deep(.el-divider__text) {
  padding: 0 12px 0 0;
  background: #ffffff;
  font-size: 15px;
}

.config-form :deep(.el-form-item) {
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px solid #f0f3f2;
}

.config-form :deep(.el-form-item:last-child) {
  border-bottom: 0;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.row-input {
  flex: 1;
}

.inline-switch {
  flex: 0 0 auto;
  min-width: 118px;
}

.help-text {
  margin-left: 12px;
  color: var(--admin-text-muted);
  font-size: 13px;
}

.image-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  width: 100%;
}

.image-item {
  overflow: hidden;
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  background: #fff;
}

.image-thumb {
  display: block;
  width: 100%;
  height: 110px;
}

.image-actions {
  display: flex;
  justify-content: center;
  padding: 6px;
}

.save-config-row {
  position: sticky;
  z-index: 5;
  bottom: 0;
  margin: 28px 0 0 !important;
  padding: 14px 0 !important;
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid var(--admin-border) !important;
  border-bottom: 0 !important;
}

@media (max-width: 720px) {
  .config-form :deep(.el-form-item) { display: block; }
  .config-form :deep(.el-form-item__label) { display: block; width: auto !important; margin-bottom: 7px; text-align: left; }
  .field-row { align-items: flex-start; flex-direction: column; }
  .inline-switch { min-width: auto; }
  .help-text { display: block; margin: 8px 0 0; }
}
</style>
