import { OperationsService } from '../src/modules/operations/operations.service';

describe('OperationsService archived daily permissions', () => {
  const member = { adminUserId: 'member-1', username: 'member', role: 'ADMIN', permissions: ['PROMOTION_DAILY'] };
  const superAdmin = { adminUserId: 'admin-1', username: 'admin', role: 'SUPER_ADMIN', permissions: [] };
  const archived = {
    id: 'metric-1', accountId: 'account-1', statDate: new Date('2026-09-29T00:00:00.000Z'),
    spend: 100, impressions: 1000, clicks: 10, leads: 2, validLeads: 1,
    appointments: 0, transactions: 0, revenue: 0, customMetrics: {}, isArchived: true,
    account: { id: 'account-1', name: '测试账户', project: '重庆', platform: '腾讯营销' },
  };

  function createService(metric = archived) {
    const prisma = {
      promotionDailyMetric: {
        findUnique: jest.fn().mockResolvedValue(metric),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      promotionAccount: { findUnique: jest.fn().mockResolvedValue(archived.account), delete: jest.fn() },
    };
    const audit = { create: jest.fn().mockResolvedValue(undefined) };
    return { service: new OperationsService(prisma as never, audit as never, {} as never, {} as never), prisma, audit };
  }

  it('blocks ordinary members from editing archived daily data', async () => {
    const { service, prisma } = createService();
    const dto = { accountId: 'account-1', statDate: '2026-09-29', spend: 100, impressions: 1000, clicks: 10, leads: 2, validLeads: 1, appointments: 0, transactions: 0, revenue: 0 };

    await expect(service.updateDaily('metric-1', dto, member)).rejects.toMatchObject({
      status: 403,
      response: { code: 403704, message: '已归档日统计仅超级管理员可修改，当前账号仅可查看' },
    });
    expect(prisma.promotionDailyMetric.update).not.toHaveBeenCalled();
  });

  it('blocks ordinary members from unarchiving archived daily data', async () => {
    const { service, prisma } = createService();

    await expect(service.archiveDaily('metric-1', { isArchived: false }, member)).rejects.toMatchObject({ status: 403 });
    expect(prisma.promotionDailyMetric.update).not.toHaveBeenCalled();
  });

  it('blocks ordinary members from deleting even unarchived daily data', async () => {
    const { service, prisma } = createService({ ...archived, isArchived: false });

    await expect(service.deleteDaily('metric-1', member)).rejects.toMatchObject({
      status: 403,
      response: { code: 403705, message: '仅超级管理员可删除日统计，普通成员仅可查看或编辑' },
    });
    expect(prisma.promotionDailyMetric.delete).not.toHaveBeenCalled();
  });

  it('allows a super administrator to unarchive data', async () => {
    const { service, prisma } = createService();
    prisma.promotionDailyMetric.update.mockResolvedValue({ ...archived, isArchived: false });

    const result = await service.archiveDaily('metric-1', { isArchived: false }, superAdmin);

    expect(result.isArchived).toBe(false);
    expect(prisma.promotionDailyMetric.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isArchived: false } }));
  });

  it('prevents an ordinary member from deleting a promotion account', async () => {
    const { service, prisma } = createService();

    await expect(service.deleteAccount('account-1', member)).rejects.toMatchObject({
      status: 403,
      response: { code: 403705, message: '仅超级管理员可删除推广账户，普通成员仅可查看或编辑' },
    });
    expect(prisma.promotionAccount.delete).not.toHaveBeenCalled();
  });

  it('allows a super administrator to delete daily data', async () => {
    const { service, prisma } = createService();
    prisma.promotionDailyMetric.delete.mockResolvedValue(archived);

    const result = await service.deleteDaily('metric-1', superAdmin);

    expect(result).toEqual({ id: 'metric-1', deleted: true });
    expect(prisma.promotionDailyMetric.delete).toHaveBeenCalledWith({ where: { id: 'metric-1' } });
  });
});
