import { computed, reactive } from 'vue';
import { Bootstrap, websiteApi } from './api';

const state = reactive<{ data: Bootstrap | null; loading: boolean; error: string }>({ data: null, loading: false, error: '' });
let pending: Promise<void> | null = null;

export function loadSite() {
  if (state.data) return Promise.resolve();
  if (pending) return pending;
  state.loading = true;
  pending = websiteApi.bootstrap().then((data) => { state.data = data; state.error = ''; }).catch((error) => {
    state.error = error instanceof Error ? error.message : '官网内容加载失败';
  }).finally(() => { state.loading = false; pending = null; });
  return pending;
}

export function useSite() {
  return { state, settings: computed(() => state.data?.settings), reload: () => { state.data = null; return loadSite(); } };
}

export function formatDate(value?: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

export function setSeo(title: string, description?: string) {
  document.title = title;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (meta && description) meta.content = description;
}
