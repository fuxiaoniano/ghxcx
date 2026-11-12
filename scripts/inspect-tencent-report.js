const { PrismaClient } = require('/app/node_modules/@prisma/client');
const { createDecipheriv, createHash, randomBytes } = require('crypto');
const prisma = new PrismaClient();

function decrypt(payload) {
  const [iv, tag, encrypted] = payload.split(':');
  const key = createHash('sha256').update(process.env.PHONE_ENCRYPTION_KEY).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
}

async function get(path, token, params) {
  const url = new URL(`https://api.e.qq.com/${path}`);
  url.search = new URLSearchParams({
    access_token: token,
    timestamp: String(Math.floor(Date.now() / 1000)),
    nonce: randomBytes(12).toString('hex'),
    ...params,
  }).toString();
  const response = await fetch(url);
  const payload = await response.json();
  const list = Array.isArray(payload?.data?.list) ? payload.data.list : [];
  return {
    httpStatus: response.status,
    code: payload?.code,
    message: payload?.message_cn || payload?.message || '',
    listCount: list.length,
    totalNumber: payload?.data?.page_info?.total_number ?? payload?.data?.page_info?.total_count ?? null,
    first: list[0] || null,
    dataKeys: payload?.data && typeof payload.data === 'object' ? Object.keys(payload.data) : [],
    errors: payload?.errors || [],
  };
}

async function main() {
  const date = process.argv[2] || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const config = await prisma.promotionDataSyncConfig.findUniqueOrThrow({ where: { provider: 'TENCENT_ADS' } });
  const extra = config.extraConfig && typeof config.extraConfig === 'object' ? config.extraConfig : {};
  const account = await prisma.promotionAccount.findFirstOrThrow({
    where: { status: 'ACTIVE', platform: { contains: '腾讯' }, accountNo: { not: null } },
    select: { name: true, accountNo: true },
  });
  const token = decrypt(config.accessTokenCipher);
  const reportParams = {
    account_id: account.accountNo,
    level: 'REPORT_LEVEL_ADVERTISER',
    date_range: JSON.stringify({ start_date: date, end_date: date }),
    group_by: JSON.stringify(['date']),
    fields: JSON.stringify([
      'date',
      'cost',
      'view_count',
      'valid_click_count',
      'conversions_count',
      'effective_leads_count',
      'valid_leads_uv',
      'overall_leads_purchase_count',
    ]),
    adq_accounts_upgrade_enabled: 'true',
    page: '1',
    page_size: '10',
  };
  const organizationId = extra.authorizedAccountId ? String(extra.authorizedAccountId) : '';
  const checks = {
    reportV13Account: await get('v1.3/daily_reports/get', token, reportParams),
    reportV30Account: await get('v3.0/daily_reports/get', token, reportParams),
  };
  if (organizationId) {
    checks.reportV30Organization = await get('v3.0/daily_reports/get', token, { ...reportParams, organization_id: organizationId });
    checks.agencyBusinessUnitAccounts = await get('v3.0/agency_business_unit_list_account/get', token, {
      organization_id: organizationId,
      page: '1',
      page_size: '100',
      fields: JSON.stringify(['account_id', 'account_name']),
    });
  }
  process.stdout.write(JSON.stringify({ date, account, organizationId: organizationId || null, checks }));
}

main().catch((error) => {
  process.stderr.write(error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
