const { PrismaClient } = require('/app/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [config, metrics] = await Promise.all([
    prisma.promotionDataSyncConfig.findUnique({ where: { provider: 'TENCENT_ADS' } }),
    prisma.promotionDailyMetric.findMany({
      where: { statDate: new Date('2026-09-27T00:00:00.000Z'), syncSource: 'TENCENT_ADS' },
      select: { spend: true, impressions: true, clicks: true, leads: true, validLeads: true, account: { select: { name: true, accountNo: true } } },
      orderBy: { account: { name: 'asc' } },
    }),
  ]);
  const extra = config?.extraConfig && typeof config.extraConfig === 'object' ? config.extraConfig : {};
  process.stdout.write(JSON.stringify({
    enabled: config?.enabled || false,
    hasAccessToken: Boolean(config?.accessTokenCipher),
    hasRefreshToken: Boolean(extra.refreshTokenCipher),
    hasClientSecret: Boolean(extra.clientSecretCipher),
    clientId: extra.clientId || null,
    authorizedAccountId: extra.authorizedAccountId || null,
    accessTokenExpiresAt: extra.accessTokenExpiresAt || null,
    refreshTokenExpiresAt: extra.refreshTokenExpiresAt || null,
    lastSyncMessage: config?.lastSyncMessage || null,
    syncedAccounts: metrics.map((item) => ({
      name: item.account.name,
      accountNo: item.account.accountNo,
      spend: Number(item.spend),
      impressions: item.impressions,
      clicks: item.clicks,
      leads: item.leads,
      validLeads: item.validLeads,
    })),
  }));
}

main().catch((error) => {
  process.stderr.write(error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
