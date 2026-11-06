import { PromotionCreativeBatchService } from '../src/modules/operations/promotion-creative-batch.service';

describe('single-account creative verification', () => {
  const task = { id: 'task', accountId: 'account', adgroupId: 'group', templateId: 'template', deliveryMode: 'mode', dynamicCreativeType: 'type', createdByAdminId: 'admin' };
  const item = { id: 'item', platformCreativeId: '123', creativeName: 'creative', creativePayload: { creative_components: {} }, submittedAt: new Date() };

  it('cannot restore a cancelled task or blindly retry an item with a platform ID', async () => {
    const updatedAt = new Date('2026-01-01');
    const itemUpdate = jest.fn().mockResolvedValue({ count: 0 });
    const taskUpdate = jest.fn().mockResolvedValue({ count: 0 });
    const prisma = { promotionCreativeBatchItem: { findMany: jest.fn().mockResolvedValue([{ ...item, status: 'FAILED', updatedAt }]), updateMany: itemUpdate }, promotionCreativeBatchTask: { updateMany: taskUpdate } };
    const service = new PromotionCreativeBatchService(prisma as any, {} as any, {} as any, { create: jest.fn().mockResolvedValue({}) } as any) as any;
    jest.spyOn(service, 'taskOrThrow').mockResolvedValue(task);
    for (const name of ['account', 'assertTencentUserTokenConfigured', 'refreshTaskCounts', 'runWorker', 'task']) jest.spyOn(service, name).mockResolvedValue({});
    await service.retry('task', { adminUserId: 'admin' });
    expect(itemUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ platformCreativeId: null, status: 'FAILED', updatedAt }) }));
    expect(taskUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'task', status: { not: 'CANCELLED' } } }));
  });

  it('marks interrupted submission for review without scheduling another create', async () => {
    const updatedAt = new Date('2026-01-01');
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { promotionCreativeBatchItem: { findMany: jest.fn().mockResolvedValue([{ id: 'i', taskId: 't', status: 'SUBMITTING', updatedAt }]), updateMany } };
    const service = new PromotionCreativeBatchService(prisma as any, {} as any, {} as any, {} as any) as any;
    jest.spyOn(service, 'refreshTaskCounts').mockResolvedValue(undefined);
    await service.recoverInterruptedItems();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'i', status: 'SUBMITTING', updatedAt }, data: expect.objectContaining({ status: 'UNKNOWN' }) }));
  });

  it('does not send a prepared creative when its task was cancelled before submission claim', async () => {
    const updateMany = jest.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    const prisma = { promotionCreativeBatchItem: { updateMany, update: jest.fn().mockResolvedValue({}) }, promotionAccount: { findUnique: jest.fn().mockResolvedValue({ id: 'account', accountNo: '1', status: 'ACTIVE' }) }, promotionCreativeMaterialSnapshot: { findMany: jest.fn().mockResolvedValue([]) } };
    const api = jest.fn();
    const service = new PromotionCreativeBatchService(prisma as any, { tencentApi: api } as any, {} as any, {} as any) as any;
    for (const name of ['currentUser', 'account', 'assertTencentUserTokenConfigured', 'adgroup']) jest.spyOn(service, name).mockResolvedValue({});
    jest.spyOn(service, 'assertPermission').mockImplementation(() => undefined);
    jest.spyOn(service, 'adgroupUsable').mockReturnValue(true);
    jest.spyOn(service, 'upgradeLegacyChannelComponents').mockResolvedValue({ payload: {}, assets: [] });
    await service.processItem(task, { id: 'item', materialSnapshot: [], creativePayload: {} });
    expect(api).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SKIPPED' }) }));
  });

  it('does not let an older task without pending items block the worker queue', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new PromotionCreativeBatchService({ promotionCreativeBatchTask: { findFirst }, promotionCreativeBatchItem: { findMany: jest.fn().mockResolvedValue([]) } } as any, {} as any, {} as any, {} as any) as any;
    await service.runWorker();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ items: { some: { status: 'PENDING' } } }) }));
  });

  function setup(rows: object[]) {
    const update = jest.fn().mockResolvedValue({});
    const api = jest.fn().mockResolvedValue({ data: { list: rows }, requestId: 'request' });
    const prisma = { promotionAccount: { findUnique: jest.fn().mockResolvedValue({ accountNo: 'account-no' }) }, promotionCreativeBatchItem: { update } };
    const service = new PromotionCreativeBatchService(prisma as any, { tencentApi: api } as any, {} as any, {} as any) as any;
    jest.spyOn(service, 'submissionLog').mockResolvedValue(undefined);
    return { service, api, update };
  }

  it('keeps an accepted ID unconfirmed when Tencent does not return it', async () => {
    const { service, api, update } = setup([{ dynamic_creative_id: 'other', dynamic_creative_name: 'creative' }]);
    await service.reconcileItem(task, item);
    expect(api).toHaveBeenCalledWith('GET', '/dynamic_creatives/get', 'account-no', expect.any(Object), true, 'admin');
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'UNKNOWN', errorCode: 'VERIFY_NOT_FOUND' }) }));
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCEEDED' }) }));
  });

  it('marks success only after the returned record and components match', async () => {
    const { service, update } = setup([{ dynamic_creative_id: '123', dynamic_creative_name: 'creative', adgroup_id: 'group', creative_template_id: 'template', delivery_mode: 'mode', dynamic_creative_type: 'type', creative_components: {} }]);
    await service.reconcileItem(task, item);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCEEDED', platformCreativeId: '123' }) }));
  });

  it('does not resubmit an old uncertain request just because a lookup found nothing', async () => {
    const { service, update } = setup([]);
    await service.reconcileItem(task, { ...item, platformCreativeId: null, submittedAt: new Date(Date.now() - 600_000) });
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'UNKNOWN', errorCode: 'VERIFY_NOT_FOUND' }) }));
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }));
  });

  it('does not claim that a same-name platform creative belongs to an uncertain request without an ID', async () => {
    const { service, update } = setup([{ dynamic_creative_id: 'other', dynamic_creative_name: 'creative', adgroup_id: 'group', creative_template_id: 'template', delivery_mode: 'mode', dynamic_creative_type: 'type', creative_components: {}, created_time: Math.floor(Date.now() / 1000) }]);
    await service.reconcileItem(task, { ...item, platformCreativeId: null });
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'UNKNOWN', errorCode: 'VERIFY_AMBIGUOUS' }) }));
  });
});
