import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContentStatus, Prisma } from '@prisma/client';
import axios from 'axios';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/utils/business-exception';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { WechatOfficialAccountService } from '../wechat-official-account/wechat-official-account.service';
import { CreateWebsitePageDto, WebsiteArticleQueryDto } from './dto';
import { normalizeWechatText, sanitizeWechatArticleHtml } from './wechat-article-sanitizer';

type AuditContext = { adminUserId: string; ip?: string; userAgent?: string };
type WechatNewsItem = Record<string, unknown> & {
  title?: string;
  author?: string;
  digest?: string;
  content?: string;
  content_source_url?: string;
  url?: string;
  thumb_url?: string;
};

const DEFAULT_SETTINGS = {
  brandName: '重庆种博士口腔',
  eyebrow: '专注口腔健康 · 规范诊疗服务',
  heroTitle: '让每一次看牙，都更安心从容',
  heroDescription: '汇聚专业口腔医生团队，以规范诊疗流程、数字化设备与细致服务，守护每一位患者的口腔健康。',
  appointmentUrl: '/landing/default',
  appointmentText: '在线预约',
  phone: '',
  serviceHours: '周一至周日 08:30—18:00',
  address: '重庆市',
  footerDescription: '以专业、规范、透明的口腔医疗服务，为山城家庭守护每一颗牙。',
  icpNumber: '',
  wechatName: '重庆种博士口腔'
};

