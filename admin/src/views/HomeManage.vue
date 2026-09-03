<template>
  <div class="page-heading"><div><h1 class="page-title">首页管理</h1><p>配置企业首页品牌、轮播图和第二广告位</p></div></div>
  <el-tabs v-model="tab" class="content-panel">
    <el-tab-pane label="首页配置" name="config">
      <el-form label-width="110px" style="max-width: 720px">
        <el-form-item label="医院名称"><el-input v-model="homeConfig.hospitalName" /></el-form-item>
        <el-form-item label="品牌口号"><el-input v-model="homeConfig.slogan" /></el-form-item>
        <el-form-item label="医院 Logo"><MediaPicker v-model="homeConfig.logo" ratio-hint="1:1，建议 400×400 像素透明底图" /></el-form-item>
        <el-form-item label="客服路径"><el-input v-model="homeConfig.customerServicePath" placeholder="公众号客服或客服会话路径" /></el-form-item>
        <el-form-item label="公众号名称"><el-input v-model="homeConfig.officialAccountName" placeholder="用于未关注提示" /></el-form-item>
        <el-form-item><el-button type="primary" @click="saveConfig">保存首页配置</el-button></el-form-item>
      </el-form>
    </el-tab-pane>
    <el-tab-pane label="顶部轮播" name="banners">
      <div class="toolbar"><el-button type="primary" @click="editBanner()">新增轮播图</el-button></div>
      <el-table :data="banners">
        <el-table-column label="图片" width="160"><template #default="{ row }"><el-image :src="row.imageUrl" fit="cover" class="thumb" /></template></el-table-column>
        <el-table-column prop="title" label="标题" />
        <el-table-column prop="linkType" label="跳转类型" width="120" />
        <el-table-column prop="linkValue" label="跳转地址" />
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status === 'ACTIVE' ? '显示' : '隐藏' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="160"><template #default="{ row }"><el-button text type="primary" @click="editBanner(row)">编辑</el-button><el-button text type="danger" @click="removeBanner(row)">删除</el-button></template></el-table-column>
      </el-table>
    </el-tab-pane>
    <el-tab-pane label="首页广告" name="ads">
      <div class="toolbar"><el-button type="primary" @click="editAd()">新增广告</el-button></div>
      <el-table :data="ads">
        <el-table-column label="图片" width="180"><template #default="{ row }"><el-image :src="row.imageUrl" fit="cover" class="thumb" /></template></el-table-column>
        <el-table-column prop="title" label="标题" />
        <el-table-column prop="linkType" label="跳转类型" width="110"><template #default="{ row }">{{ row.linkType === 'PAGE' ? '小程序页面' : '不跳转' }}</template></el-table-column>
        <el-table-column prop="linkValue" label="跳转页面" min-width="190" show-overflow-tooltip />
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status === 'ACTIVE' ? '显示' : '隐藏' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="160"><template #default="{ row }"><el-button text type="primary" @click="editAd(row)">编辑</el-button><el-button text type="danger" @click="removeAd(row)">删除</el-button></template></el-table-column>
      </el-table>
    </el-tab-pane>
  </el-tabs>

  <el-dialog v-model="bannerDialog" :title="bannerForm.id ? '编辑轮播图' : '新增轮播图'" width="620px">
    <el-form label-width="90px">
      <el-form-item label="图片" required><MediaPicker v-model="bannerForm.imageUrl" ratio-hint="2:1，建议 1500×750 像素" /></el-form-item>
      <el-form-item label="标题"><el-input v-model="bannerForm.title" /></el-form-item>
      <el-form-item label="跳转类型"><el-select v-model="bannerForm.linkType"><el-option label="不跳转" value="NONE" /><el-option label="小程序页面" value="PAGE" /><el-option label="网页" value="WEB" /></el-select></el-form-item>
      <el-form-item label="跳转地址"><el-input v-model="bannerForm.linkValue" /></el-form-item>
      <el-form-item label="排序"><el-input-number v-model="bannerForm.sort" /></el-form-item>
      <el-form-item label="状态"><el-switch v-model="bannerForm.active" active-text="显示" /></el-form-item>
    </el-form>
    <template #footer><el-button @click="bannerDialog=false">取消</el-button><el-button type="primary" @click="saveBanner">保存</el-button></template>
  </el-dialog>

  <el-dialog v-model="adDialog" :title="adForm.id ? '编辑广告' : '新增广告'" width="620px">
    <el-form label-width="90px">
      <el-form-item label="图片" required><MediaPicker v-model="adForm.imageUrl" ratio-hint="3:1，建议 1500×500 像素" /></el-form-item>
      <el-form-item label="标题"><el-input v-model="adForm.title" /></el-form-item>
      <el-form-item label="跳转类型"><el-select v-model="adForm.linkType"><el-option label="不跳转" value="NONE" /><el-option label="小程序页面" value="PAGE" /></el-select></el-form-item>
      <el-form-item v-if="adForm.linkType === 'PAGE'" label="页面路径" required><div class="field-stack"><el-input v-model="adForm.linkValue" placeholder="例如：/pages/packages/packages" /><div class="field-tip">填写已注册的小程序页面路径，TabBar 页面和普通页面均支持。<RouterLink to="/mini-program-links">查看并复制全部页面路径</RouterLink></div></div></el-form-item>
      <el-form-item label="排序"><el-input-number v-model="adForm.sort" /></el-form-item>
      <el-form-item label="状态"><el-switch v-model="adForm.active" active-text="显示" /></el-form-item>
    </el-form>
    <template #footer><el-button @click="adDialog=false">取消</el-button><el-button type="primary" @click="saveAd">保存</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  HomeAdItem, HomeBannerItem, createHomeAd, createHomeBanner, deleteHomeAd, deleteHomeBanner,
  getEnterpriseHomeConfig, getHomeAds, getHomeBanners, updateEnterpriseHomeConfig, updateHomeAd,
  updateHomeBanner
} from '../api/admin';
import MediaPicker from '../components/MediaPicker.vue';

