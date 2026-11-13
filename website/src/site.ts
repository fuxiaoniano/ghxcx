import { computed, reactive } from 'vue';
import { Bootstrap, SITE_KEY, websiteApi } from './api';

const CACHE_KEY = `fxn-${SITE_KEY}-news-bootstrap-v1`;
const cached = readCache();
const state = reactive<{ data: Bootstrap | null; loading: boolean; error: string }>({ data: cached, loading: false, error: '' });
let pending: Promise<void> | null = null;
let loadedFromNetwork = false;

export function loadSite() {
  if (loadedFromNetwork && state.data) return Promise.resolve();
  if (pending) return pending;
  state.loading = !state.data;
  pending = websiteApi.bootstrap().then((data) => {
    state.data = data; state.error = ''; loadedFromNetwork = true;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
    setSiteSchema(data.settings);
  }).catch((error) => {
    if (!state.data) state.error = error instanceof Error ? error.message : '官网内容加载失败';
  }).finally(() => { state.loading = false; pending = null; });
  return pending;
}
export function useSite() {
  return { state, settings: computed(() => state.data?.settings), reload: () => { state.data = null; loadedFromNetwork = false; return loadSite(); } };
}
export function formatDate(value?: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
}
export interface SeoMetadata {
  title: string; description?: string; keywords?: string; image?: string; canonicalPath?: string;
  type?: 'website' | 'article'; publishedAt?: string; author?: string;
}
export function setSeo(metadata: SeoMetadata) {
  document.title = metadata.title;
  const fallbackName = SITE_KEY === 'afterbeat' ? 'AfterBeat' : '傅小念口腔资讯';
  setMeta('name', 'description', metadata.description || (SITE_KEY === 'afterbeat' ? 'AfterBeat 热点新闻与趋势观察。' : '傅小念口腔资讯，用清晰、可靠的内容讲明白口腔健康知识。'));
  setMeta('name', 'keywords', metadata.keywords || (SITE_KEY === 'afterbeat' ? '热点新闻,趋势观察,科技,生活' : '口腔健康,牙齿护理,牙周健康,儿童口腔,牙齿矫正'));
  setMeta('name', 'author', metadata.author || fallbackName);
  setMeta('property', 'og:title', metadata.title); setMeta('property', 'og:description', metadata.description || '把口腔知识讲清楚。');
  setMeta('property', 'og:type', metadata.type || 'website'); setMeta('property', 'og:image', absoluteUrl(metadata.image));
  setMeta('property', 'article:published_time', metadata.publishedAt || '');
  const canonical = websiteUrl(metadata.canonicalPath || '/');
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
  link.href = canonical; setMeta('property', 'og:url', canonical);
}
export function setArticleSchema(article: { title: string; digest?: string; author?: string; coverUrl?: string; publishedAt?: string; slug: string }) {
  setJsonLd('article-schema', {
    '@context': 'https://schema.org', '@type': 'Article', headline: article.title,
    description: article.digest || '', image: article.coverUrl ? [absoluteUrl(article.coverUrl)] : undefined,
    datePublished: article.publishedAt, dateModified: article.publishedAt,
    author: { '@type': 'Person', name: article.author || (SITE_KEY === 'afterbeat' ? 'AfterBeat' : '傅小念口腔资讯') },
    publisher: { '@type': 'Organization', name: SITE_KEY === 'afterbeat' ? 'AfterBeat' : '傅小念口腔资讯', url: websiteUrl('/') },
    mainEntityOfPage: websiteUrl(`/articles/${article.slug}`)
  });
}
export function clearArticleSchema() { document.getElementById('article-schema')?.remove(); }
function setSiteSchema(settings: Bootstrap['settings']) {
  setJsonLd('website-schema', {
    '@context': 'https://schema.org', '@type': 'WebSite', name: settings.brandName,
    description: settings.heroDescription, url: websiteUrl('/'),
    potentialAction: { '@type': 'SearchAction', target: `${websiteUrl('/articles')}?keyword={search_term_string}`, 'query-input': 'required name=search_term_string' }
  });
}
function setJsonLd(id: string, value: object) {
  let script = document.getElementById(id) as HTMLScriptElement | null;
  if (!script) { script = document.createElement('script'); script.id = id; script.type = 'application/ld+json'; document.head.appendChild(script); }
  script.textContent = JSON.stringify(value);
}
function setMeta(attribute: 'name' | 'property', key: string, value: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!value) { meta?.remove(); return; }
  if (!meta) { meta = document.createElement('meta'); meta.setAttribute(attribute, key); document.head.appendChild(meta); }
  meta.content = value;
}
function websiteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`, window.location.origin).href;
}
function absoluteUrl(value?: string) { return value ? new URL(value, window.location.origin).href : ''; }
function readCache(): Bootstrap | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null') as { savedAt?: number; data?: Bootstrap } | null;
    return value?.data && value.savedAt && Date.now() - value.savedAt <= 10 * 60 * 1000 ? value.data : null;
  } catch { return null; }
}
