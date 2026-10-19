import { MultiAccountCreativeBatchService } from '../src/modules/operations/multi-account-creative-batch.service';

describe('multi-account creative response security', () => {
  const service = new MultiAccountCreativeBatchService({} as any, {} as any, {} as any, {} as any, {} as any);

  it('does not expose task dedupe data, submitter network data, tokens, or raw asset snapshots', () => {
    const result = (service as any).safeBatch({
      id: 'batch-1',
      dedupeKey: 'dedupe-secret',
      requestFingerprint: 'fingerprint-secret',
      requestSnapshot: { access_token: 'token-secret' },
      submittedIp: '10.0.0.1',
      submittedUserAgent: 'private-agent',
      logicalAssets: [{ id: 'asset-1', snapshot: { refresh_token: 'refresh-secret' }, mappings: [] }],
      targets: [{ items: [{ requestPayload: { account_id: '12345678', access_token: 'token-secret' }, platformResponse: { component_id: '87654321' }, verificationResult: null }] }],
    });

    expect(result).not.toHaveProperty('dedupeKey');
    expect(result).not.toHaveProperty('requestSnapshot');
    expect(result).not.toHaveProperty('submittedIp');
    expect(result.logicalAssets[0]).not.toHaveProperty('snapshot');
    expect(result.targets[0].items[0].requestPayload).toEqual({ account_id: '****5678', access_token: '[REDACTED]' });
  });

  it.each(['retry', 'cancel'])('rejects %s when a task contains accounts outside the member scope', async (action) => {
    const prisma = {
      multiAccountCreativeBatchTarget: { count: jest.fn().mockResolvedValue(2) },
      multiAccountCreativeBatchItem: { update: jest.fn(), updateMany: jest.fn() },
      $transaction: jest.fn(),
    };
    const scopedService = new MultiAccountCreativeBatchService(prisma as any, {} as any, {} as any, {} as any, {} as any);
    jest.spyOn(scopedService, 'task').mockResolvedValue({ id: 'batch-1', status: 'RUNNING', targets: [{ id: 'visible-target', items: [] }] } as any);
    const user = { adminUserId: 'member-1', role: 'EMPLOYEE', permissions: ['PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_RETRY', 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CANCEL'] } as any;

    await expect((scopedService as any)[action]('batch-1', user)).rejects.toThrow('当前账号无权操作此任务中的全部推广账户');
    expect(prisma.multiAccountCreativeBatchItem.update).not.toHaveBeenCalled();
    expect(prisma.multiAccountCreativeBatchItem.updateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('cannot relabel an already successful task as cancelled', async () => {
    const prisma = {
      multiAccountCreativeBatchTarget: { count: jest.fn().mockResolvedValue(1) },
      multiAccountCreativeBatchItem: { count: jest.fn(), updateMany: jest.fn() },
      $transaction: jest.fn(),
    };
    const scopedService = new MultiAccountCreativeBatchService(prisma as any, {} as any, {} as any, {} as any, {} as any);
    jest.spyOn(scopedService, 'task').mockResolvedValue({ id: 'batch-1', status: 'SUCCEEDED', targets: [{ id: 'target-1' }] } as any);

    await expect(scopedService.cancel('batch-1', { role: 'EMPLOYEE', permissions: ['PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CANCEL'] } as any)).rejects.toThrow('已结束的任务不能取消');
    expect(prisma.multiAccountCreativeBatchItem.count).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
