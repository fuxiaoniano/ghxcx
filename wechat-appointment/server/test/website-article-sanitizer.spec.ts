import { normalizeWechatText, sanitizeWechatArticleHtml } from '../src/modules/website/wechat-article-sanitizer';

describe('website WeChat article sanitizer', () => {
  it('keeps Chinese UTF-8 text and removes replacement/control characters', () => {
    expect(normalizeWechatText('  重庆种博士\u0000口腔�科普  ')).toBe('重庆种博士口腔科普');
  });

  it('removes scripts and fixed WeChat layout while preserving responsive content', () => {
    const html = sanitizeWechatArticleHtml(`
      <section style="width: 677px; font-family: serif; text-align: center; color: #333333">
        <script>alert(1)</script>
        <p>种植牙术后护理</p>
        <img data-src="https://mmbiz.qpic.cn/example.jpg" width="677" height="400" onerror="alert(1)">
      </section>
    `);
    expect(html).toContain('种植牙术后护理');
    expect(html).toContain('src="https://mmbiz.qpic.cn/example.jpg"');
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('677px');
    expect(html).not.toContain('font-family');
    expect(html).not.toContain('onerror');
  });

  it('normalizes outbound links to safe new tabs', () => {
    const html = sanitizeWechatArticleHtml('<a href="https://example.com">详情</a>');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
