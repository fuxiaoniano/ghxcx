<template>
  <div class="page-heading">
    <div>
      <h1 class="page-title">口腔资讯</h1>
      <p>编辑发布官网文章，并为每篇文章配置独立的搜索引擎标题、关键词和描述。</p>
    </div>
    <el-button type="primary" @click="editArticle()"><el-icon><Plus /></el-icon>新增资讯</el-button>
  </div>

  <div class="content-panel">
    <el-alert title="资讯保存后立即通过官网接口生效；停用文章不会在官网公开显示。" type="info" :closable="false" show-icon />
    <el-table class="article-table" :data="articles" row-key="id" empty-text="暂无口腔资讯">
      <el-table-column label="封面" width="90"><template #default="{ row }"><el-image v-if="row.coverUrl" :src="row.coverUrl" class="article-cover" fit="cover" /></template></el-table-column>
      <el-table-column prop="title" label="资讯标题" min-width="260" show-overflow-tooltip />
      <el-table-column label="来源" width="105"><template #default="{ row }"><el-tag type="info" size="small">{{ row.sourceType === 'WECHAT' ? '历史资讯' : '后台发布' }}</el-tag></template></el-table-column>
      <el-table-column prop="author" label="作者" width="120" show-overflow-tooltip />
      <el-table-column label="发布时间" width="170"><template #default="{ row }">{{ formatTime(row.publishedAt) }}</template></el-table-column>
      <el-table-column label="SEO" width="90"><template #default="{ row }"><el-tag :type="row.seoTitle || row.seoDescription ? 'success' : 'info'">{{ row.seoTitle || row.seoDescription ? '已配置' : '默认' }}</el-tag></template></el-table-column>
      <el-table-column label="官网展示" width="110"><template #default="{ row }"><el-switch :model-value="row.status === 'ACTIVE'" @change="toggleArticle(row, $event)" /></template></el-table-column>
      <el-table-column label="操作" width="176" fixed="right">
        <template #default="{ row }">
          <div class="operation-actions">
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
        <el-form-item label="作者"><el-input v-model="articleForm.author" maxlength="100" /></el-form-item>
        <el-form-item label="发布时间"><el-date-picker v-model="articleForm.publishedAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss.SSSZ" placeholder="选择发布时间" style="width: 100%" /></el-form-item>
      </div>
      <el-form-item label="资讯摘要"><el-input v-model="articleForm.digest" type="textarea" :rows="2" maxlength="500" show-word-limit /></el-form-item>
      <el-form-item label="封面图片"><MediaPicker v-model="articleForm.coverUrl" ratio-hint="建议 16:9，推荐 1200×675 像素" /></el-form-item>
      <el-form-item label="资讯正文" required><HtmlEditor v-model="articleForm.contentHtml" /></el-form-item>
      <el-form-item label="原文链接"><el-input v-model="articleForm.originalUrl" placeholder="可选，例如外部参考文章地址" /></el-form-item>

      <h2 class="form-section-title form-section-title--spaced">SEO 设置</h2>
      <el-form-item label="SEO 标题">
        <el-input v-model="articleForm.seoTitle" maxlength="160" show-word-limit placeholder="留空时使用资讯标题" />
        <div class="field-tip">建议控制在 30 个中文字符以内，准确概括文章主题。</div>
      </el-form-item>
      <el-form-item label="SEO 关键词">
        <el-input v-model="articleForm.seoKeywords" maxlength="300" show-word-limit placeholder="多个关键词使用英文逗号分隔" />
      </el-form-item>
      <el-form-item label="SEO 描述">
        <el-input v-model="articleForm.seoDescription" type="textarea" :rows="3" maxlength="300" show-word-limit placeholder="留空时使用资讯摘要" />
        <div class="field-tip">建议控制在 80 个中文字符以内，用于搜索结果摘要和分享描述。</div>
      </el-form-item>
      <el-form-item label="官网展示"><el-switch v-model="articleForm.active" active-text="立即发布" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="saveArticle">保存资讯</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { Delete, Edit, Plus } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import HtmlEditor from '../components/HtmlEditor.vue';
