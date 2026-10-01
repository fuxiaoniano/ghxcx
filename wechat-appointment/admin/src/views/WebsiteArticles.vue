<template>
  <div class="page-heading">
    <div>
      <h1 class="page-title">口腔资讯</h1>
      <p>编辑发布口腔资讯，并逐篇完善 SEO/GEO 标题、摘要、关键词、作者和来源。</p>
    </div>
    <div class="heading-actions"><el-button @click="generatorVisible = true">交给 Codex 生成</el-button><el-button type="primary" @click="editArticle()"><el-icon><Plus /></el-icon>新增资讯</el-button></div>
  </div>

  <div class="content-panel">
    <el-alert title="发布后的文章会自动进入网站地图并生成 Article 结构化数据；停用文章不会在官网或 Sitemap 中公开。" type="info" :closable="false" show-icon />
    <div class="article-filters">
      <span>官网展示</span>
      <el-radio-group v-model="statusFilter" @change="loadArticles">
        <el-radio-button value="ALL">全部</el-radio-button>
        <el-radio-button value="ACTIVE">展示中</el-radio-button>
        <el-radio-button value="DISABLED">不展示</el-radio-button>
      </el-radio-group>
    </div>
    <el-table class="article-table" :data="articles" row-key="id" empty-text="暂无口腔资讯">
      <el-table-column label="封面" width="90"><template #default="{ row }"><el-image v-if="row.coverUrl" :src="row.coverUrl" class="article-cover" fit="cover" /></template></el-table-column>
      <el-table-column prop="title" label="资讯标题" min-width="260" show-overflow-tooltip />
      <el-table-column label="分类" width="120"><template #default="{ row }"><el-tag size="small">{{ row.category?.name || '未分类' }}</el-tag></template></el-table-column>
      <el-table-column prop="author" label="作者" width="120" show-overflow-tooltip />
      <el-table-column label="发布时间" width="170"><template #default="{ row }">{{ formatTime(row.publishedAt) }}</template></el-table-column>
      <el-table-column prop="viewCount" label="总阅读量" width="100" align="center" />
      <el-table-column label="SEO" width="90"><template #default="{ row }"><el-tag :type="row.seoTitle || row.seoDescription ? 'success' : 'info'">{{ row.seoTitle || row.seoDescription ? '已配置' : '默认' }}</el-tag></template></el-table-column>
      <el-table-column label="官网展示" width="110"><template #default="{ row }"><el-switch :model-value="row.status === 'ACTIVE'" @change="toggleArticle(row, $event)" /></template></el-table-column>
      <el-table-column label="操作" width="246" fixed="right">
        <template #default="{ row }">
          <div class="operation-actions">
            <el-button text @click="previewArticle(row)">预览</el-button>
            <el-button text type="primary" @click="editArticle(row)"><el-icon><Edit /></el-icon>编辑</el-button>
            <el-button text type="danger" @click="removeArticle(row)"><el-icon><Delete /></el-icon>删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogVisible" :title="articleForm.id ? '编辑口腔资讯' : '新增口腔资讯'" width="min(920px, calc(100vw - 32px))" top="4vh">
    <el-form label-width="104px">
      <h2 class="form-section-title">文章内容</h2>
      <el-form-item label="资讯标题" required><el-input v-model="articleForm.title" maxlength="255" show-word-limit /></el-form-item>
      <div class="form-grid">
        <el-form-item label="资讯分类" required><el-select v-model="articleForm.categoryId" placeholder="请选择分类" style="width: 100%"><el-option v-for="category in activeCategories" :key="category.id" :label="category.name" :value="category.id" /></el-select></el-form-item>
        <el-form-item label="作者"><el-input v-model="articleForm.author" maxlength="100" /></el-form-item>
      </div>
      <div class="form-grid">
        <el-form-item label="发布时间"><el-date-picker v-model="articleForm.publishedAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss.SSSZ" placeholder="选择发布时间" style="width: 100%" /></el-form-item>
      </div>
      <el-form-item label="资讯摘要"><el-input v-model="articleForm.digest" type="textarea" :rows="2" maxlength="500" show-word-limit /></el-form-item>
      <el-form-item label="封面图片"><MediaPicker v-model="articleForm.coverUrl" ratio-hint="建议 16:9，推荐 1200×675 像素" /></el-form-item>
      <el-form-item label="资讯正文" required><HtmlEditor v-model="articleForm.contentHtml" /></el-form-item>
      <el-form-item label="原文链接"><el-input v-model="articleForm.originalUrl" placeholder="可选，例如外部参考文章地址" /></el-form-item>

      <h2 class="form-section-title form-section-title--spaced">SEO / GEO 设置</h2>
      <el-form-item label="SEO 标题">
        <el-input v-model="articleForm.seoTitle" maxlength="160" show-word-limit placeholder="留空时使用资讯标题" />
        <div class="field-tip">准确概括主题和读者问题，避免堆砌关键词；用于搜索结果、分享卡片和生成式搜索识别。</div>
      </el-form-item>
      <el-form-item label="SEO 关键词">
        <el-input v-model="articleForm.seoKeywords" maxlength="300" show-word-limit placeholder="多个关键词使用英文逗号分隔" />
      </el-form-item>
      <el-form-item label="SEO 描述">
        <el-input v-model="articleForm.seoDescription" type="textarea" :rows="3" maxlength="300" show-word-limit placeholder="留空时使用资讯摘要" />
        <div class="field-tip">建议用一到两句话直接回答文章解决什么问题，并说明适用人群或边界。</div>
      </el-form-item>
      <el-form-item label="官网展示"><el-switch v-model="articleForm.active" active-text="立即发布" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="saveArticle">保存资讯</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="previewVisible" title="文章预览" width="min(860px, calc(100vw - 32px))" top="4vh">
    <article v-if="previewItem" class="article-preview">
      <p class="article-preview__meta">{{ previewItem.category?.name || '未分类' }} · {{ formatTime(previewItem.publishedAt) }}</p>
      <h1>{{ previewItem.title }}</h1>
      <p v-if="previewItem.digest" class="article-preview__digest">{{ previewItem.digest }}</p>
      <img v-if="previewItem.coverUrl" :src="previewItem.coverUrl" :alt="previewItem.title" class="article-preview__cover" />
      <div class="article-preview__content" v-html="previewItem.contentHtml"></div>
    </article>
  </el-dialog>

  <el-dialog v-model="generatorVisible" title="交给 Codex 生成口腔资讯" width="min(680px, calc(100vw - 32px))">
    <el-alert title="这里会生成一段明确的任务要求。复制后发送到当前 Codex 对话，我会生成完整文章并直接同步为后台草稿，不会未经审核自动发布。" type="info" :closable="false" show-icon />
    <el-form class="generator-form" label-width="92px">
      <el-form-item label="文章分类" required><el-select v-model="generatorForm.categoryId" placeholder="请选择分类" style="width: 100%"><el-option v-for="category in activeCategories" :key="category.id" :label="category.name" :value="category.id" /></el-select></el-form-item>
      <el-form-item label="文章主题" required><el-input v-model="generatorForm.topic" placeholder="例如：儿童第一次看牙需要准备什么" /></el-form-item>
      <el-form-item label="目标读者"><el-input v-model="generatorForm.audience" placeholder="例如：3—8 岁儿童家长" /></el-form-item>
      <el-form-item label="补充要求"><el-input v-model="generatorForm.notes" type="textarea" :rows="3" placeholder="例如：1000 字左右、避免营销表达、列出就医提示" /></el-form-item>
    </el-form>
    <template #footer><el-button @click="generatorVisible = false">关闭</el-button><el-button type="primary" @click="copyGeneratorPrompt">复制生成任务</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { Delete, Edit, Plus } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import HtmlEditor from '../components/HtmlEditor.vue';
