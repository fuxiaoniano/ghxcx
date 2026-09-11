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

export interface SeoMetadata {
  title: string;
  description?: string;
  keywords?: string;
  image?: string;
  canonicalPath?: string;
  type?: 'website' | 'article';
  publishedAt?: string;
}

export function setSeo(metadata: SeoMetadata) {
  document.title = metadata.title;
  setMeta('name', 'description', metadata.description || '重庆种博士口腔官方网站，提供口腔科室、医生团队、健康科普与在线预约服务。');
  setMeta('name', 'keywords', metadata.keywords || '');
  setMeta('property', 'og:title', metadata.title);
  setMeta('property', 'og:description', metadata.description || '');
  setMeta('property', 'og:type', metadata.type || 'website');
  setMeta('property', 'og:image', absoluteUrl(metadata.image));
  setMeta('property', 'article:published_time', metadata.publishedAt || '');

  const canonical = websiteUrl(metadata.canonicalPath || '/');
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = canonical;
  setMeta('property', 'og:url', canonical);
}

function setMeta(attribute: 'name' | 'property', key: string, value: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!value) {
    meta?.remove();
    return;
  }
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, key);
    document.head.appendChild(meta);
  }
  meta.content = value;
}

function websiteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return new URL(`${base}${normalized}`, window.location.origin).href;
}

function absoluteUrl(value?: string) {
  if (!value) return '';
  return new URL(value, window.location.origin).href;
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
