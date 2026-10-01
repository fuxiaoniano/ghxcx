const baseUrl = String(process.env.FXN_ADMIN_API_URL || 'https://wechat.fuxiaonian.net').replace(/\/$/, '');
const username = process.env.FXN_ADMIN_USERNAME;
const password = process.env.FXN_ADMIN_PASSWORD;
if (!username || !password) throw new Error('请设置 FXN_ADMIN_USERNAME 和 FXN_ADMIN_PASSWORD');

const login = await request('/api/admin/auth/login', { method: 'POST', body: { username, password } });
const token = login.token;
const result = await request('/api/admin/website/articles?page=1&pageSize=50', { token });

for (const row of result.list) {
  const article = await request(`/api/admin/website/articles/${encodeURIComponent(row.id)}`, { token });
  const contentHtml = String(article.contentHtml || '')
    .replaceAll('种博士口腔健康提示', '傅小念口腔资讯健康提示')
    .replaceAll('重庆种博士口腔', '傅小念口腔资讯')
    .replaceAll('种博士口腔', '傅小念口腔资讯');
  const legacyCover = /(?:zbs|zhongboshi|cqzbskq)/i.test(String(article.coverUrl || ''));
  await request(`/api/admin/website/articles/${encodeURIComponent(row.id)}`, {
    method: 'PATCH', token, body: {
      author: article.author === '站点管理员' ? '傅小念口腔资讯编辑部' : article.author,
      coverUrl: legacyCover ? '' : article.coverUrl,
      contentHtml,
      seoTitle: article.seoTitle || `${article.title}｜傅小念口腔资讯`,
      seoKeywords: article.seoKeywords || keywordsFor(article.title),
      seoDescription: article.seoDescription || article.digest || ''
    }
  });
  console.log(`已清理：${article.title}`);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || (payload.code && payload.code !== 0)) throw new Error(payload?.message || `请求失败：${response.status}`);
  return Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
}

function keywordsFor(title) {
  const values = ['口腔健康', '牙齿护理'];
  if (title.includes('种植')) values.push('种植牙');
  if (title.includes('牙周')) values.push('牙周健康', '牙龈出血');
  return values.join(',');
}