import MediaPicker from '../components/MediaPicker.vue';
import {
  createWebsiteArticle, deleteWebsiteArticle, getWebsiteArticle, getWebsiteArticles, getWebsiteSettings,
  updateWebsiteArticle, type WebsiteArticleItem, type WebsiteArticlePayload
} from '../api/admin';

const articles = ref<WebsiteArticleItem[]>([]);
const defaultAuthor = ref('');
const saving = ref(false);
const dialogVisible = ref(false);
const articleForm = reactive({
  id: '', title: '', author: '', digest: '', coverUrl: '', contentHtml: '', originalUrl: '', publishedAt: '',
  seoTitle: '', seoKeywords: '', seoDescription: '', active: true
});

async function load() {
  const [settings, result] = await Promise.all([getWebsiteSettings(), getWebsiteArticles()]);
  defaultAuthor.value = settings.brandName;
  articles.value = result.list;
}

async function editArticle(row?: WebsiteArticleItem) {
  const detail = row ? await getWebsiteArticle(row.id) : undefined;
  Object.assign(articleForm, {
    id: detail?.id || '', title: detail?.title || '', author: detail?.author || defaultAuthor.value,
    digest: detail?.digest || '', coverUrl: detail?.coverUrl || '',
    contentHtml: detail?.contentHtml || '<p>请在这里撰写口腔资讯正文。</p>',
    originalUrl: detail?.originalUrl || '', publishedAt: detail?.publishedAt || new Date().toISOString(),
    seoTitle: detail?.seoTitle || '', seoKeywords: detail?.seoKeywords || '', seoDescription: detail?.seoDescription || '',
    active: detail?.status !== 'DISABLED'
  });
  dialogVisible.value = true;
}

async function saveArticle() {
  if (!articleForm.title.trim() || !articleForm.contentHtml.trim()) return ElMessage.warning('请填写资讯标题和正文');
  saving.value = true;
  try {
    const data: WebsiteArticlePayload = {
      title: articleForm.title, author: articleForm.author, digest: articleForm.digest, coverUrl: articleForm.coverUrl,
      contentHtml: articleForm.contentHtml, originalUrl: articleForm.originalUrl,
      publishedAt: articleForm.publishedAt || undefined, seoTitle: articleForm.seoTitle,
      seoKeywords: articleForm.seoKeywords, seoDescription: articleForm.seoDescription,
      status: articleForm.active ? 'ACTIVE' : 'DISABLED'
    };
    if (articleForm.id) await updateWebsiteArticle(articleForm.id, data);
    else await createWebsiteArticle(data);
    dialogVisible.value = false;
    articles.value = (await getWebsiteArticles()).list;
    ElMessage.success('口腔资讯已保存');
  } finally {
    saving.value = false;
  }
}

async function removeArticle(row: WebsiteArticleItem) {
  await ElMessageBox.confirm(`确认删除口腔资讯“${row.title}”？`, '删除确认', { type: 'warning' });
  await deleteWebsiteArticle(row.id);
  articles.value = (await getWebsiteArticles()).list;
  ElMessage.success('口腔资讯已删除');
}

async function toggleArticle(row: WebsiteArticleItem, value: string | number | boolean) {
  const status = value ? 'ACTIVE' : 'DISABLED';
  await updateWebsiteArticle(row.id, { status });
  row.status = status;
  ElMessage.success(value ? '文章已在官网展示' : '文章已从官网隐藏');
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

onMounted(load);
</script>

<style scoped>
.article-table { margin-top: 16px; }
.article-cover { width: 64px; height: 42px; border-radius: 5px; }
.operation-actions { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.operation-actions :deep(.el-button) { min-width: 68px; margin: 0; padding: 8px 9px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 18px; }
.form-section-title { margin: 0 0 18px; color: var(--admin-text); font-size: 16px; font-weight: 650; }
.form-section-title--spaced { margin-top: 8px; padding-top: 22px; border-top: 1px solid var(--admin-border); }
.field-tip { margin-top: 5px; color: var(--admin-text-muted); font-size: 12px; line-height: 1.5; }
@media (max-width: 700px) { .form-grid { grid-template-columns: 1fr; } }
</style>
