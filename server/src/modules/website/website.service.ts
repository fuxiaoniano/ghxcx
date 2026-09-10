import { Injectable } from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/utils/business-exception';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateWebsiteArticleDto, CreateWebsitePageDto, UpdateWebsiteArticleDto, WebsiteArticleQueryDto } from './dto';
import { normalizeWechatText, sanitizeWechatArticleHtml } from './wechat-article-sanitizer';

type AuditContext = { adminUserId: string; ip?: string; userAgent?: string };

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
export class WebsiteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService
  ) {}

  async bootstrap() {
    const [settings, pages, banners, categories, doctors, articles, clinics] = await Promise.all([
      this.settings(),
      this.prisma.websitePage.findMany({ where: { status: ContentStatus.ACTIVE }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }], select: { id: true, slug: true, title: true, menuTitle: true, summary: true, coverUrl: true, showInNav: true } }),
      this.prisma.homeBanner.findMany({ where: { status: ContentStatus.ACTIVE }, orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }], take: 5 }),
      this.prisma.dentalCategory.findMany({ where: { status: ContentStatus.ACTIVE }, select: { id: true, name: true, icon: true }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.doctor.findMany({
        where: { status: ContentStatus.ACTIVE, recommend: true },
        select: {
          id: true, name: true, avatar: true, title: true, displayText: true, specialty: true, recommend: true,
          department: { select: { id: true, name: true, icon: true } },
          departments: { select: { department: { select: { id: true, name: true, icon: true } } } }
        },
        orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }], take: 8
      }),
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
    const [total, rows] = await Promise.all([
      this.prisma.wechatArticle.count({ where }),
      this.prisma.wechatArticle.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }], select: admin
        ? { id: true, wechatArticleId: true, slug: true, title: true, author: true, digest: true, coverUrl: true, status: true, publishedAt: true, lastSyncedAt: true, createdAt: true, updatedAt: true }
        : { id: true, wechatArticleId: true, slug: true, title: true, author: true, digest: true, coverUrl: true, publishedAt: true } })
    ]);
    const list = rows.map((row) => this.articleView(row));
    return { total, page, pageSize, list };
  }

  async article(slug: string) {
    const article = await this.prisma.wechatArticle.findFirst({
      where: { slug, status: ContentStatus.ACTIVE },
      select: { id: true, wechatArticleId: true, slug: true, title: true, author: true, digest: true, coverUrl: true, contentHtml: true, sourceUrl: true, originalUrl: true, publishedAt: true }
    });
    if (!article) throw new BusinessException(404502, '文章不存在或尚未发布');
    return this.articleView(article);
  }

  async adminArticle(id: string) {
    const article = await this.prisma.wechatArticle.findUnique({
      where: { id },
      select: { id: true, wechatArticleId: true, slug: true, title: true, author: true, digest: true, coverUrl: true, contentHtml: true, originalUrl: true, status: true, publishedAt: true, lastSyncedAt: true }
    });
    if (!article) throw new BusinessException(404502, '文章不存在');
    return this.articleView(article);
  }

  async createArticle(dto: CreateWebsiteArticleDto, audit: AuditContext) {
    const sourceId = `manual:${randomUUID()}`;
    const status = dto.status || ContentStatus.ACTIVE;
    const contentHtml = sanitizeWechatArticleHtml(dto.contentHtml);
    if (!contentHtml.trim()) throw new BusinessException(400505, '资讯正文不能为空');
    const article = await this.prisma.wechatArticle.create({
      data: {
        wechatArticleId: sourceId,
        slug: `news-${Date.now()}-${createHash('sha1').update(sourceId).digest('hex').slice(0, 8)}`,
        title: normalizeWechatText(dto.title, 255),
        author: normalizeWechatText(dto.author, 100) || null,
        digest: normalizeWechatText(dto.digest, 2000) || null,
        coverUrl: normalizeWechatText(dto.coverUrl, 1000) || null,
        contentHtml,
        originalUrl: normalizeWechatText(dto.originalUrl, 1000) || null,
        syncHash: createHash('sha256').update(sourceId).digest('hex'),
        status,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : (status === ContentStatus.ACTIVE ? new Date() : null)
      }
    });
    await this.audit('CREATE_WEBSITE_ARTICLE', 'wechat_articles', article.id, undefined, article, audit);
    return this.articleView(article);
  }

  async updateArticle(id: string, dto: UpdateWebsiteArticleDto, audit: AuditContext) {
    const before = await this.prisma.wechatArticle.findUnique({ where: { id } });
    if (!before) throw new BusinessException(404502, '文章不存在');
    const contentHtml = dto.contentHtml === undefined ? undefined : sanitizeWechatArticleHtml(dto.contentHtml);
    if (contentHtml !== undefined && !contentHtml.trim()) throw new BusinessException(400505, '资讯正文不能为空');
    const article = await this.prisma.wechatArticle.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: normalizeWechatText(dto.title, 255) } : {}),
        ...(dto.author !== undefined ? { author: normalizeWechatText(dto.author, 100) || null } : {}),
        ...(dto.digest !== undefined ? { digest: normalizeWechatText(dto.digest, 2000) || null } : {}),
        ...(dto.coverUrl !== undefined ? { coverUrl: normalizeWechatText(dto.coverUrl, 1000) || null } : {}),
        ...(contentHtml !== undefined ? { contentHtml } : {}),
        ...(dto.originalUrl !== undefined ? { originalUrl: normalizeWechatText(dto.originalUrl, 1000) || null } : {}),
        ...(dto.publishedAt !== undefined ? { publishedAt: new Date(dto.publishedAt) } : {}),
        ...(dto.status !== undefined ? { status: dto.status, publishedAt: dto.status === ContentStatus.ACTIVE && !before.publishedAt ? new Date() : undefined } : {})
      }
    });
    await this.audit('UPDATE_WEBSITE_ARTICLE', 'wechat_articles', id, before, article, audit);
    return this.articleView(article);
  }

  async deleteArticle(id: string, audit: AuditContext) {
    const before = await this.prisma.wechatArticle.findUnique({ where: { id } });
    if (!before) throw new BusinessException(404502, '文章不存在');
    await this.prisma.wechatArticle.delete({ where: { id } });
    await this.audit('DELETE_WEBSITE_ARTICLE', 'wechat_articles', id, before, { deleted: true }, audit);
    return { deleted: true };
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

  private articleView<T extends { wechatArticleId: string }>(article: T) {
    const { wechatArticleId, ...publicFields } = article;
    return { ...publicFields, sourceType: wechatArticleId.startsWith('manual:') ? 'MANUAL' : 'WECHAT' };
  }

  private audit(action: string, resourceType: string, resourceId: string | undefined, before: unknown, after: unknown, context: AuditContext) {
    return this.auditLogs.create({ adminUserId: context.adminUserId, action, resourceType, resourceId, beforeJson: before as Prisma.InputJsonValue | undefined, afterJson: after as Prisma.InputJsonValue | undefined, ip: context.ip, userAgent: context.userAgent });
  }
}
