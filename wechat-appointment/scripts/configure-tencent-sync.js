const { PrismaClient } = require('/app/node_modules/@prisma/client');
const { createCipheriv, createHash, randomBytes } = require('crypto');

const prisma = new PrismaClient();

function encrypt(value) {
  const iv = randomBytes(12);
  const key = createHash('sha256').update(process.env.PHONE_ENCRYPTION_KEY).digest();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
}

async function readInput() {
  const readline = require('readline');
  const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    lines.close();
    return JSON.parse(line);
  }
  throw new Error('Missing credential input');
}

async function main() {
  const credentials = await readInput();
  const existing = await prisma.promotionDataSyncConfig.findUnique({ where: { provider: 'TENCENT_ADS' } });
  const previousExtra = existing?.extraConfig && typeof existing.extraConfig === 'object' ? existing.extraConfig : {};
  let accessToken = credentials.accessToken;
  let refreshToken = credentials.refreshToken;
  let extraConfig = {
    ...previousExtra,
    clientId: credentials.clientId,
    clientSecretCipher: encrypt(credentials.clientSecret),
    refreshTokenCipher: encrypt(refreshToken),
  };

  await prisma.promotionDataSyncConfig.upsert({
    where: { provider: 'TENCENT_ADS' },
    create: { provider: 'TENCENT_ADS', enabled: true, reportUrl: 'https://api.e.qq.com/v1.3/daily_reports/get', accessTokenCipher: encrypt(accessToken), extraConfig },
    update: { enabled: true, reportUrl: 'https://api.e.qq.com/v1.3/daily_reports/get', accessTokenCipher: encrypt(accessToken), extraConfig },
  });

  const tokenUrl = new URL('https://api.e.qq.com/oauth/token');
  tokenUrl.search = new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken }).toString();
  const tokenResponse = await fetch(tokenUrl);
  const tokenPayload = await tokenResponse.json();
  const tokenOk = Number(tokenPayload?.code) === 0 && Boolean(tokenPayload?.data?.access_token);
  if (tokenOk) {
    const data = tokenPayload.data;
    accessToken = String(data.access_token);
    refreshToken = data.refresh_token ? String(data.refresh_token) : refreshToken;
    extraConfig = {
      ...extraConfig,
      refreshTokenCipher: encrypt(refreshToken),
      authorizedAccountId: data.authorizer_info?.account_id ? String(data.authorizer_info.account_id) : undefined,
      accessTokenExpiresAt: new Date(Date.now() + Number(data.access_token_expires_in || 86400) * 1000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + Number(data.refresh_token_expires_in || 2592000) * 1000).toISOString(),
    };
    await prisma.promotionDataSyncConfig.update({ where: { provider: 'TENCENT_ADS' }, data: { accessTokenCipher: encrypt(accessToken), extraConfig } });
  }

  const accounts = await prisma.promotionAccount.findMany({ where: { status: 'ACTIVE', platform: { contains: '腾讯' } }, select: { name: true, accountNo: true } });
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tests = [];
  for (const account of accounts) {
    if (!account.accountNo) continue;
    const reportUrl = new URL('https://api.e.qq.com/v1.3/daily_reports/get');
    reportUrl.search = new URLSearchParams({
      access_token: accessToken,
      timestamp: String(Math.floor(Date.now() / 1000)),
      nonce: randomBytes(12).toString('hex'),
      account_id: account.accountNo,
      level: 'REPORT_LEVEL_ADVERTISER',
      date_range: JSON.stringify({ start_date: yesterday, end_date: yesterday }),
      group_by: JSON.stringify(['date']),
      fields: JSON.stringify(['date', 'cost', 'impression', 'click', 'conversion']),
      page: '1',
      page_size: '10',
    }).toString();
    const response = await fetch(reportUrl);
    const payload = await response.json();
    tests.push({ account: account.name, accountNo: account.accountNo, code: Number(payload?.code || 0), message: payload?.message_cn || payload?.message || '' });
  }

  const safeResult = {
    saved: true,
    refreshSucceeded: tokenOk,
    refreshCode: Number(tokenPayload?.code || 0),
    refreshMessage: tokenPayload?.message_cn || tokenPayload?.message || '',
    authorizedAccountId: extraConfig.authorizedAccountId || null,
    accessTokenExpiresAt: extraConfig.accessTokenExpiresAt || null,
    refreshTokenExpiresAt: extraConfig.refreshTokenExpiresAt || null,
    accountTests: tests,
  };
  await prisma.promotionDataSyncConfig.update({ where: { provider: 'TENCENT_ADS' }, data: { lastSyncedAt: new Date(), lastSyncMessage: tokenOk ? '腾讯凭证验证成功，自动续期已启用' : `腾讯凭证已保存，刷新验证失败：${safeResult.refreshMessage || safeResult.refreshCode}` } });
  process.stdout.write(JSON.stringify(safeResult));
}

main().catch((error) => {
  process.stderr.write(JSON.stringify({ saved: false, error: error instanceof Error ? error.message : 'unknown error' }));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
