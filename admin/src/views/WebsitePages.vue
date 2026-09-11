<template>
  <div class="page-heading">
    <div>
      <h1 class="page-title">官网页面</h1>
      <p>维护品牌介绍、院区介绍、就诊指南等独立页面及其导航顺序。</p>
    </div>
    <el-button type="primary" @click="editPage()"><el-icon><Plus /></el-icon>新增页面</el-button>
  </div>

  <div class="content-panel">
    <el-table :data="pages" row-key="id" empty-text="暂无官网页面">
      <el-table-column prop="menuTitle" label="导航名称" width="130" />
      <el-table-column prop="title" label="页面标题" min-width="220" show-overflow-tooltip />
      <el-table-column label="访问路径" min-width="210"><template #default="{ row }"><code class="path-code">/page/{{ row.slug }}</code></template></el-table-column>
      <el-table-column prop="sort" label="排序" width="74" />
      <el-table-column label="导航" width="74"><template #default="{ row }">{{ row.showInNav ? '显示' : '隐藏' }}</template></el-table-column>
      <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status === 'ACTIVE' ? '已发布' : '已停用' }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="176" fixed="right">
        <template #default="{ row }">
          <div class="operation-actions">
            <el-button text type="primary" @click="editPage(row)"><el-icon><Edit /></el-icon>编辑</el-button>
            <el-button text type="danger" @click="removePage(row)"><el-icon><Delete /></el-icon>删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogVisible" :title="pageForm.id ? '编辑官网页面' : '新增官网页面'" width="min(880px, calc(100vw - 32px))" top="5vh">
    <el-form label-width="104px">
      <div class="form-grid">
        <el-form-item label="页面标题" required><el-input v-model="pageForm.title" maxlength="160" /></el-form-item>
        <el-form-item label="导航名称" required><el-input v-model="pageForm.menuTitle" maxlength="40" /></el-form-item>
      </div>
      <div class="form-grid">
        <el-form-item label="页面路径" required>
          <el-input v-model="pageForm.slug" :disabled="Boolean(pageForm.id)" placeholder="about-us" />
          <div class="field-tip">仅使用小写字母、数字和连字符</div>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="pageForm.sort" /></el-form-item>
      </div>
      <el-form-item label="页面摘要"><el-input v-model="pageForm.summary" type="textarea" :rows="2" maxlength="500" show-word-limit /></el-form-item>
      <el-form-item label="封面图"><MediaPicker v-model="pageForm.coverUrl" ratio-hint="建议 1920×720 像素" /></el-form-item>
      <el-form-item label="页面正文"><HtmlEditor v-model="pageForm.contentHtml" /></el-form-item>
      <el-divider content-position="left">搜索展示</el-divider>
      <div class="form-grid">
        <el-form-item label="SEO 标题"><el-input v-model="pageForm.seoTitle" maxlength="160" show-word-limit /></el-form-item>
        <el-form-item label="SEO 描述"><el-input v-model="pageForm.seoDescription" maxlength="300" show-word-limit /></el-form-item>
      </div>
      <div class="form-grid">
        <el-form-item label="加入导航"><el-switch v-model="pageForm.showInNav" /></el-form-item>
        <el-form-item label="发布状态"><el-switch v-model="pageForm.active" active-text="已发布" /></el-form-item>
      </div>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="savePage">保存页面</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { Delete, Edit, Plus } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import HtmlEditor from '../components/HtmlEditor.vue';
import MediaPicker from '../components/MediaPicker.vue';
import { createWebsitePage, deleteWebsitePage, getWebsitePages, updateWebsitePage, type WebsitePageItem } from '../api/admin';

const pages = ref<WebsitePageItem[]>([]);
const saving = ref(false);
const dialogVisible = ref(false);
const pageForm = reactive({ id: '', slug: '', title: '', menuTitle: '', summary: '', coverUrl: '', contentHtml: '', seoTitle: '', seoDescription: '', showInNav: true, sort: 0, active: true });

async function load() {
  pages.value = await getWebsitePages();
}

function editPage(row?: WebsitePageItem) {
  Object.assign(pageForm, {
    id: row?.id || '', slug: row?.slug || '', title: row?.title || '', menuTitle: row?.menuTitle || '',
    summary: row?.summary || '', coverUrl: row?.coverUrl || '', contentHtml: row?.contentHtml || '<p>请在这里编辑页面内容。</p>',
    seoTitle: row?.seoTitle || '', seoDescription: row?.seoDescription || '', showInNav: row?.showInNav ?? true,
    sort: row?.sort || 0, active: row?.status !== 'DISABLED'
  });
  dialogVisible.value = true;
}

async function savePage() {
  if (!pageForm.title.trim() || !pageForm.menuTitle.trim() || !pageForm.slug.trim()) return ElMessage.warning('请填写页面标题、导航名称和路径');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pageForm.slug)) return ElMessage.warning('页面路径只能使用小写字母、数字和连字符');
  saving.value = true;
  try {
    const data = {
      slug: pageForm.slug, title: pageForm.title, menuTitle: pageForm.menuTitle, summary: pageForm.summary,
      coverUrl: pageForm.coverUrl, contentHtml: pageForm.contentHtml, seoTitle: pageForm.seoTitle,
      seoDescription: pageForm.seoDescription, showInNav: pageForm.showInNav, sort: pageForm.sort,
      status: pageForm.active ? 'ACTIVE' as const : 'DISABLED' as const
    };
    if (pageForm.id) await updateWebsitePage(pageForm.id, data);
    else await createWebsitePage(data);
    dialogVisible.value = false;
    await load();
    ElMessage.success('官网页面已保存');
  } finally {
    saving.value = false;
  }
}

async function removePage(row: WebsitePageItem) {
  await ElMessageBox.confirm(`确认删除官网页面“${row.title}”？`, '删除确认', { type: 'warning' });
  await deleteWebsitePage(row.id);
  await load();
  ElMessage.success('官网页面已删除');
}

onMounted(load);
</script>

<style scoped>
.path-code { display: inline-block; max-width: 100%; padding: 4px 7px; overflow: hidden; background: #f4f6f9; border-radius: 4px; text-overflow: ellipsis; white-space: nowrap; }
.operation-actions { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.operation-actions :deep(.el-button) { min-width: 68px; margin: 0; padding: 8px 9px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 18px; }
.field-tip { margin-top: 5px; color: var(--admin-text-muted); font-size: 12px; }
@media (max-width: 700px) { .form-grid { grid-template-columns: 1fr; } }
</style>