import MediaPicker from '../components/MediaPicker.vue';
import {
  createWebsiteArticle, deleteWebsiteArticle, getWebsiteArticle, getWebsiteArticleCategories, getWebsiteArticles, getWebsiteSettings,
  updateWebsiteArticle, type WebsiteArticleCategoryItem, type WebsiteArticleItem, type WebsiteArticlePayload
} from '../api/admin';

const articles = ref<WebsiteArticleItem[]>([]);
const statusFilter = ref<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');
const defaultAuthor = ref('');
const saving = ref(false);
const dialogVisible = ref(false);
const previewVisible = ref(false);
const previewItem = ref<WebsiteArticleItem>();
const generatorVisible = ref(false);
const categories = ref<WebsiteArticleCategoryItem[]>([]);
const activeCategories = computed(() => categories.value.filter((item) => item.status === 'ACTIVE'));
const articleForm = reactive({
  id: '', title: '', categoryId: '', author: '', digest: '', coverUrl: '', contentHtml: '', originalUrl: '', publishedAt: '',
  seoTitle: '', seoKeywords: '', seoDescription: '', active: true
});
const generatorForm = reactive({ categoryId: '', topic: '', audience: '', notes: '' });

async function load() {
  const [settings, categoryRows, result] = await Promise.all([getWebsiteSettings(), getWebsiteArticleCategories(), getWebsiteArticles()]);
  defaultAuthor.value = settings.defaultAuthor || settings.brandName;
  categories.value = categoryRows;
  articles.value = result.list;
}

