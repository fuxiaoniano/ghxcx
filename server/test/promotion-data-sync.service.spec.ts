import { PromotionDataSyncService } from '../src/modules/operations/promotion-data-sync.service';
import axios from 'axios';

describe('PromotionDataSyncService schedule and archived-data handling', () => {
  const createService = (metrics: { spend: number; impressions: number; clicks: number; leads: number; validLeads?: number }) => {
    const prisma = {
      promotionDataSyncConfig: {
        findUnique: jest.fn().mockResolvedValue({ id: 'config_1', provider: 'TENCENT_ADS', enabled: true, reportUrl: 'https://api.e.qq.com/v3.0/daily_reports/get', accessTokenCipher: 'encrypted', extraConfig: {} }),
        update: jest.fn().mockResolvedValue({}),
      },
      promotionAccount: {
        findMany: jest.fn().mockResolvedValue([{ id: 'account_1', name: '腾讯01', accountNo: '10001', status: 'ACTIVE', platform: '腾讯营销' }]),
      },
      promotionAccountCredential: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      promotionDailyMetric: {
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const crypto = { decryptText: jest.fn().mockReturnValue('token') };
    const service = new PromotionDataSyncService(prisma as never, crypto as never) as any;
    service.fetchMetrics = jest.fn().mockResolvedValue(metrics);
    return { service, prisma };
  };

  it('does not create a Tencent daily metric when every synced value is zero', async () => {
    const { service, prisma } = createService({ spend: 0, impressions: 0, clicks: 0, leads: 0, validLeads: 0 });

    const [result] = await service.sync('2026-09-28', 'TENCENT_ADS');

    expect(result).toMatchObject({ synced: 0, noData: 1 });
    expect(prisma.promotionDailyMetric.create).not.toHaveBeenCalled();
    expect(prisma.promotionDailyMetric.updateMany).not.toHaveBeenCalled();
  });

  it('creates a metric when any synced value is non-zero and no existing row is found', async () => {
    const { service, prisma } = createService({ spend: 0, impressions: 1, clicks: 0, leads: 0, validLeads: 0 });

    const [result] = await service.sync('2026-09-28', 'TENCENT_ADS');

    expect(result).toMatchObject({ synced: 1, noData: 0 });
    expect(prisma.promotionDailyMetric.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ isArchived: false }) }));
    expect(prisma.promotionDailyMetric.create).toHaveBeenCalledTimes(1);
  });

  it('uses previous Beijing date at 10:00 and current Beijing date at 14:00 and 22:00', () => {
    const { service } = createService({ spend: 0, impressions: 0, clicks: 0, leads: 0 });
    const at10 = service.getScheduledSync(new Date('2026-09-30T02:00:00.000Z'));
    const at14 = service.getScheduledSync(new Date('2026-09-30T06:00:00.000Z'));
    const at22 = service.getScheduledSync(new Date('2026-09-30T14:00:00.000Z'));

    expect(at10).toMatchObject({ statDate: '2026-09-29' });
    expect(at14).toMatchObject({ statDate: '2026-09-30' });
    expect(at22).toMatchObject({ statDate: '2026-09-30' });
  });

  it('never writes a row archived while the platform request was in flight', async () => {
    const { service, prisma } = createService({ spend: 12, impressions: 10, clicks: 2, leads: 1, validLeads: 1 });
    prisma.promotionDailyMetric.findUnique
      .mockResolvedValueOnce({ isArchived: false, validLeads: 0 })
      .mockResolvedValueOnce({ isArchived: true });
    prisma.promotionDailyMetric.updateMany.mockResolvedValueOnce({ count: 0 });

    const [result] = await service.sync('2026-09-28', 'TENCENT_ADS');

    expect(result).toMatchObject({ synced: 0, skippedArchived: 1 });
    expect(prisma.promotionDailyMetric.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.promotionDailyMetric.create).not.toHaveBeenCalled();
  });

  it('does not overwrite an already archived row', async () => {
    const { service, prisma } = createService({ spend: 12, impressions: 10, clicks: 2, leads: 1, validLeads: 1 });
    prisma.promotionDailyMetric.findUnique.mockResolvedValueOnce({ isArchived: true });

    const [result] = await service.sync('2026-09-28', 'TENCENT_ADS');

    expect(result).toMatchObject({ synced: 0, skippedArchived: 1 });
    expect(service.fetchMetrics).not.toHaveBeenCalled();
    expect(prisma.promotionDailyMetric.updateMany).not.toHaveBeenCalled();
    expect(prisma.promotionDailyMetric.create).not.toHaveBeenCalled();
  });

  it('does not interpret an explicit empty permitted-account list as all accounts', async () => {
    const { service, prisma } = createService({ spend: 1, impressions: 1, clicks: 1, leads: 1 });

    const [result] = await service.sync('2026-09-28', 'TENCENT_ADS', []);

    expect(result).toMatchObject({ synced: 0, errors: ['当前数据范围内没有可同步的推广账户'] });
    expect(prisma.promotionAccount.findMany).not.toHaveBeenCalled();
    expect(prisma.promotionDailyMetric.create).not.toHaveBeenCalled();
    expect(prisma.promotionDailyMetric.updateMany).not.toHaveBeenCalled();
  });

  it('reuses the legacy Tencent business-unit Access Token for accounts without account credentials', async () => {
    const { service, prisma } = createService({ spend: 12, impressions: 10, clicks: 2, leads: 1, validLeads: 1 });

    const [result] = await service.sync('2026-09-28', 'TENCENT_ADS', ['account_1']);

    expect(result).toMatchObject({ synced: 1 });
    expect(prisma.promotionAccountCredential.findUnique).toHaveBeenCalledWith({ where: { accountId: 'account_1' } });
    expect(service.fetchMetrics).toHaveBeenCalledWith('TENCENT_ADS', expect.any(String), 'token', '10001', '2026-09-28');
  });
});

