<template>
  <div class="media-picker">
    <div class="picker-row">
      <el-input :model-value="modelValue" placeholder="图片地址" @update:model-value="emit('update:modelValue', $event)" />
      <el-upload :show-file-list="false" :http-request="upload" accept="image/jpeg,image/png,image/webp,image/gif">
        <el-button>上传</el-button>
      </el-upload>
      <el-button @click="openLibrary">图片库</el-button>
    </div>
    <div class="ratio-tip">建议比例：{{ ratioHint }}；支持 JPG、PNG、WebP、GIF，单张不超过 8MB。</div>
    <el-image v-if="modelValue" :src="modelValue" fit="cover" class="selected-preview" />

    <el-dialog v-model="visible" title="选择图片素材" width="820px" append-to-body>
      <div v-if="loading" class="loading-copy">正在加载图片库...</div>
      <el-empty v-else-if="!assets.length" description="暂无图片素材，请先上传" />
      <div v-else class="asset-grid">
        <button v-for="asset in assets" :key="asset.id" type="button" class="asset-item" @click="choose(asset.url)">
          <el-image :src="asset.url" fit="cover" lazy />
          <span :title="asset.name">{{ asset.name }}</span>
        </button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { MediaAssetItem, getMediaAssets, uploadEnterpriseAsset } from '../api/admin';

withDefaults(defineProps<{ modelValue: string; ratioHint?: string }>(), { ratioHint: '按页面实际展示比例裁切' });
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const visible = ref(false);
const loading = ref(false);
const assets = ref<MediaAssetItem[]>([]);

async function openLibrary() {
  visible.value = true;
  loading.value = true;
  try { assets.value = await getMediaAssets(); }
  finally { loading.value = false; }
}

function choose(url: string) {
  emit('update:modelValue', url);
  visible.value = false;
}

async function upload(options: any) {
  const file = options.file as File;
  if (!file.type.startsWith('image/')) return ElMessage.warning('请选择图片文件');
  if (file.size > 8 * 1024 * 1024) return ElMessage.warning('图片不能超过 8MB');
  const asset = await uploadEnterpriseAsset(file);
  emit('update:modelValue', asset.url);
  assets.value.unshift(asset);
  ElMessage.success('图片已上传并保存到图片库');
}
</script>

<style scoped>
.picker-row{display:flex;width:100%;gap:8px}.picker-row .el-input{flex:1}.ratio-tip{margin-top:7px;color:var(--admin-text-muted);font-size:12px}.selected-preview{width:120px;height:76px;margin-top:10px;border:1px solid var(--admin-border);border-radius:6px}.asset-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.asset-item{min-width:0;padding:8px;color:var(--admin-text);background:#fff;border:1px solid var(--admin-border);border-radius:6px;cursor:pointer;text-align:left}.asset-item:hover{border-color:var(--admin-primary)}.asset-item .el-image{display:block;width:100%;aspect-ratio:4/3;border-radius:4px}.asset-item span{display:block;margin-top:7px;overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.loading-copy{padding:50px;text-align:center;color:var(--admin-text-muted)}@media(max-width:720px){.asset-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.picker-row{align-items:stretch;flex-direction:column}.picker-row :deep(.el-button),.picker-row :deep(.el-upload),.picker-row :deep(.el-upload .el-button){width:100%}.selected-preview{width:min(180px,100%);height:auto;aspect-ratio:4/3}.asset-item{min-height:44px}}
</style>
