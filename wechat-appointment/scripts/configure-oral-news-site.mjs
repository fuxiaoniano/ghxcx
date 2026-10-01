const baseUrl = String(process.env.FXN_ADMIN_API_URL || 'https://wechat.fuxiaonian.net').replace(/\/$/, '');
const username = process.env.FXN_ADMIN_USERNAME;
const password = process.env.FXN_ADMIN_PASSWORD;
if (!username || !password) throw new Error('请设置 FXN_ADMIN_USERNAME 和 FXN_ADMIN_PASSWORD');

const login = await request('/api/admin/auth/login', { method: 'POST', body: { username, password } });
const settings = await request('/api/admin/website/settings', {
  method: 'PATCH', token: login.token, body: {
    settings: {
      brandName: '傅小念口腔资讯',
      siteTagline: '把口腔知识讲清楚',
      heroTitle: '关于牙齿的事，值得认真弄明白',
      heroDescription: '从日常护理到就诊决策，用易懂、可靠的内容回答每一个真实的口腔健康问题。',
      topics: '牙周健康,儿童口腔,牙齿矫正,种植修复,日常护理',
      footerDescription: '用清晰、可靠的口腔健康内容，帮助每个人做出更安心的健康选择。',
      icpNumber: '',
      defaultAuthor: '傅小念口腔资讯编辑部'
    }
  }
});
console.log(`官网配置已更新：${settings.brandName}`);

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
