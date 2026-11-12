import { SmartMonitorService } from '../src/modules/operations/smart-monitor.service';

const adgroup = { adgroup_id: 123, adgroup_name: '测试单元', bid_mode: 'BID_MODE_OCPA', bid_amount: 5000 };

describe('SmartMonitorService safety', () => {
  it('contains scheduler database failures and releases the polling lock', async () => {
    const findMany = jest.fn().mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValueOnce([]);
    const service = new SmartMonitorService({ smartMonitorPolicy: { findMany }, smartMonitorChannelPolicy: { findMany: jest.fn().mockResolvedValue([]) } } as any, {} as any, {} as any, {} as any) as any;
    service.logger = { warn: jest.fn() };
    await expect(service.pollEnabledAccounts()).resolves.toBeUndefined();
    expect(service.polling).toBe(false);
    await service.pollEnabledAccounts();
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('continues the next account after a capability persistence failure', async () => {
    const policies = ['a', 'b'].map(id => ({ accountId: id, account: { accountNo: id, status: 'ACTIVE' } }));
    const api = jest.fn().mockResolvedValue({ data: { list: [] } });
    const upsert = jest.fn().mockRejectedValueOnce(new Error('db')).mockRejectedValueOnce(new Error('db')).mockResolvedValue({});
    const service = new SmartMonitorService({ smartMonitorPolicy: { findMany: jest.fn().mockResolvedValue(policies) }, smartMonitorChannelPolicy: { findMany: jest.fn().mockResolvedValue([]) }, smartMonitorCapability: { upsert } } as any, {} as any, { tencentApi: api } as any, {} as any) as any;
    service.logger = { warn: jest.fn() };
    await service.pollEnabledAccounts();
    expect(api.mock.calls.map(call => call[2])).toEqual(['a', 'b']);
    expect(service.polling).toBe(false);
  });

  it('rejects an out-of-scope account before querying Tencent', async () => {
    const prisma = { promotionAccount: { findFirst: jest.fn().mockResolvedValue(null) } } as any;
    const access = { where: jest.fn().mockResolvedValue({ id: { in: [] } }) } as any;
    const sync = { tencentApi: jest.fn() } as any;
    const service = new SmartMonitorService(prisma, access, sync, {} as any);
    await expect(service.dashboard('other-account', { adminUserId: 'member', role: 'MEMBER' } as any, true)).rejects.toMatchObject({ status: 403 });
    expect(sync.tencentApi).not.toHaveBeenCalled();
  });

  it('does not save a policy when the operator lacks account-level creative authority', async () => {
    const prisma = { promotionAccount: { findFirst: jest.fn().mockResolvedValue({ id: 'visible', accountNo: '123456' }) }, smartMonitorPolicy: { upsert: jest.fn() } } as any;
    const access = { where: jest.fn().mockResolvedValue({ id: 'visible' }), assertCanCreateCreatives: jest.fn().mockRejectedValue(new Error('forbidden')) } as any;
    const service = new SmartMonitorService(prisma, access, {} as any, {} as any);
    await expect(service.savePolicy('visible', { enabled: true, ratioThreshold: 1.3, minSpend: 200, minConversions: 3, maxReportAgeMinutes: 360 }, { adminUserId: 'member' } as any)).rejects.toThrow('forbidden');
    expect(prisma.smartMonitorPolicy.upsert).not.toHaveBeenCalled();
  });

  it('requires access to every channel account before changing a shared policy', async () => {
    const upsert = jest.fn();
    const prisma = { promotionAccount: { findMany: jest.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]) },
      smartMonitorChannelPolicy: { upsert } } as any;
    const access = { assertVisible: jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('hidden account')),
      assertCanCreateCreatives: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new SmartMonitorService(prisma, access, {} as any, {} as any);
    await expect(service.saveChannelPolicy('腾讯营销', { enabled: true, spendThreshold: 1000, emptySpendThreshold: 200,
      cpaThreshold: 300, maxReportAgeMinutes: 360 }, { adminUserId: 'member' } as any)).rejects.toThrow('hidden account');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('polls every account in an enabled channel once, without using legacy account flags', async () => {
    const api = jest.fn().mockResolvedValue({ data: { list: [] } });
    const prisma = {
      smartMonitorPolicy: { findMany: jest.fn().mockResolvedValue([{ accountId: 'a', account: { platform: '腾讯营销', accountNo: 'a', status: 'ACTIVE' } }]) },
      smartMonitorChannelPolicy: { findMany: jest.fn().mockResolvedValue([{ channelKey: '腾讯营销', enabled: true }]) },
      promotionAccount: { findMany: jest.fn().mockResolvedValue([
        { id: 'a', platform: '腾讯营销', accountNo: 'a', status: 'ACTIVE' },
        { id: 'b', platform: '腾讯营销', accountNo: 'b', status: 'ACTIVE' },
      ]) },
      smartMonitorCapability: { upsert: jest.fn().mockResolvedValue({}) },
    } as any;
    await (new SmartMonitorService(prisma, {} as any, { tencentApi: api } as any, {} as any) as any).pollEnabledAccounts();
    expect(api.mock.calls.map((call) => call[2])).toEqual(['a', 'b']);
  });

  it('overwrites the same hour instead of adding a cumulative report twice', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = { smartMonitorSnapshot: { upsert }, smartMonitorCapability: { upsert: jest.fn().mockResolvedValue({}) } } as any;
    const sync = { tencentApi: jest.fn().mockResolvedValue({ data: { list: [{ dimensions: { adgroup_id: 123, hour: 10 }, metrics: { cost: 12000, view_count: 1000, valid_click_count: 20, conversions_count: 2 } }] }, requestId: 'safe-request-id' }) } as any;
    const service = new SmartMonitorService(prisma, {} as any, sync, {} as any) as any;
    await service.collectHourly('account-id', '123456', [adgroup]);
    await service.collectHourly('account-id', '123456', [adgroup]);
    expect(sync.tencentApi.mock.calls[0][3].group_by).toBe(JSON.stringify(['hour', 'adgroup_id']));
    expect(upsert).toHaveBeenCalledTimes(4); // Yesterday and today, each overwritten on the second poll.
    expect(upsert.mock.calls[0][0].where).toEqual(upsert.mock.calls[2][0].where);
    expect(upsert.mock.calls[1][0].where).toEqual(upsert.mock.calls[3][0].where);
    expect(upsert.mock.calls[3][0].update.spend).toBe(120);
    expect(upsert.mock.calls[3][0].update.actualCpa).toBe(60);
    expect(upsert.mock.calls[3][0].update.targetCpa).toBe(50);
  });

  it('persists creative-level hours against the creative’s real parent adgroup', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = { smartMonitorSnapshot: { upsert }, smartMonitorCapability: { upsert: jest.fn().mockResolvedValue({}) } } as any;
    const sync = { tencentApi: jest.fn().mockImplementation(async (_method, _path, _account, input) => ({
      data: { list: input.level === 'REPORT_LEVEL_DYNAMIC_CREATIVE'
        ? [{ dynamic_creative_id: 456, hour: 10, cost: 9000, view_count: 100, valid_click_count: 10, conversions_count: 3 }]
        : [] }, requestId: 'safe-request-id',
    })) } as any;
    const service = new SmartMonitorService(prisma, {} as any, sync, {} as any) as any;
    await service.collectHourly('account-id', '123456', [adgroup], [{ dynamic_creative_id: 456, adgroup_id: 123, configured_status: 'AD_STATUS_NORMAL' }]);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[0][0].create).toMatchObject({ level: 'CREATIVE', platformObjectId: '456', adgroupId: '123', spend: 90, actualCpa: 30, targetCpa: 50 });
  });

  it('uses stable rolling hours even when newer provisional rows fill the old 200-row limit', async () => {
    const now = Date.now();
    const snapshots = [
      ...Array.from({ length: 220 }, (_, index) => ({ level: 'ADGROUP', platformObjectId: String(1000 + index),
        periodStart: new Date(now - 3_600_000), periodEnd: new Date(now), spend: 0, conversions: 0, impressions: 0, clicks: 0,
        backfillStatus: 'PROVISIONAL', fetchedAt: new Date(), reportSource: 'TENCENT_HOURLY_REPORT' })),
      { level: 'ADGROUP', platformObjectId: '123', periodStart: new Date(now - 6 * 3_600_000), periodEnd: new Date(now - 5 * 3_600_000),
        spend: 300, conversions: 3, impressions: 100, clicks: 10, backfillStatus: 'BACKFILLED', fetchedAt: new Date(), reportSource: 'TENCENT_HOURLY_REPORT' },
      { level: 'CREATIVE', platformObjectId: '456', periodStart: new Date(now - 6 * 3_600_000), periodEnd: new Date(now - 5 * 3_600_000),
        spend: 300, conversions: 3, impressions: 100, clicks: 10, backfillStatus: 'BACKFILLED', fetchedAt: new Date(), reportSource: 'TENCENT_HOURLY_REPORT' },
    ];
    const prisma = {
      promotionAccount: { findFirst: jest.fn().mockResolvedValue({ id: 'account-id', accountNo: '123456', name: '测试', platform: '腾讯营销', status: 'ACTIVE' }) },
      smartMonitorPolicy: { findUnique: jest.fn().mockResolvedValue({ minSpend: 200, minConversions: 3, maxReportAgeMinutes: 360, ratioThreshold: 1.3 }) },
      smartMonitorChannelPolicy: { findUnique: jest.fn().mockResolvedValue({ enabled: true, spendThreshold: 1000, emptySpendThreshold: 200, cpaThreshold: 80, maxReportAgeMinutes: 360 }) },
      smartMonitorSnapshot: { findMany: jest.fn().mockResolvedValue(snapshots) },
      smartMonitorCapability: { upsert: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const access = { where: jest.fn().mockResolvedValue({}), assertVisible: jest.fn().mockResolvedValue(undefined) } as any;
    const sync = { tencentAccountCredentialStatus: jest.fn().mockResolvedValue({ authorized: true }),
      tencentApi: jest.fn().mockImplementation(async (_method, path) => ({ data: { list: path === '/adgroups/get' ? [adgroup]
        : path === '/dynamic_creatives/get' ? [{ dynamic_creative_id: 456, adgroup_id: 123, dynamic_creative_name: '测试创意' }] : [] }, requestId: 'read-id' })) } as any;
    const result = await new SmartMonitorService(prisma, access, sync, {} as any).dashboard('account-id', { adminUserId: 'owner' } as any, true);
    expect(result.adgroups[0].spend).toBe(300);
    expect(result.adgroups[0].assessment.state).toBe('WARNING');
    expect(result.adgroups[0].recommendation).toContain('人工核查');
    expect(result.creatives[0].actualCpa).toBe(100);
    expect(result.creatives[0].targetCpa).toBe(50);
    expect(result.creatives[0].assessment.state).toBe('WARNING');
    expect(result.creatives[0].recommendation).toContain('人工核查');
    expect(result).not.toHaveProperty('materials');
    expect(prisma.smartMonitorSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5001 }));
    // A recent report period must not hide an old fetch after failed refreshes.
    for (const snapshot of snapshots) snapshot.fetchedAt = new Date(now - 24 * 3_600_000);
    const stale = await new SmartMonitorService(prisma, access, sync, {} as any).dashboard('account-id', { adminUserId: 'owner' } as any, true);
    expect(stale.adgroups[0].assessment.state).toBe('INSUFFICIENT');
    expect(stale.creatives[0].assessment.evidence).toContain('抓取过期');
  });

  it('does not invent an hour when the platform omits the hour dimension', async () => {
    const upsert = jest.fn();
    const prisma = { smartMonitorSnapshot: { upsert }, smartMonitorCapability: { upsert: jest.fn().mockResolvedValue({}) } } as any;
    const sync = { tencentApi: jest.fn().mockResolvedValue({ data: { list: [{ dimensions: { adgroup_id: 123 }, metrics: { cost: 12000 } }] } }) } as any;
    await (new SmartMonitorService(prisma, {} as any, sync, {} as any) as any).collectHourly('account-id', '123456', [adgroup]);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('reads subsequent platform pages before treating the result as complete', async () => {
    const tencentApi = jest.fn()
      .mockResolvedValueOnce({ data: { list: Array.from({ length: 100 }, (_, index) => ({ adgroup_id: index + 1 })) }, requestId: 'page-one' })
      .mockResolvedValueOnce({ data: { list: [{ adgroup_id: 101 }] }, requestId: 'page-two' });
    const service = new SmartMonitorService({} as any, {} as any, { tencentApi } as any, {} as any) as any;
    const result = await service.pagedRead('/adgroups/get', '123456', { fields: '[]' });
    expect(result.complete).toBe(true);
    expect(result.rows).toHaveLength(101);
    expect(tencentApi.mock.calls.map((call) => call[3].page)).toEqual([1, 2]);
  });
});
