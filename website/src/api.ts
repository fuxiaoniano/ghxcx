export interface Department { id: string; name: string; icon?: string; projects?: Project[] }
export interface Project { id: string; categoryId: string; name: string; description?: string }
export interface Clinic { id: string; name: string; address?: string; phone?: string }
export interface Doctor { id: string; name: string; avatar: string; title: string; displayText?: string; specialty: string; description: string; images?: string[]; recommend: boolean; department?: Department; departments?: Department[]; clinic?: Clinic; schedules?: Array<{ id: string; date: string; timeSlot: string; capacity: number; bookedCount: number; status: string }> }
export interface WebsitePage { id: string; slug: string; title: string; menuTitle: string; summary?: string; coverUrl?: string; contentHtml?: string; seoTitle?: string; seoDescription?: string; showInNav: boolean }
export interface Article { id: string; slug: string; title: string; author?: string; digest?: string; coverUrl?: string; contentHtml?: string; sourceUrl?: string; originalUrl?: string; publishedAt?: string; sourceType?: 'MANUAL' | 'WECHAT' }
export interface WebsiteSettings { brandName: string; eyebrow: string; heroTitle: string; heroDescription: string; appointmentUrl: string; appointmentText: string; phone: string; serviceHours: string; address: string; footerDescription: string; icpNumber: string; wechatName: string }
export interface Bootstrap { settings: WebsiteSettings; pages: WebsitePage[]; banners: Array<{ id: string; imageUrl: string; title?: string }>; categories: Department[]; doctors: Doctor[]; articles: Article[]; clinics: Clinic[] }

import { demoArticles, demoBootstrap, demoCategories, demoDoctors, demoPages } from './demo';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true' || new URLSearchParams(window.location.search).get('demo') === '1';

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
  page: (slug: string) => DEMO_MODE ? demoFind(demoPages, slug, '页面') : api<WebsitePage>(`/api/website/pages/${encodeURIComponent(slug)}`),
  doctors: () => DEMO_MODE ? Promise.resolve(demoDoctors) : api<Doctor[]>('/api/enterprise/doctors'),
  doctor: (id: string) => DEMO_MODE ? demoFind(demoDoctors, id, '医生', 'id') : api<Doctor>(`/api/enterprise/doctors/${encodeURIComponent(id)}`),
  categories: () => DEMO_MODE ? Promise.resolve(demoCategories) : api<Department[]>('/api/enterprise/categories'),
  articles: (page = 1, keyword = '') => DEMO_MODE ? Promise.resolve(demoArticleList(page, keyword)) : api<{ total: number; page: number; pageSize: number; list: Article[] }>(`/api/website/articles?page=${page}&pageSize=12&keyword=${encodeURIComponent(keyword)}`),
  article: (slug: string) => DEMO_MODE ? demoFind(demoArticles, slug, '文章') : api<Article>(`/api/website/articles/${encodeURIComponent(slug)}`)
};

function demoFind<T extends { slug?: string; id: string }>(items: T[], value: string, label: string, field: 'slug' | 'id' = 'slug') {
  const item = items.find((row) => row[field] === value);
  return item ? Promise.resolve(item) : Promise.reject(new Error(`演示${label}不存在`));
}

function demoArticleList(page: number, keyword: string) {
  const normalized = keyword.trim().toLowerCase();
  const list = normalized ? demoArticles.filter((item) => `${item.title}${item.digest || ''}`.toLowerCase().includes(normalized)) : demoArticles;
  return { total: list.length, page, pageSize: 12, list };
}
