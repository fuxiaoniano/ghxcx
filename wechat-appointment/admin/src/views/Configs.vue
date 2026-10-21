<template>
  <div class="page-heading">
    <h1 class="page-title">留资页面</h1>
    <p>管理独立挂号页、表单文案和门店信息</p>
  </div>

  <div class="content-panel">
    <el-tabs>
      <el-tab-pane label="挂号落地页">
        <template v-if="landingView === 'list'">
          <section class="page-list-section">
            <div class="manager-head">
              <div>
                <h2>挂号落地页</h2>
                <p>每个页面独立保存内容和永久链接，点击编辑进入详细配置。</p>
              </div>
              <el-button :icon="Plus" type="primary" @click="openCreate(false)">新建页面</el-button>
            </div>

            <el-alert
              class="list-tip"
              type="info"
              :closable="false"
              show-icon
              title="删除页面会清除该页全部配置和永久链接，已经提交的历史挂号不会被删除。"
            />

            <div class="landing-table-wrap">
              <el-table v-loading="pageLoading" :data="pageItems" row-key="id">
                <el-table-column label="页面名称" min-width="190">
                  <template #default="{ row }">
                    <div class="page-name-cell">
                      <strong>{{ row.name }}</strong>
                      <el-tag v-if="row.isDefault" size="small" type="success">默认页</el-tag>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="pageKey" label="页面标识" min-width="210">
                  <template #default="{ row }"><code class="page-key">{{ row.pageKey }}</code></template>
                </el-table-column>
                <el-table-column label="状态" width="90">
                  <template #default="{ row }">
                    <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">
                      {{ row.status === 'ACTIVE' ? '启用' : '停用' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="appointmentCount" label="历史挂号" width="100" align="center" />
                <el-table-column label="更新时间" min-width="170">
                  <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
                </el-table-column>
                <el-table-column label="复制永久链接" min-width="250">
                  <template #default="{ row }">
                    <div class="table-link-actions">
                      <el-button text type="primary" :icon="CopyDocument" @click="copyText(row.links.h5)">H5</el-button>
                      <el-button text type="primary" :icon="CopyDocument" @click="copyText(row.links.miniProgramPath)">PagePath</el-button>
                      <el-button text type="primary" :icon="CopyDocument" @click="copyText(row.links.officialAccount)">公众号</el-button>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="操作" fixed="right" width="340">
                  <template #default="{ row }">
                    <div class="row-actions">
                      <el-button text type="primary" :icon="Edit" @click="editPage(row.id)">编辑</el-button>
                      <el-button text :icon="DocumentCopy" @click="openCreate(true, row)">复制</el-button>
                      <el-button v-if="!row.isDefault" text @click="makeDefault(row)">设为默认</el-button>
                      <el-button
                        text
                        type="danger"
                        :icon="Delete"
                        :disabled="pageItems.length <= 1"
                        :loading="deletingPageId === row.id"
                        @click="removeLandingPage(row)"
                      >删除</el-button>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </section>
        </template>

        <template v-else>
          <section class="page-manager">
            <div class="manager-head editor-head">
              <div class="editor-heading">
                <el-button text :icon="ArrowLeft" @click="backToList">返回列表</el-button>
                <div>
                  <h2>{{ landingMeta?.name || '编辑挂号页' }}</h2>
                  <p>修改当前页面的展示内容、表单选项和永久链接。</p>
                </div>
              </div>
              <div class="manager-actions">
                <el-button v-if="landingMeta && !landingMeta.isDefault" @click="makeDefault(landingMeta)">设为默认页</el-button>
                <el-tag v-else-if="landingMeta?.isDefault" type="success">当前默认页</el-tag>
                <el-button :icon="DocumentCopy" :disabled="!landingMeta" @click="openCreate(true, landingMeta || undefined)">复制页面</el-button>
                <el-button
                  v-if="landingMeta"
                  type="danger"
                  plain
                  :icon="Delete"
                  :disabled="pageItems.length <= 1"
                  :loading="deletingPageId === landingMeta.id"
                  @click="removeLandingPage(landingMeta)"
                >删除页面</el-button>
              </div>
            </div>

            <div v-if="landingMeta" class="page-meta-grid">
              <label class="meta-field">
                <span>页面名称</span>
                <el-input v-model="landingMeta.name" maxlength="120" show-word-limit />
              </label>
              <label class="meta-field">
                <span>对外状态</span>
                <el-select v-model="landingMeta.status" :disabled="landingMeta.isDefault">
                  <el-option label="启用" value="ACTIVE" />
                  <el-option label="停用" value="DISABLED" />
                </el-select>
              </label>
            </div>

            <div v-if="landingMeta" class="link-list">
              <div class="link-row">
                <div><strong>H5 永久链接</strong><span>公众号原文、短信或网页广告</span></div>
                <el-input :model-value="landingMeta.links.h5" readonly />
                <el-tooltip content="复制 H5 永久链接"><el-button :icon="CopyDocument" @click="copyText(landingMeta.links.h5)">复制</el-button></el-tooltip>
              </div>
              <div class="link-row">
                <div><strong>小程序 PagePath</strong><span>小程序菜单、广告或分享</span></div>
                <el-input :model-value="landingMeta.links.miniProgramPath" readonly />
                <el-tooltip content="复制小程序 PagePath"><el-button :icon="CopyDocument" @click="copyText(landingMeta.links.miniProgramPath)">复制</el-button></el-tooltip>
              </div>
              <div class="link-row">
                <div><strong>公众号绑定链接</strong><span>进入小程序并绑定公众号身份</span></div>
                <el-input :model-value="landingMeta.links.officialAccount" readonly />
                <el-tooltip content="复制公众号绑定链接"><el-button :icon="CopyDocument" @click="copyText(landingMeta.links.officialAccount)">复制</el-button></el-tooltip>
              </div>
            </div>
          </section>

          <el-alert
            class="page-tip"
            type="info"
            :closable="false"
            show-icon
            title="保存后 H5 刷新立即生效；小程序用户重新进入页面即可读取最新内容。"
          />
          <el-alert
            class="page-tip"
            type="warning"
            :closable="false"
            show-icon
            title="H5 默认手动填写并校验 11 位手机号；小程序继续使用微信手机号授权。"
          />

          <el-skeleton v-if="pageLoading && !landing" :rows="8" animated />
          <el-form v-else-if="landing && landingMeta" label-width="150px" class="config-form">
          <el-divider content-position="left">顶部品牌</el-divider>
          <el-form-item label="对外显示">
            <el-switch v-model="landing.display.brandSection" active-text="显示" inactive-text="隐藏" />
          </el-form-item>
          <el-form-item label="品牌 HTML 内容">
            <HtmlEditor v-model="landing.brandHtml" />
          </el-form-item>

          <el-divider content-position="left">活动与价格</el-divider>
          <el-form-item label="对外显示">
            <el-switch v-model="landing.display.bannerSection" active-text="显示" inactive-text="隐藏" />
          </el-form-item>
          <el-form-item label="活动 HTML 内容">
            <HtmlEditor v-model="landing.activityHtml" />
          </el-form-item>
          <el-form-item label="表单标题">
            <div class="field-row">
              <el-input class="row-input" v-model="landing.activityTitle" />
              <el-switch class="inline-switch" v-model="landing.display.formTitle" active-text="显示" inactive-text="隐藏" />
            </div>
          </el-form-item>

          <el-divider content-position="left">分享设置</el-divider>
          <el-form-item label="分享标题"><el-input v-model="landing.shareTitle" maxlength="120" /></el-form-item>
          <el-form-item label="分享图片地址"><el-input v-model="landing.shareImageUrl" placeholder="留空时使用顶部第一张图片" /></el-form-item>

          <el-divider content-position="left">表单上方图片</el-divider>
          <el-form-item label="对外显示">
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
            <span class="help-text">jpg、png、webp、gif，单张不超过 5MB。</span>
          </el-form-item>
          <el-form-item label="图片地址">
            <el-input v-model="formTopImagesText" type="textarea" :rows="3" placeholder="每行一个图片地址" />
          </el-form-item>
          <el-form-item v-if="landing.formTopImages.length" label="图片预览">
            <div class="image-list">
              <div v-for="(url, index) in landing.formTopImages" :key="url + index" class="image-item">
                <el-image :src="url" fit="cover" class="image-thumb" :preview-src-list="landing.formTopImages" />
                <div class="image-actions"><el-button text type="danger" @click="removeFormTopImage(index)">删除</el-button></div>
              </div>
            </div>
          </el-form-item>

          <el-divider content-position="left">表单内容</el-divider>
          <el-form-item label="姓名标签"><el-input v-model="landing.text.nameLabel" /></el-form-item>
          <el-form-item label="姓名占位"><el-input v-model="landing.text.namePlaceholder" /></el-form-item>
          <el-form-item label="电话标签"><el-input v-model="landing.text.phoneLabel" /></el-form-item>
          <el-form-item label="小程序授权后前缀"><el-input v-model="landing.text.phoneAuthorizedPrefix" /></el-form-item>
          <el-form-item label="小程序手机号按钮"><el-input v-model="landing.text.phoneAuthorizeButtonText" /></el-form-item>
          <el-form-item label="年龄标签"><el-input v-model="landing.text.ageLabel" /></el-form-item>
          <el-form-item label="年龄段选项"><el-input v-model="ageRangesText" type="textarea" :rows="4" placeholder="每行一个选项" /></el-form-item>
          <el-form-item label="缺牙标签"><el-input v-model="landing.text.missingTeethLabel" /></el-form-item>
          <el-form-item label="缺牙情况选项"><el-input v-model="missingTeethTypesText" type="textarea" :rows="5" placeholder="每行一个选项" /></el-form-item>
          <el-form-item label="门店标签"><el-input v-model="landing.text.clinicLabel" /></el-form-item>
          <el-form-item label="门店占位"><el-input v-model="landing.text.clinicPlaceholder" /></el-form-item>
          <el-form-item label="备注标签"><el-input v-model="landing.text.remarkLabel" /></el-form-item>
          <el-form-item label="备注占位"><el-input v-model="landing.text.remarkPlaceholder" type="textarea" :rows="2" /></el-form-item>
          <el-form-item label="隐私勾选文案"><el-input v-model="landing.text.privacyCheckboxText" /></el-form-item>
          <el-form-item label="隐私协议">
            <div class="field-row">
              <el-input class="row-input" v-model="landing.privacyAgreement" type="textarea" :rows="4" />
              <el-switch class="inline-switch" v-model="landing.display.privacyAgreement" active-text="显示" inactive-text="隐藏" />
            </div>
          </el-form-item>
          <el-form-item label="提交按钮"><el-input v-model="landing.text.submitButtonText" /></el-form-item>
          <el-form-item label="提交提示">
            <div class="field-row">
              <el-input class="row-input" v-model="landing.text.noticeText" />
              <el-switch class="inline-switch" v-model="landing.display.noticeText" active-text="显示" inactive-text="隐藏" />
            </div>
          </el-form-item>

          <el-divider content-position="left">小程序授权弹窗</el-divider>
          <el-form-item label="弹窗标题"><el-input v-model="landing.text.authModalTitle" /></el-form-item>
          <el-form-item label="弹窗说明"><el-input v-model="landing.text.authModalDescription" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="授权按钮"><el-input v-model="landing.text.authModalButtonText" /></el-form-item>
          <el-form-item label="取消按钮"><el-input v-model="landing.text.authModalCancelText" /></el-form-item>

          <el-divider content-position="left">表单底部</el-divider>
          <el-form-item label="底部区域"><el-switch v-model="landing.display.footerSection" active-text="显示" inactive-text="隐藏" /></el-form-item>
          <el-form-item label="机构名称">
            <div class="field-row"><el-input class="row-input" v-model="landing.institutionName" /><el-switch class="inline-switch" v-model="landing.display.institutionName" active-text="显示" inactive-text="隐藏" /></div>
          </el-form-item>
          <el-form-item label="备案号">
            <div class="field-row"><el-input class="row-input" v-model="landing.filingNo" /><el-switch class="inline-switch" v-model="landing.display.filingNo" active-text="显示" inactive-text="隐藏" /></div>
          </el-form-item>
          <el-form-item label="底部说明">
            <div class="field-row"><el-input class="row-input" v-model="landing.footerText" /><el-switch class="inline-switch" v-model="landing.display.footerText" active-text="显示" inactive-text="隐藏" /></div>
          </el-form-item>
          <el-form-item label="客服电话标签"><el-input v-model="landing.text.customerServiceLabel" /></el-form-item>
          <el-form-item label="客服电话">
            <div class="field-row"><el-input class="row-input" v-model="landing.customerServicePhone" /><el-switch class="inline-switch" v-model="landing.display.customerServicePhone" active-text="显示" inactive-text="隐藏" /></div>
          </el-form-item>
          <el-form-item label="我的挂号按钮">
            <div class="field-row"><el-input class="row-input" v-model="landing.text.myAppointmentsButtonText" /><el-switch class="inline-switch" v-model="landing.display.myAppointmentsButton" active-text="显示" inactive-text="隐藏" /></div>
          </el-form-item>
          <el-form-item label="公众号模板 ID"><el-input v-model="landing.officialAccountTemplateId" /></el-form-item>
          <el-form-item label="订阅模板 ID"><el-input v-model="landing.miniSubscribeTemplateId" /></el-form-item>
          <el-form-item class="save-config-row">
            <el-button type="primary" :loading="saving" @click="saveLanding">保存当前页面</el-button>
          </el-form-item>
          </el-form>
        </template>
      </el-tab-pane>

      <el-tab-pane label="门店配置">
        <div class="toolbar"><el-button type="primary" :icon="Plus" @click="openClinic()">新增门店</el-button></div>
        <el-table :data="clinics">
          <el-table-column prop="name" label="门店名称" />
          <el-table-column prop="address" label="地址" />
          <el-table-column prop="phone" label="电话" />
          <el-table-column prop="status" label="状态" width="120">
            <template #default="{ row }"><el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">{{ row.status === 'ACTIVE' ? '启用' : '停用' }}</el-tag></template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{ row }"><el-button text type="primary" @click="openClinic(row)">编辑</el-button></template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>

  <el-dialog v-model="createDialog" :title="cloneCurrent ? '复制挂号页' : '新建挂号页'" width="480px">
    <el-form label-width="90px">
      <el-form-item label="页面名称"><el-input v-model="newPageName" maxlength="120" autofocus /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="createDialog = false">取消</el-button>
      <el-button type="primary" :loading="creating" @click="submitCreatePage">创建</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="clinicDialog" title="门店信息" width="520px">
    <el-form label-width="90px">
      <el-form-item label="门店名称"><el-input v-model="clinicForm.name" /></el-form-item>
      <el-form-item label="地址"><el-input v-model="clinicForm.address" /></el-form-item>
      <el-form-item label="电话"><el-input v-model="clinicForm.phone" /></el-form-item>
      <el-form-item label="状态">
        <el-select v-model="clinicForm.status" style="width:180px"><el-option label="启用" value="ACTIVE" /><el-option label="停用" value="DISABLED" /></el-select>
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
import { ArrowLeft, CopyDocument, Delete, DocumentCopy, Edit, Plus } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import HtmlEditor from '../components/HtmlEditor.vue';
import {
  ClinicItem,
  LandingPageDetail,
  LandingPageItem,
  createClinic,
  createLandingPage,
  deleteLandingPage,
  getClinics,
  getLandingPage,
  getLandingPages,
  setDefaultLandingPage,
  updateClinic,
  updateLandingPage,
  uploadLandingAsset
} from '../api/admin';

const defaultText = {
  logoText: '牙', brandSubtitle: '官方挂号咨询服务', brandBadgeText: '预约咨询', originalPriceLabel: '原价', activityPriceLabel: '活动价',
  nameLabel: '您的姓名', namePlaceholder: '请输入', phoneLabel: '您的电话', phoneAuthorizedPrefix: '已授权：', phoneAuthorizeButtonText: '点击授权手机号',
  ageLabel: '您的年龄', missingTeethLabel: '缺牙情况', clinicLabel: '期望门店', clinicPlaceholder: '请选择', remarkLabel: '备注',
  remarkPlaceholder: '可填写方便联系时间或其他需求', privacyCheckboxText: '我已阅读并同意隐私协议', submitButtonText: '点击丨领取种牙优惠名额',
  noticeText: '由于咨询人数较多，我们会在24小时内联系您。', myAppointmentsButtonText: '查看我的挂号', authModalTitle: '授权手机号',
  authModalDescription: '手机号由微信授权后传给后端加密保存。', authModalButtonText: '授权手机号', authModalCancelText: '先浏览页面', customerServiceLabel: '客服电话'
};

const defaultDisplay = {
  brandSection: true, logo: true, brandName: true, brandSubtitle: true, brandBadge: true, bannerSection: true, subsidyText: true,
  priceCard: true, includedItems: true, formTopImages: true, formTitle: true, privacyAgreement: true, noticeText: true,
  footerSection: true, institutionName: true, filingNo: true, footerText: true, customerServicePhone: true, myAppointmentsButton: true
};

const pageItems = ref<LandingPageItem[]>([]);
const selectedPageId = ref('');
const landingMeta = ref<LandingPageDetail | null>(null);
const landing = ref<Record<string, any> | null>(null);
const landingView = ref<'list' | 'edit'>('list');
const pageLoading = ref(false);
const saving = ref(false);
const creating = ref(false);
const deletingPageId = ref('');
const createDialog = ref(false);
const cloneCurrent = ref(false);
const cloneSourcePageId = ref('');
const newPageName = ref('');
const clinics = ref<ClinicItem[]>([]);
const clinicDialog = ref(false);
const clinicForm = reactive({ id: '', name: '', address: '', phone: '', status: 'ACTIVE' });

const formTopImagesText = computed({
  get: () => (landing.value?.formTopImages || []).join('\n'),
  set: (value: string) => { if (landing.value) landing.value.formTopImages = toLines(value); }
});
const ageRangesText = computed({
  get: () => (landing.value?.formOptions?.ageRanges || []).join('\n'),
  set: (value: string) => { if (landing.value) landing.value.formOptions.ageRanges = toLines(value); }
});
const missingTeethTypesText = computed({
  get: () => (landing.value?.formOptions?.missingTeethTypes || []).join('\n'),
  set: (value: string) => { if (landing.value) landing.value.formOptions.missingTeethTypes = toLines(value); }
});

function normalizeLanding(value: Record<string, any>) {
  return {
    brandName: '', brandHtml: '', activityTitle: '', activityHtml: '', originalPrice: '', activityPrice: '', subsidyText: '', includedItems: [],
    filingNo: '', institutionName: '', privacyAgreement: '', customerServicePhone: '', footerText: '', shareTitle: '', shareImageUrl: '',
    officialAccountTemplateId: '', miniSubscribeTemplateId: '',
    ...value,
    formTopImages: Array.isArray(value.formTopImages) ? value.formTopImages : [],
    display: { ...defaultDisplay, ...(value.display || {}) },
    text: { ...defaultText, ...(value.text || {}) },
    formOptions: {
      ageRanges: Array.isArray(value.formOptions?.ageRanges) ? value.formOptions.ageRanges : ['40岁以下', '40-50岁', '50-60岁', '60岁以上'],
      missingTeethTypes: Array.isArray(value.formOptions?.missingTeethTypes) ? value.formOptions.missingTeethTypes : ['单颗缺失', '多颗缺失', '半口缺失', '全口缺失', '不确定']
    }
  };
}

async function load() {
  pageLoading.value = true;
  try {
    const [pages, clinicRows] = await Promise.all([getLandingPages(), getClinics()]);
    pageItems.value = pages;
    clinics.value = clinicRows;
  } finally {
    pageLoading.value = false;
  }
}

async function refreshLandingPages() {
  pageItems.value = await getLandingPages();
}

async function editPage(id: string) {
  selectedPageId.value = id;
  landingView.value = 'edit';
  landingMeta.value = null;
  landing.value = null;
  await loadLandingPage(id);
}

function backToList() {
  landingView.value = 'list';
  selectedPageId.value = '';
  landingMeta.value = null;
  landing.value = null;
}

async function loadLandingPage(id: string) {
  if (!id) return;
  pageLoading.value = true;
  try {
    const detail = await getLandingPage(id);
    landingMeta.value = detail;
    landing.value = normalizeLanding(detail.config || {});
  } finally {
    pageLoading.value = false;
  }
}

function openCreate(clone: boolean, source?: LandingPageItem) {
  cloneCurrent.value = clone;
  cloneSourcePageId.value = clone ? source?.id || landingMeta.value?.id || '' : '';
  newPageName.value = clone && source ? `${source.name} - 副本` : '';
  createDialog.value = true;
}

async function submitCreatePage() {
  const name = newPageName.value.trim();
  if (!name) return ElMessage.warning('请填写页面名称');
  creating.value = true;
  try {
    const page = await createLandingPage({ name, cloneFromId: cloneCurrent.value ? cloneSourcePageId.value : undefined });
    await refreshLandingPages();
    createDialog.value = false;
    ElMessage.success('独立挂号页已创建');
    await editPage(page.id);
  } finally {
    creating.value = false;
  }
}

async function makeDefault(target: LandingPageItem) {
  const page = await setDefaultLandingPage(target.id);
  await refreshLandingPages();
  if (landingMeta.value?.id === target.id) landingMeta.value = page;
  ElMessage.success('默认挂号页已更新，旧链接将打开此页面');
}

async function removeLandingPage(page: LandingPageItem) {
  if (pageItems.value.length <= 1) {
    ElMessage.warning('至少需要保留一个挂号落地页');
    return;
  }

  const appointmentText = page.appointmentCount
    ? `该页面已有 ${page.appointmentCount} 条历史挂号，挂号资料会完整保留。`
    : '该页面目前没有历史挂号。';
  try {
    await ElMessageBox.confirm(
      `${appointmentText} 删除后页面配置及永久链接将无法恢复。`,
      `确认删除“${page.name}”？`,
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消'
      }
    );
  } catch (action) {
    if (action === 'cancel' || action === 'close') return;
    throw action;
  }

  deletingPageId.value = page.id;
  try {
    const result = await deleteLandingPage(page.id);
    await refreshLandingPages();
    if (selectedPageId.value === page.id) backToList();
    const replacementText = result.newDefaultPage ? `“${result.newDefaultPage.name}”已自动设为默认页。` : '';
    ElMessage.success(`页面已删除，${result.preservedAppointmentCount} 条历史挂号已保留。${replacementText}`);
  } finally {
    deletingPageId.value = '';
  }
}

async function saveLanding() {
  if (!landing.value || !landingMeta.value) return;
  const name = landingMeta.value.name.trim();
  if (!name) return ElMessage.warning('请填写页面名称');
  landing.value.formTopImages = toLines(formTopImagesText.value);
  if (!landing.value.formOptions.ageRanges.length || !landing.value.formOptions.missingTeethTypes.length) {
    return ElMessage.warning('年龄段和缺牙情况至少各保留一个选项');
  }
  saving.value = true;
  try {
    const page = await updateLandingPage(landingMeta.value.id, {
      name,
      status: landingMeta.value.status,
      config: landing.value
    });
    landingMeta.value = page;
    landing.value = normalizeLanding(page.config || {});
    await refreshLandingPages();
    ElMessage.success('当前挂号页已保存');
  } finally {
    saving.value = false;
  }
}

async function uploadFormTopImage(options: any) {
  try {
    const result = await uploadLandingAsset(options.file as File);
    if (landing.value) {
      landing.value.formTopImages = [result.url];
      landing.value.display.formTopImages = true;
      if (!landing.value.shareImageUrl) landing.value.shareImageUrl = result.url;
    }
    options.onSuccess?.(result);
    ElMessage.success('图片已上传，请保存当前页面');
  } catch (error) {
    options.onError?.(error);
  }
}

function beforeImageUpload(file: File) {
  const valid = file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024;
  if (!valid) ElMessage.warning('请上传不超过 5MB 的图片文件');
  return valid;
}

function removeFormTopImage(index: number) {
  landing.value?.formTopImages.splice(index, 1);
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    ElMessage.success('已复制');
  } catch {
    const input = document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
    ElMessage.success('已复制');
  }
}

