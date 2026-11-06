<template>
  <div v-if="nativePreview" v-loading="nativeLoading" class="consultation-preview">
    <div v-if="nativeSummary" class="consultation-preview-summary">{{ nativeSummary }}</div>
    <div v-if="nativeRows.length" class="consultation-preview-list">
      <article v-for="row in nativeRows" :key="row.id" class="consultation-preview-card">
        <div class="consultation-preview-head"><strong>{{ row.name }}</strong><span>{{ row.phoneMasked || row.phone }}</span><el-tag size="small" :color="row.status?.color" effect="dark">{{ row.status?.name || '—' }}</el-tag></div>
        <div class="consultation-preview-main"><strong>{{ row.project?.name || '—' }}</strong><span>{{ row.channelSource || '—' }}<template v-if="row.accountName"> · {{ row.accountName }}</template></span></div>
        <div class="consultation-preview-meta"><span>负责人：{{ row.owner?.nickname || row.owner?.username || '—' }}</span><span v-if="nativePreview === 'callbacks'" :class="{ overdue: row.overdue }">回访：{{ formatTime(row.nextFollowUpAt) }}</span><span v-else>创建：{{ formatTime(row.createdAt) }}</span></div>
      </article>
    </div>
    <el-empty v-else-if="!nativeLoading && !nativeError" :description="nativePreview === 'callbacks' ? '暂无待回访表单' : '暂无表单'" :image-size="58" />
    <div v-if="nativeError" class="preview-state">{{ nativeError }}</div>
  </div>
  <iframe
    v-else
    :src="path"
    :title="`${title}内容摘要`"
    loading="lazy"
    scrolling="no"
    referrerpolicy="same-origin"
    class="dashboard-page-preview"
    :style="{ height: `${height}px`, visibility: ready ? 'visible' : 'hidden' }"
    @load="preparePreview"
  />
  <div v-if="!nativePreview && !ready" class="preview-state">{{ failed ? '暂时无法预览，请打开完整页面' : '正在加载表格…' }}</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { getConsultationCallbacks, getConsultations, type ConsultationFormItem } from '../api/admin';

const props = defineProps<{ path: string; title: string }>();
const height = ref(300);
const ready = ref(false);
const failed = ref(false);
let mutationObserver: MutationObserver | undefined;
let resizeObserver: ResizeObserver | undefined;
let pendingFrame = 0;
let failureTimer = 0;
const nativeRows = ref<ConsultationFormItem[]>([]);
const nativeLoading = ref(false);
const nativeError = ref('');
const nativeSummary = ref('');
const nativePreview = computed<'callbacks' | 'forms' | ''>(() => props.path === '/consultations/callbacks' ? 'callbacks' : props.path === '/consultations' ? 'forms' : '');

async function loadNativePreview() {
  if (!nativePreview.value) return;
  nativeLoading.value = true;
  nativeError.value = '';
  try {
    if (nativePreview.value === 'callbacks') {
      const result = await getConsultationCallbacks();
      nativeRows.value = [...new Map([...result.overdue, ...result.today].map((row) => [row.id, row])).values()].slice(0, 6);
      nativeSummary.value = `今日 ${result.counts.today} 条 · 逾期 ${result.counts.overdue} 条 · 已完成 ${result.counts.completed} 条`;
    } else {
      const result = await getConsultations({ page: 1, pageSize: 6 });
      nativeRows.value = result.list;
      nativeSummary.value = `共 ${result.total} 条表单`;
    }
  } catch {
    nativeRows.value = [];
    nativeSummary.value = '';
    nativeError.value = '数据加载失败，请打开完整页面重试';
  } finally {
    nativeLoading.value = false;
  }
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
}

function disconnect() {
  mutationObserver?.disconnect();
  resizeObserver?.disconnect();
  cancelAnimationFrame(pendingFrame);
  window.clearTimeout(failureTimer);
}

function preparePreview(event: Event) {
  disconnect();
  ready.value = false;
  failed.value = false;
  const frame = event.target as HTMLIFrameElement;
  const document = frame.contentDocument;
  if (!document?.body) { failed.value = true; return; }

  const refresh = () => {
    pendingFrame = 0;
    const root = document.querySelector('.page-container');
    if (!root) return;
    const tables = [...root.querySelectorAll('table, .el-table')].filter((element) =>
      !(element instanceof HTMLTableElement && element.closest('.el-table')) && element.getClientRects().length > 0,
    );
    if (!tables.length) return;

    // Keep the path to each visible table, including its scroll container and pagination.
    const branches = new Set<Element>();
    for (const table of tables) {
      let parent = table.parentElement;
      while (parent && root.contains(parent)) {
        branches.add(parent);
        if (parent === root) break;
        parent = parent.parentElement;
      }
    }
    for (const parent of branches) {
      for (const child of parent.children) {
        if (branches.has(child) || tables.includes(child) || child.matches('.el-pagination, .pagination')) continue;
        const element = child as HTMLElement;
        if (element.style.display !== 'none') element.style.display = 'none';
      }
    }
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    height.value = Math.max(160, Math.ceil(root.getBoundingClientRect().bottom) + 12);
    ready.value = true;
    failed.value = false;
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => schedule());
    for (const table of tables) resizeObserver.observe(table);
  };

  function schedule() {
    if (!pendingFrame) pendingFrame = requestAnimationFrame(refresh);
  }
  mutationObserver = new MutationObserver(() => {
    schedule();
  });
  // iframe 的 load 可能早于 Vue 路由挂载；观察 body 才能捕获随后创建的页面和表格。
  mutationObserver.observe(document.body, { childList: true, subtree: true });
  failureTimer = window.setTimeout(() => { if (!ready.value) failed.value = true; }, 10000);
  schedule();
}

onBeforeUnmount(disconnect);
watch(nativePreview, () => { void loadNativePreview(); }, { immediate: true });
</script>

<style scoped>
.dashboard-page-preview {
  display: block;
  width: 100%;
  border: 1px solid var(--admin-border);
  border-radius: 8px;
  background: var(--admin-bg);
}
.preview-state { display:grid; place-items:center; min-height:110px; color:var(--admin-text-muted); font-size:13px; }
.consultation-preview{min-height:150px}
.consultation-preview-summary{margin-bottom:10px;color:var(--admin-text-muted);font-size:12px}
.consultation-preview-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.consultation-preview-card{min-width:0;padding:12px;border:1px solid var(--admin-border);border-radius:10px;background:#fff}
.consultation-preview-head{display:flex;align-items:center;gap:7px;min-width:0}
.consultation-preview-head strong{font-size:14px}
.consultation-preview-head>span{color:var(--admin-text-muted);font-size:12px;white-space:nowrap}
.consultation-preview-head :deep(.el-tag){flex:none;margin-left:auto;max-width:35%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.consultation-preview-main{display:flex;flex-direction:column;gap:2px;margin-top:8px;min-width:0}
.consultation-preview-main strong{font-size:13px;overflow-wrap:anywhere}
.consultation-preview-main span,.consultation-preview-meta{color:var(--admin-text-muted);font-size:12px;overflow-wrap:anywhere}
.consultation-preview-meta{display:flex;justify-content:space-between;gap:8px;margin-top:9px;padding-top:9px;border-top:1px solid var(--admin-border)}
.consultation-preview-meta .overdue{color:#c45656}
@media(max-width:640px){.consultation-preview-list{grid-template-columns:minmax(0,1fr)}.consultation-preview-card{padding:11px}.consultation-preview-meta{display:grid;gap:4px}.consultation-preview-head :deep(.el-tag){max-width:40%}}
</style>
