export interface Department { id: string; name: string; icon?: string; projects: Project[] }
export interface Project { id: string; categoryId: string; name: string; description?: string }
export interface Clinic { id: string; name: string; address?: string; phone?: string }
export interface Doctor { id: string; name: string; avatar: string; title: string; displayText?: string; specialty: string; description: string; images?: string[]; recommend: boolean; department?: Department; departments?: Department[]; clinic?: Clinic; schedules?: Array<{ id: string; date: string; timeSlot: string; capacity: number; bookedCount: number; status: string }> }
export interface WebsitePage { id: string; slug: string; title: string; menuTitle: string; summary?: string; coverUrl?: string; contentHtml?: string; seoTitle?: string; seoDescription?: string; showInNav: boolean }
export interface Article { id: string; slug: string; title: string; author?: string; digest?: string; coverUrl?: string; contentHtml?: string; sourceUrl?: string; originalUrl?: string; publishedAt?: string }
export interface WebsiteSettings { brandName: string; eyebrow: string; heroTitle: string; heroDescription: string; appointmentUrl: string; appointmentText: string; phone: string; serviceHours: string; address: string; footerDescription: string; icpNumber: string; wechatName: string }
export interface Bootstrap { settings: WebsiteSettings; pages: WebsitePage[]; banners: Array<{ id: string; imageUrl: string; title?: string }>; categories: Department[]; doctors: Doctor[]; articles: Article[]; clinics: Clinic[] }

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

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
  bootstrap: () => api<Bootstrap>('/api/website/bootstrap'),
  page: (slug: string) => api<WebsitePage>(`/api/website/pages/${encodeURIComponent(slug)}`),
  doctors: () => api<Doctor[]>('/api/enterprise/doctors'),
  doctor: (id: string) => api<Doctor>(`/api/enterprise/doctors/${encodeURIComponent(id)}`),
  categories: () => api<Department[]>('/api/enterprise/categories'),
  articles: (page = 1, keyword = '') => api<{ total: number; page: number; pageSize: number; list: Article[] }>(`/api/website/articles?page=${page}&pageSize=12&keyword=${encodeURIComponent(keyword)}`),
  article: (slug: string) => api<Article>(`/api/website/articles/${encodeURIComponent(slug)}`)
};