const tab = ref('config');
const homeConfig = reactive({ hospitalName: '', slogan: '', logo: '', customerServicePath: '', officialAccountName: '' });
const banners = ref<HomeBannerItem[]>([]); const ads = ref<HomeAdItem[]>([]);
const bannerDialog = ref(false); const adDialog = ref(false);
const bannerForm = reactive({ id: '', imageUrl: '', title: '', linkType: 'NONE', linkValue: '', sort: 0, active: true });
const adForm = reactive({ id: '', imageUrl: '', title: '', linkType: 'NONE', linkValue: '', sort: 0, active: true });

async function load() { Object.assign(homeConfig, await getEnterpriseHomeConfig()); banners.value = await getHomeBanners(); ads.value = await getHomeAds(); }
async function saveConfig() { await updateEnterpriseHomeConfig(homeConfig); ElMessage.success('首页配置已保存'); }
function editBanner(row?: HomeBannerItem) { Object.assign(bannerForm, { id: row?.id || '', imageUrl: row?.imageUrl || '', title: row?.title || '', linkType: row?.linkType || 'NONE', linkValue: row?.linkValue || '', sort: row?.sort || 0, active: row?.status !== 'DISABLED' }); bannerDialog.value = true; }
async function saveBanner() { if (!bannerForm.imageUrl) return ElMessage.warning('请上传轮播图片'); const data = { ...bannerForm, status: bannerForm.active ? 'ACTIVE' : 'DISABLED' } as any; bannerForm.id ? await updateHomeBanner(bannerForm.id, data) : await createHomeBanner(data); bannerDialog.value=false; await load(); }
async function removeBanner(row: HomeBannerItem) { await ElMessageBox.confirm('确认删除该轮播图？', '删除确认', { type: 'warning' }); await deleteHomeBanner(row.id); await load(); }
function editAd(row?: HomeAdItem) { Object.assign(adForm, { id: row?.id || '', imageUrl: row?.imageUrl || '', title: row?.title || '', linkType: row?.linkType || 'NONE', linkValue: row?.linkValue || '', sort: row?.sort || 0, active: row?.status !== 'DISABLED' }); adDialog.value=true; }
async function saveAd() { if (!adForm.imageUrl) return ElMessage.warning('请上传广告图片'); if (adForm.linkType === 'PAGE' && !adForm.linkValue.trim()) return ElMessage.warning('请填写广告跳转页面路径'); const data = { ...adForm, linkValue: adForm.linkType === 'PAGE' ? adForm.linkValue.trim() : '', status: adForm.active ? 'ACTIVE' : 'DISABLED' } as any; adForm.id ? await updateHomeAd(adForm.id, data) : await createHomeAd(data); adDialog.value=false; await load(); }
async function removeAd(row: HomeAdItem) { await ElMessageBox.confirm('确认删除该广告？', '删除确认', { type: 'warning' }); await deleteHomeAd(row.id); await load(); }
onMounted(load);
</script>

<style scoped>.thumb{width:120px;height:64px;border-radius:6px}.image-field{display:flex;width:100%;gap:10px}.image-field .el-input{flex:1}.field-stack{width:100%}.field-tip{margin-top:6px;color:var(--admin-text-muted);font-size:12px;line-height:1.5}.field-tip a{margin-left:8px;color:var(--admin-primary);text-decoration:none}.page-heading p{margin:0 0 18px;color:var(--admin-text-secondary)}</style>
