import { Injectable } from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import dayjs from 'dayjs';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/utils/business-exception';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { WechatOfficialAccountService } from '../wechat-official-account/wechat-official-account.service';
import { CreateWebsiteArticleCategoryDto, CreateWebsiteArticleDto, UpdateWebsiteArticleCategoryDto, UpdateWebsiteArticleDto, WebsiteArticleQueryDto } from './dto';
import { normalizeWechatText, sanitizeWechatArticleHtml } from './wechat-article-sanitizer';

type AuditContext = { adminUserId: string; ip?: string; userAgent?: string };
export type WebsiteSiteKey = 'main' | 'afterbeat';

const DEFAULT_SETTINGS = {
  brandName: '傅小念口腔资讯',
  siteTagline: '把口腔知识讲清楚',
  heroTitle: '关于牙齿的事，值得认真弄明白',
  heroDescription: '从日常护理到就诊决策，用易懂、可靠的内容回答每一个真实的口腔健康问题。',
  topics: '牙周健康,儿童口腔,牙齿矫正,种植修复,日常护理',
  footerDescription: '用清晰、可靠的口腔健康内容，帮助每个人做出更安心的健康选择。',
  icpNumber: '',
  defaultAuthor: '傅小念口腔资讯编辑部'
};
const AFTERBEAT_SETTINGS = {
  brandName: 'AfterBeat', siteTagline: '热点正在发生', heroTitle: '看见正在发生的变化',
  heroDescription: '聚合值得关注的热点新闻，用清晰、可靠的内容梳理事件与趋势。',
  topics: '热点新闻,科技趋势,社会观察,生活方式', footerDescription: '持续关注热点，提供清晰、有价值的信息。',
  icpNumber: '', defaultAuthor: 'AfterBeat 编辑部'
};

