import { computed, reactive } from 'vue';
import { Bootstrap, websiteApi } from './api';

const CACHE_KEY = 'zbs-website-bootstrap-v1';
const cached = readCache();
const state = reactive<{ data: Bootstrap | null; loading: boolean; error: string }>({ data: cached, loading: false, error: '' });
let pending: Promise<void> | null = null;
let loadedFromNetwork = false;

export function loadSite() {
  if (loadedFromNetwork && state.data) return Promise.resolve();
  if (pending) return pending;
  state.loading = !state.data;
  pending = websiteApi.bootstrap().then((data) => {
    state.data = data;
    state.error = '';
    loadedFromNetwork = true;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  }).catch((error) => {
    if (!state.data) state.error = error instanceof Error ? error.message : '官网内容加载失败';
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

function readCache(): Bootstrap | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null') as { savedAt?: number; data?: Bootstrap } | null;
    if (!value?.data || !value.savedAt || Date.now() - value.savedAt > 10 * 60 * 1000) return null;
    return value.data;
  } catch {
    return null;
  }
}