@Injectable()
export class WebsiteService implements OnModuleInit, OnModuleDestroy {
  private syncTimer?: NodeJS.Timeout;
  private startupSyncTimer?: NodeJS.Timeout;
  private syncing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly officialAccount: WechatOfficialAccountService,
    private readonly auditLogs: AuditLogsService
  ) {}

  onModuleInit() {
    if (this.config.get<string>('NODE_ENV') === 'test' || this.config.get<string>('WECHAT_ARTICLE_SYNC_ENABLED') === 'false') return;
    const minutes = Math.max(5, Number(this.config.get<string>('WECHAT_ARTICLE_SYNC_INTERVAL_MINUTES') || 30));
    this.startupSyncTimer = setTimeout(() => void this.syncArticles().catch((error) => {
      console.warn('[website] 微信文章启动同步失败:', error instanceof Error ? error.message : '未知错误');
    }), 15000);
    this.startupSyncTimer.unref();
    this.syncTimer = setInterval(() => void this.syncArticles().catch((error) => {
      console.warn('[website] 微信文章自动同步失败:', error instanceof Error ? error.message : '未知错误');
    }), minutes * 60 * 1000);
    this.syncTimer.unref();
  }

  onModuleDestroy() {
    if (this.startupSyncTimer) clearTimeout(this.startupSyncTimer);
    if (this.syncTimer) clearInterval(this.syncTimer);
  }

  async bootstrap() {
    const [settings, pages, banners, categories, doctors, articles, clinics] = await Promise.all([
      this.settings(),
      this.prisma.websitePage.findMany({ where: { status: ContentStatus.ACTIVE }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }], select: { id: true, slug: true, title: true, menuTitle: true, summary: true, coverUrl: true, showInNav: true } }),
      this.prisma.homeBanner.findMany({ where: { status: ContentStatus.ACTIVE }, orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }], take: 5 }),
      this.prisma.dentalCategory.findMany({ where: { status: ContentStatus.ACTIVE }, include: { projects: { where: { status: ContentStatus.ACTIVE }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.doctor.findMany({ where: { status: ContentStatus.ACTIVE, recommend: true }, include: { department: true, departments: { include: { department: true } }, clinic: true }, orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }], take: 8 }),
      this.prisma.wechatArticle.findMany({ where: { status: ContentStatus.ACTIVE }, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }], take: 6, select: { id: true, slug: true, title: true, author: true, digest: true, coverUrl: true, publishedAt: true } }),
      this.prisma.clinic.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } })
    ]);
    return { settings, pages, banners, categories, doctors: doctors.map((doctor) => this.doctorView(doctor)), articles, clinics };
  }

  async settings() {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'websiteSettings' } });
    return { ...DEFAULT_SETTINGS, ...((row?.valueJson as Record<string, unknown> | undefined) || {}) };
  }

  async updateSettings(settings: Record<string, unknown>, audit: AuditContext) {
    const before = await this.settings();
    const allowed = Object.keys(DEFAULT_SETTINGS);
    const cleaned = Object.fromEntries(allowed.map((key) => [key, normalizeWechatText(settings[key], key.includes('Description') ? 500 : 160)]));
    const value = { ...DEFAULT_SETTINGS, ...cleaned };
    await this.prisma.systemConfig.upsert({ where: { key: 'websiteSettings' }, create: { key: 'websiteSettings', valueJson: value, description: '企业官网基础信息' }, update: { valueJson: value } });
    await this.audit('UPDATE_WEBSITE_SETTINGS', 'website_settings', 'websiteSettings', before, value, audit);
    return value;
  }

  adminPages() {
    return this.prisma.websitePage.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }] });
  }

  async page(slug: string) {
    const page = await this.prisma.websitePage.findFirst({ where: { slug, status: ContentStatus.ACTIVE } });
    if (!page) throw new BusinessException(404501, '页面不存在或尚未发布');
    return page;
  }

  async createPage(dto: CreateWebsitePageDto, audit: AuditContext) {
    const page = await this.prisma.websitePage.create({ data: this.pageData(dto, true) });
    await this.audit('CREATE_WEBSITE_PAGE', 'website_pages', page.id, undefined, page, audit);
    return page;
  }

  async updatePage(id: string, dto: CreateWebsitePageDto, audit: AuditContext) {
    const before = await this.requireAdminPage(id);
    const page = await this.prisma.websitePage.update({ where: { id }, data: this.pageData(dto, false) });
    await this.audit('UPDATE_WEBSITE_PAGE', 'website_pages', id, before, page, audit);
    return page;
  }

  async deletePage(id: string, audit: AuditContext) {
    const before = await this.requireAdminPage(id);
    await this.prisma.websitePage.delete({ where: { id } });
    await this.audit('DELETE_WEBSITE_PAGE', 'website_pages', id, before, { deleted: true }, audit);
    return { deleted: true };
  }

  async articles(query: WebsiteArticleQueryDto, admin = false) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(50, Math.max(1, query.pageSize || 12));
    const keyword = normalizeWechatText(query.keyword, 100);
    const where: Prisma.WechatArticleWhereInput = {
      ...(admin ? {} : { status: ContentStatus.ACTIVE }),
      ...(keyword ? { OR: [{ title: { contains: keyword } }, { digest: { contains: keyword } }, { author: { contains: keyword } }] } : {})
    };
    const [total, list] = await Promise.all([
      this.prisma.wechatArticle.count({ where }),
      this.prisma.wechatArticle.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }], ...(admin ? {} : { select: { id: true, slug: true, title: true, author: true, digest: true, coverUrl: true, publishedAt: true } }) })
    ]);
    return { total, page, pageSize, list };
  }

  async article(slug: string) {
    const article = await this.prisma.wechatArticle.findFirst({ where: { slug, status: ContentStatus.ACTIVE } });
    if (!article) throw new BusinessException(404502, '文章不存在或尚未发布');
    return article;
  }

  async updateArticleStatus(id: string, status: ContentStatus, audit: AuditContext) {
    const before = await this.prisma.wechatArticle.findUnique({ where: { id } });
    if (!before) throw new BusinessException(404502, '文章不存在');
    const article = await this.prisma.wechatArticle.update({ where: { id }, data: { status } });
    await this.audit('UPDATE_WEBSITE_ARTICLE', 'wechat_articles', id, before, article, audit);
    return article;
  }

  async syncArticles(audit?: AuditContext) {
    if (this.syncing) throw new BusinessException(409501, '公众号文章正在同步，请稍后再试');
    this.syncing = true;
    const startedAt = new Date();
    try {
      const accessToken = await this.officialAccount.getAccessToken();
      let source: 'published' | 'material' = 'published';
      let records: Array<{ mediaId: string; index: number; updatedAt?: number; article: WechatNewsItem }>;
      try {
        records = await this.fetchWechatNews(accessToken, 'https://api.weixin.qq.com/cgi-bin/freepublish/batchget');
      } catch {
        source = 'material';
        records = await this.fetchWechatNews(accessToken, 'https://api.weixin.qq.com/cgi-bin/material/batchget_material');
      }
      let created = 0;
      let updated = 0;
      let unchanged = 0;
      for (const record of records) {
        const normalized = this.normalizeWechatArticle(record);
        const existing = await this.prisma.wechatArticle.findUnique({ where: { wechatArticleId: normalized.wechatArticleId } });
        if (existing?.syncHash === normalized.syncHash) {
          await this.prisma.wechatArticle.update({ where: { id: existing.id }, data: { lastSyncedAt: new Date() } });
          unchanged += 1;
          continue;
        }
        await this.prisma.wechatArticle.upsert({
          where: { wechatArticleId: normalized.wechatArticleId },
          create: normalized,
          update: { ...normalized, status: existing?.status || ContentStatus.ACTIVE }
        });
        if (existing) {
          updated += 1;
        } else {
          created += 1;
        }
      }
      const result = { source, total: records.length, created, updated, unchanged, startedAt, finishedAt: new Date() };
      await this.prisma.systemConfig.upsert({ where: { key: 'websiteWechatSyncStatus' }, create: { key: 'websiteWechatSyncStatus', valueJson: result as unknown as Prisma.InputJsonValue, description: '官网微信公众号文章同步状态' }, update: { valueJson: result as unknown as Prisma.InputJsonValue } });
      if (audit) await this.audit('SYNC_WECHAT_ARTICLES', 'wechat_articles', undefined, undefined, result, audit);
      return result;
    } finally {
      this.syncing = false;
    }
  }

  async syncStatus() {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'websiteWechatSyncStatus' } });
    return row?.valueJson || null;
  }

  private async fetchWechatNews(accessToken: string, url: string) {
    const result: Array<{ mediaId: string; index: number; updatedAt?: number; article: WechatNewsItem }> = [];
    let offset = 0;
    const count = 20;
    for (let page = 0; page < 50; page += 1) {
      const isMaterial = url.includes('material');
      const response = await axios.post(url, isMaterial ? { type: 'news', offset, count } : { offset, count, no_content: 0 }, {
        params: { access_token: accessToken }, responseType: 'arraybuffer', timeout: 15000
      });
      const text = new TextDecoder('utf-8').decode(response.data).replace(/^\uFEFF/, '');
      if (text.includes('\uFFFD')) throw new BusinessException(502501, '微信文章返回内容不是有效 UTF-8，已停止同步以避免乱码');
      const payload = JSON.parse(text) as Record<string, any>;
      if (payload.errcode) throw new BusinessException(502502, `微信文章同步失败：${payload.errmsg || payload.errcode}`);
      const items = Array.isArray(payload.item) ? payload.item : [];
      for (const item of items) {
        const newsItems = Array.isArray(item.content?.news_item) ? item.content.news_item : [];
        newsItems.forEach((article: WechatNewsItem, index: number) => result.push({ mediaId: String(item.article_id || item.media_id || ''), index, updatedAt: Number(item.update_time || item.content?.update_time || 0), article }));
      }
      offset += items.length;
      if (!items.length || offset >= Number(payload.total_count || 0)) break;
    }
    return result;
  }

  private normalizeWechatArticle(record: { mediaId: string; index: number; updatedAt?: number; article: WechatNewsItem }) {
    const title = normalizeWechatText(record.article.title, 255) || '未命名文章';
    const wechatArticleId = `${record.mediaId || createHash('sha1').update(String(record.article.url || title)).digest('hex')}:${record.index}`;
    const contentHtml = sanitizeWechatArticleHtml(record.article.content);
    const syncHash = createHash('sha256').update(JSON.stringify({ title, contentHtml, digest: record.article.digest, cover: record.article.thumb_url, updatedAt: record.updatedAt })).digest('hex');
    return {
      wechatArticleId,
      mediaId: record.mediaId || null,
      articleIndex: record.index,
      slug: `wx-${createHash('sha1').update(wechatArticleId).digest('hex').slice(0, 24)}`,
      title,
      author: normalizeWechatText(record.article.author, 100) || null,
      digest: normalizeWechatText(record.article.digest, 2000) || null,
      coverUrl: normalizeWechatText(record.article.thumb_url, 1000) || null,
      contentHtml,
      sourceUrl: normalizeWechatText(record.article.content_source_url, 1000) || null,
      originalUrl: normalizeWechatText(record.article.url, 1000) || null,
      syncHash,
      publishedAt: record.updatedAt ? new Date(record.updatedAt * 1000) : null,
      wechatUpdatedAt: record.updatedAt ? new Date(record.updatedAt * 1000) : null,
      lastSyncedAt: new Date()
    };
  }

  private pageData(dto: CreateWebsitePageDto, creating: boolean) {
    const status = dto.status || ContentStatus.ACTIVE;
    return {
      slug: dto.slug.trim(), title: normalizeWechatText(dto.title, 160), menuTitle: normalizeWechatText(dto.menuTitle, 40),
      summary: normalizeWechatText(dto.summary, 500) || null, coverUrl: normalizeWechatText(dto.coverUrl, 500) || null,
      contentHtml: sanitizeWechatArticleHtml(dto.contentHtml), seoTitle: normalizeWechatText(dto.seoTitle, 160) || null,
      seoDescription: normalizeWechatText(dto.seoDescription, 300) || null, showInNav: dto.showInNav ?? true,
      sort: dto.sort || 0, status, publishedAt: status === ContentStatus.ACTIVE ? new Date() : (creating ? null : undefined)
    };
  }

  private async requireAdminPage(id: string) {
    const page = await this.prisma.websitePage.findUnique({ where: { id } });
    if (!page) throw new BusinessException(404501, '页面不存在');
    return page;
  }

  private doctorView(doctor: any) {
    const departments = doctor.departments?.map((item: any) => item.department) || [];
    return { ...doctor, departments: departments.length ? departments : [doctor.department].filter(Boolean) };
  }

  private audit(action: string, resourceType: string, resourceId: string | undefined, before: unknown, after: unknown, context: AuditContext) {
    return this.auditLogs.create({ adminUserId: context.adminUserId, action, resourceType, resourceId, beforeJson: before as Prisma.InputJsonValue | undefined, afterJson: after as Prisma.InputJsonValue | undefined, ip: context.ip, userAgent: context.userAgent });
  }
}