async function loadArticles() {
  const result = await getWebsiteArticles(statusFilter.value === 'ALL' ? undefined : statusFilter.value);
  articles.value = result.list;
}

async function editArticle(row?: WebsiteArticleItem) {
  const detail = row ? await getWebsiteArticle(row.id) : undefined;
  Object.assign(articleForm, {
    id: detail?.id || '', title: detail?.title || '', categoryId: detail?.categoryId || activeCategories.value[0]?.id || '', author: detail?.author || defaultAuthor.value,
    digest: detail?.digest || '', coverUrl: detail?.coverUrl || '',
    contentHtml: detail?.contentHtml || '<p>请在这里撰写口腔资讯正文。</p>',
    originalUrl: detail?.originalUrl || '', publishedAt: detail?.publishedAt || new Date().toISOString(),
    seoTitle: detail?.seoTitle || '', seoKeywords: detail?.seoKeywords || '', seoDescription: detail?.seoDescription || '',
    active: detail?.status !== 'DISABLED'
  });
  dialogVisible.value = true;
}

async function previewArticle(row: WebsiteArticleItem) {
  previewItem.value = await getWebsiteArticle(row.id);
  previewVisible.value = true;
}

async function saveArticle() {
  if (!articleForm.title.trim() || !articleForm.categoryId || !articleForm.contentHtml.trim()) return ElMessage.warning('请选择分类并填写资讯标题和正文');
  saving.value = true;
  try {
    const data: WebsiteArticlePayload = {
      title: articleForm.title, categoryId: articleForm.categoryId, author: articleForm.author, digest: articleForm.digest, coverUrl: articleForm.coverUrl,
      contentHtml: articleForm.contentHtml, originalUrl: articleForm.originalUrl,
      publishedAt: articleForm.publishedAt || undefined, seoTitle: articleForm.seoTitle,
      seoKeywords: articleForm.seoKeywords, seoDescription: articleForm.seoDescription,
      status: articleForm.active ? 'ACTIVE' : 'DISABLED'
    };
    if (articleForm.id) await updateWebsiteArticle(articleForm.id, data);
    else await createWebsiteArticle(data);
    dialogVisible.value = false;
    await loadArticles();
    ElMessage.success('口腔资讯已保存');
  } finally {
    saving.value = false;
  }
}

