import { readFile } from 'node:fs/promises';

const articlePath = process.argv[2];
const baseUrl = String(process.env.FXN_ADMIN_API_URL || 'https://wechat.fuxiaonian.net').replace(/\/$/, '');
const username = process.env.FXN_ADMIN_USERNAME;
const password = process.env.FXN_ADMIN_PASSWORD;
if (!articlePath || !username || !password) throw new Error('需要文章文件和后台登录凭据');

const source = JSON.parse(await readFile(articlePath, 'utf8'));
if (!source.title?.trim() || !source.categoryId || !source.contentHtml?.trim() || !source.coverImagePath) {
  throw new Error('文章必须包含 title、categoryId、contentHtml 和 coverImagePath');
}
if (source.status === 'ACTIVE') throw new Error('此同步脚本仅允许保存草稿');

const login = await request('/api/admin/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
const token = login.token;
const author = login.user?.nickname || login.user?.username;
if (!token || !author) throw new Error('登录结果缺少账号名称，已停止同步');

const coverBytes = await readFile(source.coverImagePath);
if (coverBytes.byteLength > 500 * 1024) throw new Error('封面文件超过 500KB 限制');
const form = new FormData();
form.append('file', new Blob([coverBytes], { type: 'image/jpeg' }), 'implant-annual-follow-up-cover.jpg');
const cover = await request('/api/admin/website/article-cover', { method: 'POST', body: form, token });
if (!cover.url) throw new Error('封面上传未返回地址');

const { coverImagePath, aiAssisted, author: _ignoredAuthor, status: _ignoredStatus, ...payload } = source;
payload.author = author;
payload.coverUrl = cover.url;
payload.status = 'DISABLED';
if (aiAssisted && !payload.contentHtml.includes('人工智能辅助')) {
  payload.contentHtml = `<p><strong>内容说明：</strong>本文由人工智能辅助整理，经人工审核后发布。</p>${payload.contentHtml}`;
}

const article = await request('/api/admin/website/articles', { method: 'POST', body: JSON.stringify(payload), token });
console.log(`已同步到管理后台：${article.title}（${article.status === 'DISABLED' ? '草稿' : article.status}；作者：${article.author || author}）`);

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
