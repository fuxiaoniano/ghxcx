<template>
  <div class="page-heading"><div><h1 class="page-title">官网内容管理</h1><p>官网是独立展示前端；这里统一维护官网信息、页面与微信公众号文章，不改变小程序页面。</p></div></div>
  <el-tabs v-model="tab" class="content-panel">
    <el-tab-pane label="官网设置" name="settings">
      <el-form class="settings-form" label-width="116px">
        <div class="form-grid"><el-form-item label="品牌名称"><el-input v-model="settings.brandName" maxlength="40" /></el-form-item><el-form-item label="公众号名称"><el-input v-model="settings.wechatName" maxlength="40" /></el-form-item></div>
        <el-form-item label="首屏眉题"><el-input v-model="settings.eyebrow" maxlength="80" /></el-form-item>
        <el-form-item label="首屏主标题"><el-input v-model="settings.heroTitle" maxlength="80" /></el-form-item>
        <el-form-item label="首屏说明"><el-input v-model="settings.heroDescription" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>
        <div class="form-grid"><el-form-item label="预约按钮文案"><el-input v-model="settings.appointmentText" /></el-form-item><el-form-item label="预约链接"><el-input v-model="settings.appointmentUrl" placeholder="/landing/default 或完整网址" /></el-form-item></div>
        <div class="form-grid"><el-form-item label="咨询电话"><el-input v-model="settings.phone" /></el-form-item><el-form-item label="服务时间"><el-input v-model="settings.serviceHours" /></el-form-item></div>
        <el-form-item label="机构地址"><el-input v-model="settings.address" /></el-form-item>
        <el-form-item label="页脚简介"><el-input v-model="settings.footerDescription" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="备案号"><el-input v-model="settings.icpNumber" placeholder="取得备案后填写" /></el-form-item>
        <el-form-item><el-button type="primary" :loading="savingSettings" @click="saveSettings">保存官网设置</el-button></el-form-item>
      </el-form>
    </el-tab-pane>

    <el-tab-pane label="自定义页面" name="pages">
      <div class="toolbar"><el-button type="primary" @click="editPage()">新增官网页面</el-button><span class="toolbar-tip">可添加品牌介绍、院区介绍、就诊指南等独立页面</span></div>
      <el-table :data="pages" row-key="id"><el-table-column prop="menuTitle" label="导航名称" width="130" /><el-table-column prop="title" label="页面标题" min-width="200" /><el-table-column label="访问路径" min-width="180"><template #default="{row}">/page/{{row.slug}}</template></el-table-column><el-table-column prop="sort" label="排序" width="74" /><el-table-column label="导航" width="74"><template #default="{row}">{{row.showInNav?'显示':'隐藏'}}</template></el-table-column><el-table-column label="状态" width="90"><template #default="{row}"><el-tag :type="row.status==='ACTIVE'?'success':'info'">{{row.status==='ACTIVE'?'已发布':'已停用'}}</el-tag></template></el-table-column><el-table-column label="操作" width="150" fixed="right"><template #default="{row}"><el-button text type="primary" @click="editPage(row)">编辑</el-button><el-button text type="danger" @click="removePage(row)">删除</el-button></template></el-table-column></el-table>
    </el-tab-pane>

    <el-tab-pane label="公众号文章" name="articles">
      <el-alert title="系统按配置周期自动同步微信公众号已发布文章；同步时会校验 UTF-8 编码、清理不安全标签并统一响应式排版。" type="info" :closable="false" />
      <div class="sync-toolbar"><el-button type="primary" :loading="syncing" @click="syncArticles">立即同步公众号文章</el-button><span v-if="syncStatus">上次同步：{{formatTime(syncStatus.finishedAt)}}，共 {{syncStatus.total}} 篇（新增 {{syncStatus.created}} / 更新 {{syncStatus.updated}} / 未变 {{syncStatus.unchanged}}）</span><span v-else>尚无同步记录</span></div>
      <el-table :data="articles" row-key="id"><el-table-column label="封面" width="90"><template #default="{row}"><el-image v-if="row.coverUrl" :src="row.coverUrl" class="article-cover" fit="cover" /></template></el-table-column><el-table-column prop="title" label="文章标题" min-width="260" /><el-table-column prop="author" label="作者" width="120" /><el-table-column label="发布时间" width="170"><template #default="{row}">{{formatTime(row.publishedAt)}}</template></el-table-column><el-table-column label="官网展示" width="120"><template #default="{row}"><el-switch :model-value="row.status==='ACTIVE'" @change="toggleArticle(row,$event)" /></template></el-table-column></el-table>
    </el-tab-pane>
  </el-tabs>

  <el-dialog v-model="pageDialog" :title="pageForm.id?'编辑官网页面':'新增官网页面'" width="860px" top="5vh">
    <el-form label-width="104px"><div class="form-grid"><el-form-item label="页面标题" required><el-input v-model="pageForm.title" maxlength="160" /></el-form-item><el-form-item label="导航名称" required><el-input v-model="pageForm.menuTitle" maxlength="40" /></el-form-item></div><div class="form-grid"><el-form-item label="页面路径" required><el-input v-model="pageForm.slug" :disabled="Boolean(pageForm.id)" placeholder="about-us" /><div class="field-tip">仅小写字母、数字和连字符</div></el-form-item><el-form-item label="排序"><el-input-number v-model="pageForm.sort" /></el-form-item></div><el-form-item label="页面摘要"><el-input v-model="pageForm.summary" type="textarea" :rows="2" maxlength="500" show-word-limit /></el-form-item><el-form-item label="封面图"><MediaPicker v-model="pageForm.coverUrl" ratio-hint="建议 1920×720 像素" /></el-form-item><el-form-item label="页面正文"><HtmlEditor v-model="pageForm.contentHtml" /></el-form-item><div class="form-grid"><el-form-item label="SEO 标题"><el-input v-model="pageForm.seoTitle" maxlength="160" /></el-form-item><el-form-item label="SEO 描述"><el-input v-model="pageForm.seoDescription" maxlength="300" /></el-form-item></div><div class="form-grid"><el-form-item label="加入导航"><el-switch v-model="pageForm.showInNav" /></el-form-item><el-form-item label="发布状态"><el-switch v-model="pageForm.active" active-text="已发布" /></el-form-item></div></el-form>
    <template #footer><el-button @click="pageDialog=false">取消</el-button><el-button type="primary" :loading="savingPage" @click="savePage">保存页面</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted,reactive,ref } from 'vue';