describe('PromotionDataSyncService Tencent real-name token', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reuses the same logged-in user token across authorized Tencent accounts without mixing account access tokens', async () => {
    const prisma = {
      promotionDataSyncConfig: { findUnique: jest.fn().mockResolvedValue({ id: 'config', enabled: true, extraConfig: {} }) },
      promotionAccount: { findMany: jest.fn()
        .mockResolvedValueOnce([{ id: 'a', name: '腾讯01', ownerAdminId: 'owner', status: 'ACTIVE', platform: '腾讯营销' }])
        .mockResolvedValueOnce([{ id: 'b', name: '腾讯02', ownerAdminId: 'owner', status: 'ACTIVE', platform: '腾讯营销' }]) },
      promotionAccountCredential: { findUnique: jest.fn()
        .mockResolvedValueOnce({ id: 'ca', accessTokenCipher: 'access-a' })
        .mockResolvedValueOnce({ id: 'cb', accessTokenCipher: 'access-b' }) },
      tencentUserToken: { findUnique: jest.fn().mockResolvedValue({ tokenCipher: 'user-shared', expiresAt: new Date(Date.now() + 60_000) }) },
    };
    const crypto = { decryptText: jest.fn((value: string) => value) };
    const request = jest.spyOn(axios, 'request').mockResolvedValue({ data: { code: 0, data: { dynamic_creative_id: 123 } }, headers: {} } as any);
    const service = new PromotionDataSyncService(prisma as never, crypto as never);

    await service.tencentApi('POST', '/dynamic_creatives/add', '10001', {}, true, 'operator');
    await service.tencentApi('POST', '/dynamic_creatives/add', '10002', {}, true, 'operator');

    expect(prisma.tencentUserToken.findUnique).toHaveBeenCalledWith({ where: { adminUserId: 'operator' } });
    expect(request.mock.calls.map(([options]) => (options as any).params.access_token)).toEqual(['access-a', 'access-b']);
    expect(request.mock.calls.map(([options]) => (options as any).params.user_token)).toEqual(['user-shared', 'user-shared']);
  });

  it('never takes the account owner shared token when another employee submits a creative', async () => {
    const prisma = {
      promotionDataSyncConfig: { findUnique: jest.fn().mockResolvedValue({ enabled: true, accessTokenCipher: 'access', extraConfig: {} }) },
      promotionAccount: { findMany: jest.fn().mockResolvedValue([{ id: 'a', name: '腾讯01', ownerAdminId: 'employee-a', status: 'ACTIVE', platform: '腾讯营销' }]) },
      promotionAccountCredential: { findUnique: jest.fn().mockResolvedValue(null) },
      tencentUserToken: { findUnique: jest.fn(async ({ where }) => where.adminUserId === 'employee-a' ? { tokenCipher: 'a-secret', expiresAt: null } : null) },
    };
    const request = jest.spyOn(axios, 'request');
    const service = new PromotionDataSyncService(prisma as never, { decryptText: jest.fn() } as never);
    await expect(service.tencentApi('POST', '/dynamic_creatives/add', '10001', {}, true, 'employee-b')).rejects.toMatchObject({ code: '11101' });
    expect(prisma.tencentUserToken.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.tencentUserToken.findUnique).toHaveBeenCalledWith({ where: { adminUserId: 'employee-b' } });
    expect(request).not.toHaveBeenCalled();
  });

  it('blocks expired login-level tokens instead of silently falling back to another legacy token', async () => {
    const prisma = {
      promotionDataSyncConfig: { findUnique: jest.fn().mockResolvedValue({ enabled: true, accessTokenCipher: 'access', extraConfig: { userTokenCipher: 'legacy' } }) },
      promotionAccount: { findMany: jest.fn().mockResolvedValue([{ id: 'a', name: '腾讯01', status: 'ACTIVE', platform: '腾讯营销' }]) },
      promotionAccountCredential: { findUnique: jest.fn().mockResolvedValue(null) },
      tencentUserToken: { findUnique: jest.fn().mockResolvedValue({ tokenCipher: 'expired', expiresAt: new Date(Date.now() - 1_000) }) },
    };
    const request = jest.spyOn(axios, 'request');
    const service = new PromotionDataSyncService(prisma as never, { decryptText: jest.fn() } as never);
    await expect(service.tencentApi('POST', '/dynamic_creatives/add', '10001', {}, true, 'employee-a')).rejects.toMatchObject({ code: '11102' });
    expect(request).not.toHaveBeenCalled();
  });

  it('sends the encrypted User Token as a query parameter and never in the creative request body', async () => {
    const prisma = {
      promotionDataSyncConfig: { findUnique: jest.fn().mockResolvedValue({
      id: 'config_1', provider: 'TENCENT_ADS', enabled: true, accessTokenCipher: 'access-cipher',
      extraConfig: { userTokenCipher: 'user-cipher' },
      }) },
      promotionAccount: { findMany: jest.fn().mockResolvedValue([{ id: 'account_1', name: '腾讯01', status: 'ACTIVE', platform: '腾讯营销' }]) },
      promotionAccountCredential: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
      tencentUserToken: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const crypto = { decryptText: jest.fn((value: string) => value === 'user-cipher' ? 'real-name-user-token' : 'access-token') };
    const request = jest.spyOn(axios, 'request').mockResolvedValue({ data: { code: 0, data: { dynamic_creative_id: 123 } }, headers: {} } as any);
    const service = new PromotionDataSyncService(prisma as never, crypto as never);

    await service.tencentApi('POST', '/dynamic_creatives/add', '123456', { dynamic_creative_name: '测试创意' });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.objectContaining({ access_token: 'access-token', user_token: 'real-name-user-token' }),
      data: expect.not.objectContaining({ user_token: expect.anything() }),
    }));
  });

  it('blocks creative creation before calling Tencent when User Token is missing', async () => {
    const prisma = {
      promotionDataSyncConfig: { findUnique: jest.fn().mockResolvedValue({
      id: 'config_1', provider: 'TENCENT_ADS', enabled: true, accessTokenCipher: 'access-cipher', extraConfig: {},
      }) },
      promotionAccount: { findMany: jest.fn().mockResolvedValue([{ id: 'account_1', name: '腾讯01', status: 'ACTIVE', platform: '腾讯营销' }]) },
      promotionAccountCredential: { findUnique: jest.fn().mockResolvedValue(null) },
      tencentUserToken: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const crypto = { decryptText: jest.fn().mockReturnValue('access-token') };
    const request = jest.spyOn(axios, 'request');
    const service = new PromotionDataSyncService(prisma as never, crypto as never);

    await expect(service.tencentApi('POST', '/dynamic_creatives/add', '123456', {})).rejects.toMatchObject({ code: '11101' });
    expect(request).not.toHaveBeenCalled();
  });

  it('blocks creative creation before calling Tencent when User Token is expired', async () => {
    const prisma = {
      promotionDataSyncConfig: { findUnique: jest.fn().mockResolvedValue({
      id: 'config_1', provider: 'TENCENT_ADS', enabled: true, accessTokenCipher: 'access-cipher',
      extraConfig: { userTokenCipher: 'user-cipher', userTokenExpiresAt: '2026-01-01T00:00:00.000Z' },
      }) },
      promotionAccount: { findMany: jest.fn().mockResolvedValue([{ id: 'account_1', name: '腾讯01', status: 'ACTIVE', platform: '腾讯营销' }]) },
      promotionAccountCredential: { findUnique: jest.fn().mockResolvedValue(null) },
      tencentUserToken: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const crypto = { decryptText: jest.fn().mockReturnValue('access-token') };
    const request = jest.spyOn(axios, 'request');
    const service = new PromotionDataSyncService(prisma as never, crypto as never);

    await expect(service.tencentApi('POST', '/dynamic_creatives/add', '123456', {})).rejects.toMatchObject({ code: '11102' });
    expect(request).not.toHaveBeenCalled();
  });

  it('refreshes the shared business-unit Access Token in the global config after Tencent returns 11002', async () => {
    const config = {
      id: 'config_1', provider: 'TENCENT_ADS', enabled: true, accessTokenCipher: 'expired-access-cipher',
      extraConfig: { clientId: 'client-id', clientSecretCipher: 'secret-cipher', refreshTokenCipher: 'refresh-cipher' },
    };
    const prisma = {
      promotionDataSyncConfig: {
        findUnique: jest.fn().mockResolvedValue(config),
        update: jest.fn().mockResolvedValue({}),
      },
      promotionAccount: { findMany: jest.fn().mockResolvedValue([{ id: 'account_1', name: '腾讯01', status: 'ACTIVE', platform: '腾讯营销' }]) },
      promotionAccountCredential: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
      tencentUserToken: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const crypto = { decryptText: jest.fn((value: string) => ({ 'expired-access-cipher': 'expired-access', 'secret-cipher': 'client-secret', 'refresh-cipher': 'refresh-token' } as Record<string, string>)[value] || value), encryptText: jest.fn((value: string) => `encrypted:${value}`) };
    jest.spyOn(axios, 'get').mockResolvedValue({ data: { code: 0, data: { access_token: 'new-access', access_token_expires_in: 3600 } } } as any);
    const request = jest.spyOn(axios, 'request')
      .mockResolvedValueOnce({ data: { code: 11002, message: 'expired' }, headers: {} } as any)
      .mockResolvedValueOnce({ data: { code: 0, data: { list: [] } }, headers: {} } as any);
    const service = new PromotionDataSyncService(prisma as never, crypto as never);

    await expect(service.tencentApi('GET', '/adgroups/get', '123456')).resolves.toMatchObject({ data: { list: [] } });

    expect(request).toHaveBeenCalledTimes(2);
    expect(prisma.promotionDataSyncConfig.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'config_1' },
      data: expect.objectContaining({ accessTokenCipher: 'encrypted:new-access' }),
    }));
    expect(prisma.promotionAccountCredential.update).not.toHaveBeenCalled();
  });

  it('reports an expired Tencent refresh credential as an actionable client error without exposing the platform response', async () => {
    const prisma = {
      promotionDataSyncConfig: { findUnique: jest.fn().mockResolvedValue({
        id: 'config_1', enabled: true, accessTokenCipher: 'expired-access',
        extraConfig: { clientId: 'app-id', clientSecretCipher: 'client-secret', refreshTokenCipher: 'refresh-cipher' },
      }) },
      promotionAccount: { findMany: jest.fn().mockResolvedValue([{ id: 'account_1', name: '腾讯01', status: 'ACTIVE', platform: '腾讯营销' }]) },
      promotionAccountCredential: { findUnique: jest.fn().mockResolvedValue(null) },
      tencentUserToken: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    jest.spyOn(axios, 'request').mockResolvedValueOnce({ data: { code: 11002, message: 'expired' }, headers: {} } as any);
    jest.spyOn(axios, 'get').mockResolvedValueOnce({ data: { code: 40001, message: 'RefreshToken不存在，请重新认证' } } as any);
    const service = new PromotionDataSyncService(prisma as never, { decryptText: jest.fn((value: string) => value) } as never);

    await expect(service.tencentApi('GET', '/images/get', '123456')).rejects.toMatchObject({
      status: 400,
      response: { code: 400925, message: expect.stringContaining('重新完成授权') },
    });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});
