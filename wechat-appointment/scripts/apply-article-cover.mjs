import { readFile } from 'node:fs/promises';

const [title, coverPath] = process.argv.slice(2);
const baseUrl = String(process.env.FXN_ADMIN_API_URL || 'https://wechat.fuxiaonian.net').replace(/\/$/, '');
const username = process.env.FXN_ADMIN_USERNAME;
const password = process.env.FXN_ADMIN_PASSWORD;

if (!title || !coverPath || !username || !password) {
  throw new Error('需要文章标题、封面路径和后台登录凭据');
}

const login = await request('/api/admin/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
const token = login.token;
if (!token) throw new Error('管理后台登录未返回访问令牌');

const articles = await request('/api/admin/website/articles?page=1&pageSize=100', { token });
const article = articles.list?.find((item) => item.title === title);
if (!article) throw new Error('未找到需要更新封面的草稿');
if (article.status !== 'DISABLED') throw new Error('目标文章不是草稿，已停止更新');

const imageBytes = await readFile(coverPath);
const form = new FormData();
form.append('file', new Blob([imageBytes], { type: 'image/jpeg' }), 'implant-brand-differences-cover.jpg');
const uploaded = await request('/api/admin/website/article-cover', { method: 'POST', body: form, token });
if (!uploaded.url) throw new Error('封面上传未返回地址');

const updated = await request(`/api/admin/website/articles/${encodeURIComponent(article.id)}`, {
  method: 'PATCH',
  token,
  body: JSON.stringify({ coverUrl: uploaded.url, status: 'DISABLED' })
});

console.log(`草稿封面已更新：${updated.title || title}（${updated.status === 'DISABLED' ? '草稿' : updated.status}）`);

async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
    body
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new Error(payload?.message || `请求失败：${response.status}`);
  if (payload.code && payload.code !== 0) throw new Error(payload.message || '管理后台返回错误');
  return Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
}
