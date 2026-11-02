<template>
  <iframe
    :src="path"
    :title="`${title}内容摘要`"
    loading="lazy"
    scrolling="no"
    referrerpolicy="same-origin"
    class="dashboard-page-preview"
    :style="{ height: `${height}px`, visibility: ready ? 'visible' : 'hidden' }"
    @load="preparePreview"
  />
  <div v-if="!ready" class="preview-state">{{ failed ? '暂时无法预览，请打开完整页面' : '正在加载表格…' }}</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

defineProps<{ path: string; title: string }>();
const height = ref(300);
const ready = ref(false);
const failed = ref(false);
let mutationObserver: MutationObserver | undefined;
let resizeObserver: ResizeObserver | undefined;
let pendingFrame = 0;
let failureTimer = 0;

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
</style>
