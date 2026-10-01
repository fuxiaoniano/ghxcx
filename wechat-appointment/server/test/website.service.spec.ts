import { ContentStatus } from '@prisma/client';
import { WebsiteService } from '../src/modules/website/website.service';

describe('WebsiteService article management', () => {
  function createService() {
    const prisma = {
      websiteArticleCategory: {
        findUnique: jest.fn().mockResolvedValue({ id: 'wac_implant', name: '种植修复' })
      },
      wechatArticle: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'article-1', ...data })),
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({
          id: 'article-1',
          wechatArticleId: 'manual:test',
          slug: 'news-test',
          title: '更新后的资讯',
          contentHtml: '<p>正文</p>',
          status: ContentStatus.ACTIVE,
          ...data
        })),
        delete: jest.fn()
      }
    };
    const auditLogs = { create: jest.fn().mockResolvedValue(undefined) };
    return {
      service: new WebsiteService(prisma as any, auditLogs as any),
      prisma,
      auditLogs
    };
  }

  it('creates a sanitized manual article that can be displayed on the website', async () => {
    const { service, prisma, auditLogs } = createService();

    const result = await service.createArticle({
      title: '  种植牙术后护理  ',
      categoryId: 'wac_implant',
      author: '院方编辑',
      digest: '术后护理要点',
      seoTitle: '种植牙术后护理指南',
      seoKeywords: '种植牙,术后护理',
      seoDescription: '了解种植牙术后清洁、饮食和复查注意事项。',
      contentHtml: '<p>保持清洁</p><script>alert(1)</script>',
      status: ContentStatus.ACTIVE
    }, { adminUserId: 'admin-1' });

    const data = prisma.wechatArticle.create.mock.calls[0][0].data;
    expect(data.wechatArticleId).toMatch(/^manual:/);
    expect(data.title).toBe('种植牙术后护理');
    expect(data.seoTitle).toBe('种植牙术后护理指南');
    expect(data.seoKeywords).toBe('种植牙,术后护理');
    expect(data.seoDescription).toBe('了解种植牙术后清洁、饮食和复查注意事项。');
    expect(data.contentHtml).toContain('保持清洁');
    expect(data.contentHtml).not.toContain('script');
    expect(result.sourceType).toBe('MANUAL');
    expect(auditLogs.create).toHaveBeenCalled();
  });

  it('allows historical imported articles to be maintained after sync removal', async () => {
    const { service, prisma } = createService();
    prisma.wechatArticle.findUnique.mockResolvedValue({
      id: 'wx-article',
      wechatArticleId: 'media-id:0',
      title: '公众号文章',
      status: ContentStatus.ACTIVE,
      publishedAt: new Date()
    });
    prisma.wechatArticle.update.mockResolvedValue({
      id: 'wx-article',
      wechatArticleId: 'media-id:0',
      title: '历史资讯已更新',
      contentHtml: '<p>正文</p>',
      status: ContentStatus.ACTIVE
    });

    const result = await service.updateArticle('wx-article', { title: '历史资讯已更新' }, { adminUserId: 'admin-1' });

    expect(prisma.wechatArticle.update).toHaveBeenCalled();
    expect(result.title).toBe('历史资讯已更新');
  });

  it('allows synchronized articles to be hidden without changing their content', async () => {
    const { service, prisma } = createService();
    prisma.wechatArticle.findUnique.mockResolvedValue({
      id: 'wx-article',
      wechatArticleId: 'media-id:0',
      title: '公众号文章',
      status: ContentStatus.ACTIVE,
      publishedAt: new Date()
    });
    prisma.wechatArticle.update.mockResolvedValue({
      id: 'wx-article',
      wechatArticleId: 'media-id:0',
      title: '公众号文章',
      status: ContentStatus.DISABLED
    });

    const result = await service.updateArticle('wx-article', { status: ContentStatus.DISABLED }, { adminUserId: 'admin-1' });

    expect(prisma.wechatArticle.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'wx-article' },
      data: expect.objectContaining({ status: ContentStatus.DISABLED })
    }));
    expect(result.sourceType).toBe('WECHAT');
  });

  it('allows historical imported articles to be deleted', async () => {
    const { service, prisma } = createService();
    prisma.wechatArticle.findUnique.mockResolvedValue({
      id: 'wx-article',
      wechatArticleId: 'media-id:0',
      title: '历史资讯',
      status: ContentStatus.DISABLED
    });

    await expect(service.deleteArticle('wx-article', { adminUserId: 'admin-1' })).resolves.toEqual({ deleted: true });
    expect(prisma.wechatArticle.delete).toHaveBeenCalledWith({ where: { id: 'wx-article' } });
  });

  it('filters the admin article list by website visibility status', async () => {
    const { service, prisma } = createService();

    await service.articles({ page: 1, pageSize: 50, status: ContentStatus.DISABLED }, true);

    expect(prisma.wechatArticle.count).toHaveBeenCalledWith({ where: { status: ContentStatus.DISABLED } });
    expect(prisma.wechatArticle.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: ContentStatus.DISABLED }
    }));
  });

  it('increments only the total read count when a published article is opened', async () => {
    const { service, prisma } = createService();
    prisma.wechatArticle.findFirst.mockResolvedValue({
      id: 'article-1',
      wechatArticleId: 'manual:test',
      slug: 'news-test',
      title: '口腔资讯',
      status: ContentStatus.ACTIVE,
      viewCount: 4,
      category: { id: 'wac_implant', name: '种植修复', slug: 'implant' }
    });
    prisma.wechatArticle.update.mockResolvedValue({ viewCount: 5 });

    const result = await service.article('news-test');

    expect(prisma.wechatArticle.update).toHaveBeenCalledWith({
      where: { id: 'article-1' },
      data: { viewCount: { increment: 1 } }
    });
    expect(result.viewCount).toBe(5);
  });
});
