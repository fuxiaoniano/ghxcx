<template>
  <div class="page-heading"><div><h1 class="page-title">图片库</h1><p>集中管理后台上传的图片，现有素材可在首页、医生、科室和套餐编辑中重复选用</p></div><el-upload :show-file-list="false" :http-request="upload" accept="image/*"><el-button type="primary">上传图片</el-button></el-upload></div>
  <div class="content-panel">
    <div class="ratio-note">上传前请按使用位置裁切：轮播图建议 2:1，广告图建议 3:1，医生头像建议 1:1，科室图标建议 1:1，套餐封面建议 4:3。单张不超过 8MB。</div>
    <el-empty v-if="!assets.length" description="暂无图片素材" />
    <div v-else class="asset-grid">
      <div v-for="asset in assets" :key="asset.id" class="asset-card">
        <el-image :src="asset.url" fit="cover" :preview-src-list="[asset.url]" />
        <strong :title="asset.name">{{ asset.name }}</strong>
        <span>{{ formatSize(asset.size) }} · {{ formatTime(asset.createdAt) }}</span>
        <div><el-button text type="primary" @click="copy(asset.url)">复制地址</el-button><el-button text type="danger" @click="remove(asset)">移出图片库</el-button></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { MediaAssetItem, deleteMediaAsset, getMediaAssets, uploadEnterpriseAsset } from '../api/admin';

const assets = ref<MediaAssetItem[]>([]);
const load = async () => { assets.value = await getMediaAssets(); };
async function upload(options: any) { const file=options.file as File;if(file.size>8*1024*1024)return ElMessage.warning('图片不能超过 8MB');await uploadEnterpriseAsset(file);ElMessage.success('上传成功');await load(); }
async function copy(url:string){await navigator.clipboard.writeText(url);ElMessage.success('图片地址已复制');}
async function remove(asset:MediaAssetItem){await ElMessageBox.confirm('移出后已使用此图片的页面仍可显示，但素材库不再列出。','移出图片库',{type:'warning'});await deleteMediaAsset(asset.id);await load();}
const formatSize=(size:number)=>size>1024*1024?`${(size/1024/1024).toFixed(1)} MB`:`${Math.ceil(size/1024)} KB`;
const formatTime=(value:string)=>new Date(value).toLocaleDateString('zh-CN');
onMounted(load);
</script>

<style scoped>
.page-heading{display:flex;align-items:flex-start;justify-content:space-between}.page-heading p{margin:0 0 18px;color:var(--admin-text-secondary)}.ratio-note{margin-bottom:18px;padding:12px 14px;color:#526174;background:#f5f8fb;border-left:3px solid var(--admin-primary);font-size:13px}.asset-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}.asset-card{min-width:0;padding:10px;border:1px solid var(--admin-border);border-radius:6px}.asset-card .el-image{display:block;width:100%;aspect-ratio:4/3;border-radius:4px}.asset-card strong,.asset-card span{display:block;overflow:hidden;margin-top:8px;text-overflow:ellipsis;white-space:nowrap}.asset-card span{color:var(--admin-text-muted);font-size:12px}.asset-card>div:last-child{display:flex;justify-content:space-between;margin-top:4px}@media(max-width:1100px){.asset-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:700px){.asset-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