function openClinic(row?: ClinicItem) {
  clinicForm.id = row?.id || ''; clinicForm.name = row?.name || ''; clinicForm.address = row?.address || '';
  clinicForm.phone = row?.phone || ''; clinicForm.status = row?.status || 'ACTIVE'; clinicDialog.value = true;
}

async function saveClinic() {
  if (!clinicForm.name.trim()) return ElMessage.warning('请填写门店名称');
  const data = { name: clinicForm.name.trim(), address: clinicForm.address.trim(), phone: clinicForm.phone.trim(), status: clinicForm.status };
  if (clinicForm.id) await updateClinic(clinicForm.id, data); else await createClinic(data);
  clinicDialog.value = false;
  clinics.value = await getClinics();
  ElMessage.success('门店已保存');
}

function toLines(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false });
}

onMounted(load);
</script>

<style scoped>
.page-heading { margin-bottom: 18px; }
.page-heading .page-title { margin-bottom: 2px; }
.page-heading p, .manager-head p { margin: 0; color: var(--admin-text-muted); font-size: 13px; }
.page-list-section { min-height: 360px; }
.page-manager { margin-bottom: 20px; padding: 18px; border: 1px solid var(--admin-border); border-radius: 6px; background: #f8faf9; }
.manager-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.manager-head h2 { margin: 0 0 4px; font-size: 17px; }
.manager-actions, .editor-heading { display: flex; align-items: center; gap: 10px; }
.editor-heading { align-items: flex-start; }
.editor-heading > .el-button { margin-top: -6px; }
.list-tip { margin-top: 18px; }
.landing-table-wrap { margin-top: 16px; overflow: hidden; border: 1px solid var(--admin-border); border-radius: 6px; }
.page-name-cell, .table-link-actions, .row-actions { display: flex; align-items: center; gap: 8px; }
.page-name-cell strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.page-key { padding: 4px 7px; border-radius: 4px; background: #f2f5f4; color: #43504b; font-size: 12px; }
.table-link-actions, .row-actions { flex-wrap: nowrap; }
.table-link-actions :deep(.el-button), .row-actions :deep(.el-button) { margin-left: 0; }
.page-meta-grid { display: grid; grid-template-columns: minmax(240px, 1fr) 220px; gap: 14px; margin-top: 16px; }
.meta-field { display: grid; gap: 7px; color: #43504b; font-size: 13px; }
.link-list { display: grid; gap: 10px; margin-top: 18px; }
.link-row { display: grid; grid-template-columns: 190px minmax(0, 1fr) auto; align-items: center; gap: 10px; }
.link-row > div:first-child { display: grid; gap: 2px; }
.link-row strong { font-size: 13px; }
.link-row span { color: var(--admin-text-muted); font-size: 12px; }
.page-tip { margin-bottom: 14px; }
.config-form { max-width: 1040px; }
.config-form :deep(.el-divider) { margin: 32px 0 22px; }
.config-form :deep(.el-divider__text) { padding: 0 12px 0 0; background: #fff; font-size: 15px; }
.config-form :deep(.el-form-item) { padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid #f0f3f2; }
.config-form :deep(.el-form-item:last-child) { border-bottom: 0; }
.field-row { display: flex; align-items: center; gap: 12px; width: 100%; }
.row-input { flex: 1; }
.inline-switch { flex: 0 0 auto; min-width: 118px; }
.help-text { margin-left: 12px; color: var(--admin-text-muted); font-size: 13px; }
.image-list { display: grid; grid-template-columns: repeat(auto-fill,minmax(150px,1fr)); gap: 12px; width: 100%; }
.image-item { overflow: hidden; border: 1px solid var(--admin-border); border-radius: 6px; background: #fff; }
.image-thumb { display: block; width: 100%; height: 110px; }
.image-actions { display: flex; justify-content: center; padding: 6px; }
.save-config-row { position: sticky; z-index: 5; bottom: 0; margin: 28px 0 0!important; padding: 14px 0!important; background: rgba(255,255,255,.96); border-top: 1px solid var(--admin-border)!important; border-bottom: 0!important; }
.toolbar { margin-bottom: 14px; }
@media(max-width:860px){.link-row{grid-template-columns:1fr}.page-meta-grid{grid-template-columns:1fr}.manager-head{flex-direction:column}.manager-actions{width:100%;flex-wrap:wrap}}
@media(max-width:720px){.config-form :deep(.el-form-item){display:block}.config-form :deep(.el-form-item__label){display:block;width:auto!important;margin-bottom:7px;text-align:left}.field-row{align-items:flex-start;flex-direction:column}.inline-switch{min-width:auto}.help-text{display:block;margin:8px 0 0}.editor-heading{width:100%;align-items:flex-start}}
</style>
