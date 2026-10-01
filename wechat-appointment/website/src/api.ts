export interface Article {
  id: string; slug: string; title: string; author?: string; digest?: string; seoTitle?: string;
  seoKeywords?: string; seoDescription?: string; coverUrl?: string; contentHtml?: string;
  originalUrl?: string; publishedAt?: string; category?: ArticleCategory;
}
export interface ArticleCategory { id: string; name: string; slug: string; description?: string }
export interface WebsiteSettings {
  brandName: string; siteTagline: string; heroTitle: string; heroDescription: string;
  topics: string; footerDescription: string; icpNumber: string; defaultAuthor: string;
}
export interface Bootstrap { settings: WebsiteSettings; categories: ArticleCategory[]; articles: Article[] }
import { demoArticles, demoBootstrap } from './demo';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const DEMO_REQUESTED = new URLSearchParams(window.location.search).get('demo') === '1';
if (DEMO_REQUESTED) sessionStorage.setItem('fxn-website-demo', '1');
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true' || DEMO_REQUESTED || sessionStorage.getItem('fxn-website-demo') === '1';

export async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
  const payload = await response.json().catch(() => null) as { code?: number; message?: string; data?: T } | T | null;
  if (!response.ok || !payload) throw new Error((payload as { message?: string } | null)?.message || '内容加载失败');
  if (typeof payload === 'object' && payload && 'data' in payload) {
    const wrapped = payload as { code?: number; message?: string; data: T };
    if (wrapped.code && wrapped.code !== 0) throw new Error(wrapped.message || '内容加载失败');
    return wrapped.data;
  }
  return payload as T;
}
export const websiteApi = {
  bootstrap: () => DEMO_MODE ? Promise.resolve(demoBootstrap) : api<Bootstrap>('/api/website/bootstrap'),
  articles: (page = 1, keyword = '', categoryId = '') => DEMO_MODE
    ? Promise.resolve(demoArticleList(page, keyword, categoryId))
    : api<{ total: number; page: number; pageSize: number; list: Article[] }>(`/api/website/articles?page=${page}&pageSize=12&keyword=${encodeURIComponent(keyword)}&categoryId=${encodeURIComponent(categoryId)}`),
  article: (slug: string) => DEMO_MODE
    ? Promise.resolve(demoArticles.find((item) => item.slug === slug)).then((item) => item || Promise.reject(new Error('文章不存在')))
    : api<Article>(`/api/website/articles/${encodeURIComponent(slug)}`)
};
function demoArticleList(page: number, keyword: string, categoryId: string) {
  const normalized = keyword.trim().toLowerCase();
  const list = demoArticles.filter((item) => (!normalized || `${item.title}${item.digest || ''}`.toLowerCase().includes(normalized)) && (!categoryId || item.category?.id === categoryId));
  return { total: list.length, page, pageSize: 12, list };
}