import { ElMessage,ElMessageBox } from 'element-plus';
import HtmlEditor from '../components/HtmlEditor.vue';import MediaPicker from '../components/MediaPicker.vue';
import { WebsiteArticleItem,WebsiteArticleSyncResult,WebsitePageItem,WebsiteSettings,createWebsitePage,deleteWebsitePage,getWebsiteArticleSyncStatus,getWebsiteArticles,getWebsitePages,getWebsiteSettings,syncWebsiteArticles,updateWebsiteArticle,updateWebsitePage,updateWebsiteSettings } from '../api/admin';
const tab=ref('settings'),pages=ref<WebsitePageItem[]>([]),articles=ref<WebsiteArticleItem[]>([]),syncStatus=ref<WebsiteArticleSyncResult|null>(null),syncing=ref(false),savingSettings=ref(false),savingPage=ref(false),pageDialog=ref(false);
const settings=reactive<WebsiteSettings>({brandName:'',eyebrow:'',heroTitle:'',heroDescription:'',appointmentUrl:'',appointmentText:'',phone:'',serviceHours:'',address:'',footerDescription:'',icpNumber:'',wechatName:''});
const pageForm=reactive({id:'',slug:'',title:'',menuTitle:'',summary:'',coverUrl:'',contentHtml:'',seoTitle:'',seoDescription:'',showInNav:true,sort:0,active:true});
async function load(){const [site,pageRows,articleRows,status]=await Promise.all([getWebsiteSettings(),getWebsitePages(),getWebsiteArticles(),getWebsiteArticleSyncStatus()]);Object.assign(settings,site);pages.value=pageRows;articles.value=articleRows.list;syncStatus.value=status;}
async function saveSettings(){savingSettings.value=true;try{Object.assign(settings,await updateWebsiteSettings(settings));ElMessage.success('官网设置已保存');}finally{savingSettings.value=false;}}
function editPage(row?:WebsitePageItem){Object.assign(pageForm,{id:row?.id||'',slug:row?.slug||'',title:row?.title||'',menuTitle:row?.menuTitle||'',summary:row?.summary||'',coverUrl:row?.coverUrl||'',contentHtml:row?.contentHtml||'<p>请在这里编辑页面内容。</p>',seoTitle:row?.seoTitle||'',seoDescription:row?.seoDescription||'',showInNav:row?.showInNav??true,sort:row?.sort||0,active:row?.status!=='DISABLED'});pageDialog.value=true;}
async function savePage(){if(!pageForm.title.trim()||!pageForm.menuTitle.trim()||!pageForm.slug.trim())return ElMessage.warning('请填写页面标题、导航名称和路径');if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pageForm.slug))return ElMessage.warning('页面路径只能使用小写字母、数字和连字符');savingPage.value=true;try{const data={...pageForm,status:pageForm.active?'ACTIVE':'DISABLED'} as any;pageForm.id?await updateWebsitePage(pageForm.id,data):await createWebsitePage(data);pageDialog.value=false;pages.value=await getWebsitePages();ElMessage.success('官网页面已保存');}finally{savingPage.value=false;}}
async function removePage(row:WebsitePageItem){await ElMessageBox.confirm(`确认删除官网页面“${row.title}”？`,'删除确认',{type:'warning'});await deleteWebsitePage(row.id);pages.value=await getWebsitePages();}
async function syncArticles(){syncing.value=true;try{syncStatus.value=await syncWebsiteArticles();articles.value=(await getWebsiteArticles()).list;ElMessage.success(`同步完成，共处理 ${syncStatus.value.total} 篇文章`);}finally{syncing.value=false;}}
async function toggleArticle(row:WebsiteArticleItem,value:string|number|boolean){const status=value?'ACTIVE':'DISABLED';await updateWebsiteArticle(row.id,status);row.status=status;ElMessage.success(value?'文章已在官网展示':'文章已从官网隐藏');}
function formatTime(value?:string){return value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'-';}
onMounted(load);
</script>
<style scoped>.page-heading p{margin:0 0 18px;color:var(--admin-text-secondary)}.settings-form{max-width:920px;padding-top:18px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}.toolbar-tip,.sync-toolbar span{color:var(--admin-text-secondary);font-size:13px}.sync-toolbar{display:flex;align-items:center;gap:15px;margin:18px 0}.article-cover{width:64px;height:42px;border-radius:5px}.field-tip{color:var(--admin-text-muted);font-size:12px}@media(max-width:700px){.form-grid{grid-template-columns:1fr}.sync-toolbar{align-items:flex-start;flex-direction:column}}</style>