@Injectable()
export class WebsiteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly official: WechatOfficialAccountService
  ) {}

  async bootstrap(visitor?: { ip: string; userAgent: string; path: string }, siteKey: WebsiteSiteKey = 'main') {
    const [settings, categories, articles] = await Promise.all([
      this.settings(siteKey),
      this.categories(false, siteKey),
      this.prisma.wechatArticle.findMany({ where: { siteKey, status: ContentStatus.ACTIVE }, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }], take: 7, select: { id: true, slug: true, title: true, author: true, digest: true, coverUrl: true, publishedAt: true, category: { select: { id: true, name: true, slug: true } } } }),
      visitor ? this.trackVisit(visitor, siteKey).catch(() => undefined) : Promise.resolve()
    ]);
    return { settings, categories, articles };
  }

  async analytics(siteKey: WebsiteSiteKey = 'main') {
    const today = this.shanghaiDate();
    const weekday = dayjs(today).day();
    const weekStart = dayjs(today).subtract((weekday + 6) % 7, 'day').format('YYYY-MM-DD');
    const monthStart = dayjs(today).startOf('month').format('YYYY-MM-DD');
    const yearStart = dayjs(today).startOf('year').format('YYYY-MM-DD');
    const [todayVisitors, weekVisitors, monthVisitors, yearVisitors, totalVisitors] = await Promise.all([
      this.distinctVisitors(today, siteKey), this.distinctVisitors(weekStart, siteKey), this.distinctVisitors(monthStart, siteKey), this.distinctVisitors(yearStart, siteKey), this.distinctVisitors(undefined, siteKey)
    ]);
    return { today: todayVisitors, week: weekVisitors, month: monthVisitors, year: yearVisitors, total: totalVisitors, statDate: today };
  }

  private async trackVisit(visitor: { ip: string; userAgent: string; path: string }, siteKey: WebsiteSiteKey) {
    if (!visitor.ip || /bot|crawler|spider|slurp|headless|curl|wget|monitor/i.test(visitor.userAgent)) return;
    const salt = process.env.WEBSITE_ANALYTICS_SALT || process.env.JWT_SECRET || 'fxn-website-analytics';
    const visitorHash = createHash('sha256').update(`${salt}|${visitor.ip}|${visitor.userAgent}`).digest('hex');
    const statDate = new Date(`${this.shanghaiDate()}T00:00:00.000Z`);
    const path = visitor.path.slice(0, 255);
    await this.prisma.websiteVisitorDaily.upsert({
      where: { siteKey_visitorHash_statDate: { siteKey, visitorHash, statDate } },
      create: { siteKey, visitorHash, statDate, firstPath: path, lastPath: path },
      update: { viewCount: { increment: 1 }, lastPath: path, lastVisitedAt: new Date() }
    });
  }

  private async distinctVisitors(dateFrom?: string, siteKey: WebsiteSiteKey = 'main') {
    const rows = await this.prisma.websiteVisitorDaily.findMany({
      where: { siteKey, ...(dateFrom ? { statDate: { gte: new Date(`${dateFrom}T00:00:00.000Z`) } } : {}) },
      distinct: ['visitorHash'], select: { visitorHash: true }
    });
    return rows.length;
  }

  private shanghaiDate() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  async settings(siteKey: WebsiteSiteKey = 'main') {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: this.settingsKey(siteKey) } });
    const defaults = siteKey === 'afterbeat' ? AFTERBEAT_SETTINGS : DEFAULT_SETTINGS;
    return { ...defaults, ...((row?.valueJson as Record<string, unknown> | undefined) || {}) };
  }

  async updateSettings(settings: Record<string, unknown>, audit: AuditContext, siteKey: WebsiteSiteKey = 'main') {
    const before = await this.settings(siteKey);
    const defaults = siteKey === 'afterbeat' ? AFTERBEAT_SETTINGS : DEFAULT_SETTINGS;
    const allowed = Object.keys(defaults);
    const cleaned = Object.fromEntries(allowed.map((key) => [key, normalizeWechatText(settings[key], key.includes('Description') ? 500 : 160)]));
    const value = { ...defaults, ...cleaned };
    const key = this.settingsKey(siteKey);
    await this.prisma.systemConfig.upsert({ where: { key }, create: { key, valueJson: value, description: `${siteKey === 'afterbeat' ? 'AfterBeat' : '企业官网'}基础信息` }, update: { valueJson: value } });
    await this.audit('UPDATE_WEBSITE_SETTINGS', 'website_settings', key, before, value, audit);
    return value;
  }

  async sitemap(baseUrl: string, siteKey: WebsiteSiteKey = 'main') {
    const articles = await this.prisma.wechatArticle.findMany({
      where: { siteKey, status: ContentStatus.ACTIVE }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }
    });
    const prefix = siteKey === 'main' ? '/website' : '';
    const urls = [
      { loc: `${baseUrl}${prefix}/`, updatedAt: new Date() },
      { loc: `${baseUrl}${prefix}/articles`, updatedAt: articles[0]?.updatedAt || new Date() },
      { loc: `${baseUrl}${prefix}/disclaimer`, updatedAt: new Date('2026-09-26T00:00:00+08:00') },
      ...articles.map((article) => ({ loc: `${baseUrl}${prefix}/articles/${encodeURIComponent(article.slug)}`, updatedAt: article.updatedAt }))
    ];
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((item) => `  <url><loc>${item.loc}</loc><lastmod>${item.updatedAt.toISOString()}</lastmod></url>`).join('\n')}\n</urlset>`;
  }

  categories(admin = false, siteKey: WebsiteSiteKey = 'main') {
    return this.prisma.websiteArticleCategory.findMany({
      where: { siteKey, ...(admin ? {} : { status: ContentStatus.ACTIVE }) },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
      include: admin ? { _count: { select: { articles: true } } } : undefined
    });
  }

  async createCategory(dto: CreateWebsiteArticleCategoryDto, audit: AuditContext, siteKey: WebsiteSiteKey = 'main') {
    const category = await this.prisma.websiteArticleCategory.create({ data: {
      siteKey, name: normalizeWechatText(dto.name, 40), slug: dto.slug.trim(), description: normalizeWechatText(dto.description, 300) || null,
      sort: dto.sort || 0, status: dto.status || ContentStatus.ACTIVE
    } });
    await this.audit('CREATE_WEBSITE_ARTICLE_CATEGORY', 'website_article_categories', category.id, undefined, category, audit);
    return category;
  }

  async updateCategory(id: string, dto: UpdateWebsiteArticleCategoryDto, audit: AuditContext, siteKey: WebsiteSiteKey = 'main') {
    const before = await this.prisma.websiteArticleCategory.findFirst({ where: { id, siteKey } });
    if (!before) throw new BusinessException(404503, '资讯分类不存在');
    const category = await this.prisma.websiteArticleCategory.update({ where: { id }, data: {
      ...(dto.name !== undefined ? { name: normalizeWechatText(dto.name, 40) } : {}),
      ...(dto.slug !== undefined ? { slug: dto.slug.trim() } : {}),
      ...(dto.description !== undefined ? { description: normalizeWechatText(dto.description, 300) || null } : {}),
      ...(dto.sort !== undefined ? { sort: dto.sort } : {}), ...(dto.status !== undefined ? { status: dto.status } : {})
    } });
    await this.audit('UPDATE_WEBSITE_ARTICLE_CATEGORY', 'website_article_categories', id, before, category, audit);
    return category;
  }

  async deleteCategory(id: string, audit: AuditContext, siteKey: WebsiteSiteKey = 'main') {
    const before = await this.prisma.websiteArticleCategory.findFirst({ where: { id, siteKey }, include: { _count: { select: { articles: true } } } });
    if (!before) throw new BusinessException(404503, '资讯分类不存在');
    if (before._count.articles > 0) throw new BusinessException(400506, '该分类下仍有文章，请先移动或删除文章');
    await this.prisma.websiteArticleCategory.delete({ where: { id } });
    await this.audit('DELETE_WEBSITE_ARTICLE_CATEGORY', 'website_article_categories', id, before, { deleted: true }, audit);
    return { deleted: true };
  }

  async articles(query: WebsiteArticleQueryDto, admin = false, siteKey: WebsiteSiteKey = 'main') {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(50, Math.max(1, query.pageSize || 12));
    const keyword = normalizeWechatText(query.keyword, 100);
    const where: Prisma.WechatArticleWhereInput = {
      siteKey,
      ...(admin ? (query.status ? { status: query.status } : {}) : { status: ContentStatus.ACTIVE }),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(keyword ? { OR: [{ title: { contains: keyword } }, { digest: { contains: keyword } }, { author: { contains: keyword } }] } : {})
    };
    const [total, rows] = await Promise.all([
      this.prisma.wechatArticle.count({ where }),
      this.prisma.wechatArticle.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }], select: admin
        ? { id: true, wechatArticleId: true, mediaId: true, slug: true, title: true, author: true, digest: true, seoTitle: true, seoKeywords: true, seoDescription: true, coverUrl: true, status: true, viewCount: true, publishedAt: true, lastSyncedAt: true, createdAt: true, updatedAt: true, categoryId: true, category: { select: { id: true, name: true, slug: true } } }
        : { id: true, wechatArticleId: true, slug: true, title: true, author: true, digest: true, coverUrl: true, publishedAt: true, category: { select: { id: true, name: true, slug: true } } } })
    ]);
    const list = rows.map((row) => this.articleView(row));
    return { total, page, pageSize, list };
  }

  async article(slug: string, siteKey: WebsiteSiteKey = 'main') {
    const article = await this.prisma.wechatArticle.findFirst({
      where: { slug, siteKey, status: ContentStatus.ACTIVE },
      select: { id: true, wechatArticleId: true, slug: true, title: true, author: true, digest: true, seoTitle: true, seoKeywords: true, seoDescription: true, coverUrl: true, contentHtml: true, sourceUrl: true, originalUrl: true, publishedAt: true, viewCount: true, category: { select: { id: true, name: true, slug: true } } }
    });
    if (!article) throw new BusinessException(404502, '文章不存在或尚未发布');
    const counted = await this.prisma.wechatArticle.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } });
    return this.articleView({ ...article, viewCount: counted.viewCount });
  }

  async adminArticle(id: string, siteKey: WebsiteSiteKey = 'main') {
    const article = await this.prisma.wechatArticle.findFirst({
      where: { id, siteKey },
      select: { id: true, wechatArticleId: true, mediaId: true, slug: true, title: true, author: true, digest: true, seoTitle: true, seoKeywords: true, seoDescription: true, coverUrl: true, contentHtml: true, originalUrl: true, status: true, viewCount: true, publishedAt: true, lastSyncedAt: true, categoryId: true, category: { select: { id: true, name: true, slug: true } } }
    });
    if (!article) throw new BusinessException(404502, '文章不存在');
    return this.articleView(article);
  }

  async createArticle(dto: CreateWebsiteArticleDto, audit: AuditContext, siteKey: WebsiteSiteKey = 'main') {
    await this.requireCategory(dto.categoryId, siteKey);
    const sourceId = `manual:${siteKey}:${randomUUID()}`;
    const status = dto.status || ContentStatus.ACTIVE;
    const contentHtml = sanitizeWechatArticleHtml(dto.contentHtml);
    if (!contentHtml.trim()) throw new BusinessException(400505, '资讯正文不能为空');
    const article = await this.prisma.wechatArticle.create({
      data: {
        siteKey,
        wechatArticleId: sourceId,
        slug: `news-${Date.now()}-${createHash('sha1').update(sourceId).digest('hex').slice(0, 8)}`,
        title: normalizeWechatText(dto.title, 255),
        categoryId: dto.categoryId,
        author: normalizeWechatText(dto.author, 100) || null,
        digest: normalizeWechatText(dto.digest, 2000) || null,
        seoTitle: normalizeWechatText(dto.seoTitle, 160) || null,
        seoKeywords: normalizeWechatText(dto.seoKeywords, 300) || null,
        seoDescription: normalizeWechatText(dto.seoDescription, 300) || null,
        coverUrl: normalizeWechatText(dto.coverUrl, 1000) || null,
        contentHtml,
        originalUrl: normalizeWechatText(dto.originalUrl, 1000) || null,
        syncHash: createHash('sha256').update(sourceId).digest('hex'),
        status,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : (status === ContentStatus.ACTIVE ? new Date() : null)
      }
    });
    await this.audit('CREATE_WEBSITE_ARTICLE', 'wechat_articles', article.id, undefined, article, audit);
    await this.syncWhenEnabled(article.id, audit, siteKey);
    return this.articleView(article);
  }

  async updateArticle(id: string, dto: UpdateWebsiteArticleDto, audit: AuditContext, siteKey: WebsiteSiteKey = 'main') {
    const before = await this.prisma.wechatArticle.findFirst({ where: { id, siteKey } });
    if (!before) throw new BusinessException(404502, '文章不存在');
    if (dto.categoryId !== undefined) await this.requireCategory(dto.categoryId, siteKey);
    const contentHtml = dto.contentHtml === undefined ? undefined : sanitizeWechatArticleHtml(dto.contentHtml);
    if (contentHtml !== undefined && !contentHtml.trim()) throw new BusinessException(400505, '资讯正文不能为空');
    const article = await this.prisma.wechatArticle.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: normalizeWechatText(dto.title, 255) } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.author !== undefined ? { author: normalizeWechatText(dto.author, 100) || null } : {}),
        ...(dto.digest !== undefined ? { digest: normalizeWechatText(dto.digest, 2000) || null } : {}),
        ...(dto.seoTitle !== undefined ? { seoTitle: normalizeWechatText(dto.seoTitle, 160) || null } : {}),
        ...(dto.seoKeywords !== undefined ? { seoKeywords: normalizeWechatText(dto.seoKeywords, 300) || null } : {}),
        ...(dto.seoDescription !== undefined ? { seoDescription: normalizeWechatText(dto.seoDescription, 300) || null } : {}),
        ...(dto.coverUrl !== undefined ? { coverUrl: normalizeWechatText(dto.coverUrl, 1000) || null } : {}),
        ...(contentHtml !== undefined ? { contentHtml } : {}),
        ...(dto.originalUrl !== undefined ? { originalUrl: normalizeWechatText(dto.originalUrl, 1000) || null } : {}),
        ...(dto.publishedAt !== undefined ? { publishedAt: new Date(dto.publishedAt) } : {}),
        ...(dto.status !== undefined ? { status: dto.status, publishedAt: dto.status === ContentStatus.ACTIVE && !before.publishedAt ? new Date() : undefined } : {})
      }
    });
    await this.audit('UPDATE_WEBSITE_ARTICLE', 'wechat_articles', id, before, article, audit);
    await this.syncWhenEnabled(article.id, audit, siteKey);
    return this.articleView(article);
  }

  async officialDraftSyncSettings(siteKey: WebsiteSiteKey = 'main') {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: this.draftSettingsKey(siteKey) } });
    const value = row?.valueJson as { enabled?: boolean; headerHtml?: string; footerHtml?: string } | null;
    return { enabled: Boolean(value?.enabled), headerHtml: String(value?.headerHtml || ''), footerHtml: String(value?.footerHtml || '') };
  }

  async updateOfficialDraftSync(input: { enabled?: boolean; headerHtml?: string; footerHtml?: string }, audit: AuditContext, siteKey: WebsiteSiteKey = 'main') {
    const before = await this.officialDraftSyncSettings(siteKey);
    const value = {
      enabled: input.enabled === undefined ? before.enabled : Boolean(input.enabled),
      headerHtml: input.headerHtml === undefined ? before.headerHtml : sanitizeWechatArticleHtml(input.headerHtml),
      footerHtml: input.footerHtml === undefined ? before.footerHtml : sanitizeWechatArticleHtml(input.footerHtml)
    };
    const key = this.draftSettingsKey(siteKey);
    await this.prisma.systemConfig.upsert({ where: { key }, create: { key, valueJson: value, description: `${siteKey === 'afterbeat' ? 'AfterBeat 热点新闻' : '官网资讯'}自动同步公众号草稿箱及默认头尾内容` }, update: { valueJson: value } });
    await this.audit('UPDATE_WEBSITE_OFFICIAL_DRAFT_SYNC', 'system_configs', key, before, value, audit);
    return value;
  }

  async syncArticleToOfficialDraft(id: string, audit: AuditContext, siteKey: WebsiteSiteKey = 'main') {
    const article = await this.prisma.wechatArticle.findFirst({ where: { id, siteKey } });
    if (!article) throw new BusinessException(404502, '文章不存在');
    const settings = await this.officialDraftSyncSettings(siteKey);
    const result = await this.official.createArticleDraft({ title: article.title, author: article.author || '', digest: article.digest || '', coverUrl: article.coverUrl || '', contentHtml: `${settings.headerHtml}${article.contentHtml}${settings.footerHtml}`, contentSourceUrl: article.originalUrl || '' });
    const updated = await this.prisma.wechatArticle.update({ where: { id }, data: { mediaId: result.mediaId, lastSyncedAt: new Date() } });
    await this.audit('SYNC_WEBSITE_ARTICLE_TO_OFFICIAL_DRAFT', 'wechat_articles', id, article, { mediaId: result.mediaId }, audit);
    return { ...this.articleView(updated), officialDraftMediaId: result.mediaId };
  }

  private async syncWhenEnabled(id: string, audit: AuditContext, siteKey: WebsiteSiteKey) {
    if (!(await this.officialDraftSyncSettings(siteKey)).enabled) return;
    try { await this.syncArticleToOfficialDraft(id, audit, siteKey); }
    catch (error) { await this.audit('SYNC_WEBSITE_ARTICLE_TO_OFFICIAL_DRAFT_FAILED', 'wechat_articles', id, undefined, { error: error instanceof Error ? error.message : 'unknown error' }, audit); }
  }

  async deleteArticle(id: string, audit: AuditContext, siteKey: WebsiteSiteKey = 'main') {
    const before = await this.prisma.wechatArticle.findFirst({ where: { id, siteKey } });
    if (!before) throw new BusinessException(404502, '文章不存在');
    await this.prisma.wechatArticle.delete({ where: { id } });
    await this.audit('DELETE_WEBSITE_ARTICLE', 'wechat_articles', id, before, { deleted: true }, audit);
    return { deleted: true };
  }

  private articleView<T extends { wechatArticleId: string }>(article: T) {
    const { wechatArticleId, ...publicFields } = article;
    return { ...publicFields, sourceType: wechatArticleId.startsWith('manual:') ? 'MANUAL' : 'WECHAT' };
  }

  private async requireCategory(id: string, siteKey: WebsiteSiteKey) {
    const category = await this.prisma.websiteArticleCategory.findFirst({ where: { id, siteKey } });
    if (!category) throw new BusinessException(404503, '资讯分类不存在');
    return category;
  }

  private settingsKey(siteKey: WebsiteSiteKey) { return siteKey === 'afterbeat' ? 'afterbeatWebsiteSettings' : 'websiteSettings'; }
  private draftSettingsKey(siteKey: WebsiteSiteKey) { return siteKey === 'afterbeat' ? 'afterbeatOfficialDraftSync' : 'websiteOfficialDraftSync'; }

  private audit(action: string, resourceType: string, resourceId: string | undefined, before: unknown, after: unknown, context: AuditContext) {
    return this.auditLogs.create({ adminUserId: context.adminUserId, action, resourceType, resourceId, beforeJson: before as Prisma.InputJsonValue | undefined, afterJson: after as Prisma.InputJsonValue | undefined, ip: context.ip, userAgent: context.userAgent });
  }
}