async function removeArticle(row: WebsiteArticleItem) {
  await ElMessageBox.confirm(`确认删除口腔资讯“${row.title}”？`, '删除确认', { type: 'warning' });
  await deleteWebsiteArticle(row.id);
  await loadArticles();
  ElMessage.success('口腔资讯已删除');
}

async function toggleArticle(row: WebsiteArticleItem, value: string | number | boolean) {
  const status = value ? 'ACTIVE' : 'DISABLED';
  await updateWebsiteArticle(row.id, { status });
  row.status = status;
  ElMessage.success(value ? '文章已在官网展示' : '文章已从官网隐藏');
  if (statusFilter.value !== 'ALL' && statusFilter.value !== status) await loadArticles();
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

async function copyGeneratorPrompt() {
  const category = categories.value.find((item) => item.id === generatorForm.categoryId);
  if (!category || !generatorForm.topic.trim()) return ElMessage.warning('请选择分类并填写文章主题');
  const prompt = `请生成一篇口腔健康资讯并直接同步到傅小念运营管理后台的草稿箱。\n分类：${category.name}（categoryId: ${category.id}）\n主题：${generatorForm.topic.trim()}\n目标读者：${generatorForm.audience.trim() || '普通公众'}\n补充要求：${generatorForm.notes.trim() || '内容科学、清晰，不使用营销或保证疗效表述；包含摘要、SEO标题、关键词、SEO描述、分级正文和就医提示。'}\n封面要求：必须调用 imagegen 图片生成技能，生成与文章主题准确匹配的横版资讯封面；画面专业、自然、适合口腔健康科普，允许在图片中加入与主题相关、清晰易读的简短中文标题或提示文字，但不得添加 Logo、水印或夸张医疗效果。将封面保存为 jpg 或 webp，压缩到 500KB 以内，并通过 coverImagePath 随文章同步；封面只用于文章封面，不得插入资讯正文。\n同步要求：作者必须使用本次同步时登录管理后台的账号名称，不接受手工填写其他作者。\n生成后只保存为草稿，等待人工审核，不要直接发布。`;
  await navigator.clipboard.writeText(prompt);
  ElMessage.success('生成任务已复制，请粘贴到当前 Codex 对话');
}

onMounted(load);
</script>

<style scoped>
.article-table { margin-top: 16px; }
.article-filters { display: flex; align-items: center; gap: 12px; margin-top: 16px; color: var(--admin-text-muted); }
.heading-actions { display: flex; gap: 10px; }.generator-form { margin-top: 20px; }
.article-cover { width: 64px; height: 42px; border-radius: 5px; }
.operation-actions { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.operation-actions :deep(.el-button) { min-width: 68px; margin: 0; padding: 8px 9px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 18px; }
.form-section-title { margin: 0 0 18px; color: var(--admin-text); font-size: 16px; font-weight: 650; }
.form-section-title--spaced { margin-top: 8px; padding-top: 22px; border-top: 1px solid var(--admin-border); }
.field-tip { margin-top: 5px; color: var(--admin-text-muted); font-size: 12px; line-height: 1.5; }
.article-preview { color: var(--admin-text); }
.article-preview__meta { margin: 0 0 10px; color: var(--admin-text-muted); }
.article-preview h1 { margin: 0; font-size: clamp(24px, 4vw, 34px); line-height: 1.35; }
.article-preview__digest { margin: 16px 0; padding: 14px 16px; border-left: 3px solid var(--admin-primary); background: var(--admin-soft); line-height: 1.8; }
.article-preview__cover { display: block; width: 100%; max-height: 420px; margin: 18px 0; border-radius: 10px; object-fit: cover; }
.article-preview__content { line-height: 1.9; overflow-wrap: anywhere; }
.article-preview__content :deep(img) { max-width: 100%; height: auto; }
@media (max-width: 700px) { .form-grid { grid-template-columns: 1fr; } }
</style>
