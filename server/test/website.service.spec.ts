import { ContentStatus } from '@prisma/client';
import { WebsiteService } from '../src/modules/website/website.service';

describe('WebsiteService article management', () => {
  function createService() {
    const prisma = {
      wechatArticle: {
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
      author: '院方编辑',
      digest: '术后护理要点',
      contentHtml: '<p>保持清洁</p><script>alert(1)</script>',
      status: ContentStatus.ACTIVE
    }, { adminUserId: 'admin-1' });

    const data = prisma.wechatArticle.create.mock.calls[0][0].data;
    expect(data.wechatArticleId).toMatch(/^manual:/);
    expect(data.title).toBe('种植牙术后护理');
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
});
