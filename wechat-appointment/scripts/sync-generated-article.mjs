import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { basename, dirname, extname, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const articleFile = process.argv[2];
const baseUrl = String(process.env.FXN_ADMIN_API_URL || 'https://wechat.fuxiaonian.net').replace(/\/$/, '');
const username = process.env.FXN_ADMIN_USERNAME;
const password = process.env.FXN_ADMIN_PASSWORD;

if (!articleFile || !username || !password) {
  console.error('用法：设置 FXN_ADMIN_USERNAME、FXN_ADMIN_PASSWORD 后，运行 node scripts/sync-generated-article.mjs <article.json>');
  process.exit(1);
}

const resolvedArticleFile = resolve(articleFile);
const source = JSON.parse(await readFile(resolvedArticleFile, 'utf8'));
if (!source.title?.trim() || !source.categoryId || !source.contentHtml?.trim()) throw new Error('文章必须包含 title、categoryId 和 contentHtml');
const { aiAssisted = true, coverImagePath, ...articlePayload } = source;
if (aiAssisted && !articlePayload.contentHtml.includes('人工智能辅助')) {
  articlePayload.contentHtml = `<p><strong>内容说明：</strong>本文由人工智能辅助整理，经人工审核后发布。</p>${articlePayload.contentHtml}`;
}
if (aiAssisted && !String(coverImagePath || '').trim()) {
  throw new Error('Codex 生成的资讯必须先调用图片生成技能，并在 JSON 中提供 coverImagePath');
}

const login = await request('/api/admin/auth/login', { username, password });
const token = login.token;
if (!token) throw new Error('管理后台登录未返回访问令牌');
articlePayload.author = String(login.user?.username || username).trim();
if (String(coverImagePath || '').trim()) {
  const coverFile = await ensureCoverSize(resolve(dirname(resolvedArticleFile), coverImagePath));
  articlePayload.coverUrl = await uploadCover(coverFile, token);
}

const article = await request('/api/admin/website/articles', {
  ...articlePayload,
  status: articlePayload.status === 'ACTIVE' ? 'ACTIVE' : 'DISABLED'
}, token);

console.log(`已同步到管理后台：${article.title}（${article.status === 'ACTIVE' ? '已发布' : '草稿'}，作者：${articlePayload.author}）`);

async function ensureCoverSize(filePath) {
  const fileInfo = await stat(filePath);
  if (!fileInfo.isFile()) throw new Error(`封面图路径不是文件：${filePath}`);
  if (fileInfo.size <= 500 * 1024) return filePath;

  const parsed = parse(filePath);
  const optimizedPath = join(parsed.dir, `${parsed.name}.optimized.webp`);
  const optimizer = join(dirname(fileURLToPath(import.meta.url)), 'optimize-generated-cover.py');
  const bundledPython = process.platform === 'win32'
    ? resolve(dirname(process.execPath), '..', '..', 'python', 'python.exe')
    : resolve(dirname(process.execPath), '..', '..', 'python', 'bin', 'python3');
  const candidates = [process.env.FXN_PYTHON, bundledPython, process.platform === 'win32' ? 'python' : 'python3'].filter(Boolean);
  let lastError;
  for (const python of [...new Set(candidates)]) {
    try {
      await runProcess(python, [optimizer, filePath, optimizedPath]);
      const optimizedInfo = await stat(optimizedPath);
      if (optimizedInfo.size > 500 * 1024) throw new Error('自动压缩后的封面仍超过 500KB');
      console.log(`封面图已自动压缩：${(fileInfo.size / 1024).toFixed(1)}KB → ${(optimizedInfo.size / 1024).toFixed(1)}KB`);
      return optimizedPath;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`封面图超过 500KB，且自动压缩失败：${lastError?.message || '未找到可用的 Python/Pillow 环境'}`);
}

function runProcess(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolvePromise() : reject(new Error(stderr.trim() || `进程退出码 ${code}`)));
  });
}

async function uploadCover(filePath, token) {
  const extension = extname(filePath).toLowerCase();
  const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  const mimeType = mimeTypes[extension];
  if (!mimeType) throw new Error('封面图仅支持 jpg、jpeg、png 或 webp 格式');
  const fileInfo = await stat(filePath);
  if (!fileInfo.isFile()) throw new Error(`封面图路径不是文件：${filePath}`);
  if (fileInfo.size > 500 * 1024) {
    throw new Error(`封面图大小为 ${(fileInfo.size / 1024).toFixed(1)}KB，必须压缩到 500KB 以内再同步`);
  }
  const form = new FormData();
  form.append('file', new Blob([await readFile(filePath)], { type: mimeType }), basename(filePath));
  const response = await fetch(`${baseUrl}/api/admin/website/article-cover`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    body: form
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new Error(payload?.message || `封面图上传失败：${response.status}`);
  if (payload.code && payload.code !== 0) throw new Error(payload.message || '封面图上传失败');
  const result = Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
  if (!result?.url) throw new Error('封面图上传成功但未返回图片地址');
  return result.url;
}

async function request(path, body, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new Error(payload?.message || `请求失败：${response.status}`);
  if (payload.code && payload.code !== 0) throw new Error(payload.message || '管理后台返回错误');
  return Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
}
