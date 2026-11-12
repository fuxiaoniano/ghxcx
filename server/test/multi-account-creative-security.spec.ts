import { MultiAccountCreativeBatchService } from '../src/modules/operations/multi-account-creative-batch.service';
import { PromotionCreativeBatchService } from '../src/modules/operations/promotion-creative-batch.service';

describe('multi-account creative response security', () => {
  const service = new MultiAccountCreativeBatchService({} as any, {} as any, {} as any, {} as any, {} as any);

  it('marks an interrupted submission for manual review instead of creating again', async () => {
    const updatedAt = new Date('2026-01-01');
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { multiAccountCreativeBatchItem: { findMany: jest.fn().mockResolvedValue([{ id: 'i', status: 'SUBMITTING', updatedAt, target: { batchId: 'b' } }]), updateMany } };
    const scoped = new MultiAccountCreativeBatchService(prisma as any, {} as any, {} as any, {} as any, {} as any) as any;
    jest.spyOn(scoped, 'refreshCounts').mockResolvedValue(undefined);
    await scoped.recoverInterruptedItems();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'i', status: 'SUBMITTING', updatedAt }, data: expect.objectContaining({ status: 'UNKNOWN_NEEDS_REVIEW' }) }));
  });

  it('does not send a creative when the batch was cancelled during validation', async () => {
    const updateMany = jest.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    const prisma = { multiAccountCreativeBatchItem: { updateMany, findFirst: jest.fn().mockResolvedValue(null) } };
    const api = jest.fn();
    const scoped = new MultiAccountCreativeBatchService(prisma as any, { tencentApi: api } as any, {} as any, {} as any, {} as any) as any;
    for (const name of ['currentUser', 'account', 'adgroup', 'revalidateItemAssets', 'log']) jest.spyOn(scoped, name).mockResolvedValue({});
    jest.spyOn(scoped, 'assertPermission').mockImplementation(() => undefined);
    await scoped.submitItem({ id: 'item', requestPayload: {}, target: { adgroupId: 'group', account: { id: 'a', accountNo: '1' }, batch: { id: 'b', createdByAdminId: 'u' } } });
    expect(api).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }));
  });

  it('excludes cancelled pending tasks while retaining post-submission verification', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const scoped = new MultiAccountCreativeBatchService({ multiAccountCreativeBatchItem: { findFirst, findMany: jest.fn().mockResolvedValue([]) } } as any, {} as any, {} as any, {} as any, {} as any) as any;
    await scoped.runWorker();
    expect(findFirst.mock.calls[0][0].where.OR).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'PENDING', target: { batch: { status: { not: 'CANCELLED' } } } }),
      expect.objectContaining({ status: { in: ['PLATFORM_ACCEPTED', 'VERIFYING'] } }),
    ]));
  });

  it('keeps the result unknown when saving the accepted Tencent response fails', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { multiAccountCreativeBatchItem: { updateMany, findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockRejectedValue(new Error('database unavailable')) } };
    const api = jest.fn().mockResolvedValue({ data: { dynamic_creative_id: '123' } });
    const scoped = new MultiAccountCreativeBatchService(prisma as any, { tencentApi: api } as any, {} as any, {} as any, {} as any) as any;
    for (const name of ['currentUser', 'account', 'adgroup', 'revalidateItemAssets', 'log']) jest.spyOn(scoped, name).mockResolvedValue({});
    jest.spyOn(scoped, 'assertPermission').mockImplementation(() => undefined);
    await scoped.submitItem({ id: 'item', requestPayload: {}, target: { adgroupId: 'group', account: { id: 'a', accountNo: '1' }, batch: { id: 'b', createdByAdminId: 'u' } } });
    expect(api).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'UNKNOWN_NEEDS_REVIEW' }) }));
  });

  it('allows an exhausted verification to be scheduled again without resubmitting creation', async () => {
    const itemUpdate = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { multiAccountCreativeBatchItem: { updateMany: itemUpdate }, multiAccountCreativeBatch: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const scoped = new MultiAccountCreativeBatchService(prisma as any, {} as any, {} as any, {} as any, { create: jest.fn().mockResolvedValue({}) } as any) as any;
    const batch = { status: 'COMPLETED_WITH_EXCEPTIONS', targets: [{ items: [{ id: 'item', platformCreativeId: '123', status: 'UNKNOWN_NEEDS_REVIEW', verificationAttempts: 5 }] }] };
    jest.spyOn(scoped, 'assertPermission').mockImplementation(() => undefined);
    jest.spyOn(scoped, 'assertFullTaskScope').mockResolvedValue(undefined);
    jest.spyOn(scoped, 'task').mockResolvedValue(batch);
    jest.spyOn(scoped, 'runWorker').mockResolvedValue(undefined);
    await scoped.retry('batch', { adminUserId: 'admin' });
    expect(itemUpdate).toHaveBeenCalledWith({ where: expect.objectContaining({ id: 'item', status: 'UNKNOWN_NEEDS_REVIEW' }), data: expect.objectContaining({ status: 'VERIFYING', verificationAttempts: 0 }) });
  });

  it('does not resurrect an item changed by another worker during retry', async () => {
    const itemUpdate = jest.fn().mockResolvedValue({ count: 0 });
    const batchUpdate = jest.fn();
    const prisma = { multiAccountCreativeBatchItem: { updateMany: itemUpdate }, multiAccountCreativeBatch: { updateMany: batchUpdate } };
    const scoped = new MultiAccountCreativeBatchService(prisma as any, {} as any, {} as any, {} as any, {} as any) as any;
    jest.spyOn(scoped, 'assertPermission').mockImplementation(() => undefined);
    jest.spyOn(scoped, 'assertFullTaskScope').mockResolvedValue(undefined);
    jest.spyOn(scoped, 'task').mockResolvedValue({ status: 'RUNNING', targets: [{ items: [{ id: 'item', platformCreativeId: '123', status: 'VERIFYING', updatedAt: new Date('2026-01-01') }] }] });
    await expect(scoped.retry('batch', { adminUserId: 'admin' })).rejects.toThrow('没有可安全重试');
    expect(batchUpdate).not.toHaveBeenCalled();
    expect(itemUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'VERIFYING', updatedAt: new Date('2026-01-01') }) }));
  });

  it('recognizes a Tencent nine-image component as satisfying the image-list requirement', () => {
    expect((service as any).requirementSatisfiedBySelection('image_list', new Set(['image_list']))).toBe(true);
    expect((service as any).requirementSatisfiedBySelection('image_list', new Set(['image']))).toBe(true);
    expect((service as any).requirementSatisfiedBySelection('image_list', new Set(['video']))).toBe(false);
  });

  it('uses the Tencent-supported media_id filter for videos and checks the returned video_id', async () => {
    const tencentApi = jest.fn().mockResolvedValue({ data: { list: [{ video_id: 721001, status: 'MEDIA_STATUS_NORMAL' }] }, requestId: 'req-1' });
    const scopedService = new MultiAccountCreativeBatchService({} as any, { tencentApi } as any, {} as any, {} as any, {} as any);
    const result = await (scopedService as any).lookupAsset('123456', { platformAssetKind: 'VIDEO', platformAssetId: '721001' });
    expect(result.row.video_id).toBe(721001);
    expect(JSON.parse(tencentApi.mock.calls[0][3].filtering)).toEqual([{ field: 'media_id', operator: 'EQUALS', values: ['721001'] }]);
  });

  it('retains image_id filtering for image materials', async () => {
    const tencentApi = jest.fn().mockResolvedValue({ data: { list: [{ image_id: '501001' }] } });
    const scopedService = new MultiAccountCreativeBatchService({} as any, { tencentApi } as any, {} as any, {} as any, {} as any);
    const result = await (scopedService as any).lookupAsset('123456', { platformAssetKind: 'IMAGE', platformAssetId: '501001' });
    expect(result.row.image_id).toBe('501001');
    expect(JSON.parse(tencentApi.mock.calls[0][3].filtering)[0].field).toBe('image_id');
  });

  it('submits Tencent component_id as an integer while keeping media IDs as strings', () => {
    const single = { canonicalCreativeComponentField: (field: string) => field };
    const scopedService = new MultiAccountCreativeBatchService({} as any, {} as any, single as any, {} as any, {} as any);
    const component = (scopedService as any).componentFromRow({ component_id: '1234567890', component_value: { text_link: { value: { text: '查看详情', video_id: '721001' } } } }, 'text_link', {});
    expect(component.component_id).toBe(1234567890);
    expect(component.value.video_id).toBe('721001');
  });

  it('expands the creative name from each target adgroup before applying material wildcards', () => {
    const creativeName = jest.fn((pattern: string) => pattern);
    const scopedService = new MultiAccountCreativeBatchService({} as any, {} as any, { creativeName } as any, {} as any, {} as any);
    expect((scopedService as any).creativeNameForTarget('{营销单元}+{标题}+{序号}', '腾讯03-视频组', 2, [], '腾讯03')).toBe('腾讯03-视频组+{标题}+{序号}');
    expect(creativeName).toHaveBeenCalledWith('腾讯03-视频组+{标题}+{序号}', 2, [], '腾讯03', '');
  });

  it('expands the date wildcard in a multi-account creative name using the existing naming service', () => {
    const single = new PromotionCreativeBatchService({} as any, {} as any, {} as any, {} as any);
    const scopedService = new MultiAccountCreativeBatchService({} as any, {} as any, single, {} as any, {} as any);
    expect((scopedService as any).creativeNameForTarget('{营销单元}+{日期}+{序号}', '腾讯03-视频组', 2, [], '腾讯03'))
      .toMatch(/^腾讯03-视频组\+\d{4}-\d{2}-\d{2}\+002$/);
  });

  it('expands the Tencent specification wildcard for each selected target', () => {
    const single = new PromotionCreativeBatchService({} as any, {} as any, {} as any, {} as any);
    const scopedService = new MultiAccountCreativeBatchService({} as any, {} as any, single, {} as any, {} as any);
    expect((scopedService as any).creativeNameForTarget('{营销单元}+{规格}+{序号}', '横版图片组', 1, [], '腾讯04', '卡片广告 横版大图 16:9'))
      .toBe('横版图片组+卡片广告 横版大图 16:9+001');
  });

  it('does not use a default component scoped to a different creative template', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'wrong', templateId: 'template-B', creativeType: 'DYNAMIC_CREATIVE_TYPE_COMMON', priority: 10 },
      { id: 'general', templateId: null, creativeType: null, marketingGoal: null, priority: 0 },
    ]);
    const scopedService = new MultiAccountCreativeBatchService({ creativeAccountDefaultComponent: { findMany } } as any, {} as any, {} as any, {} as any, {} as any);
    const resolved = await (scopedService as any).resolveDefault({ id: 'account-1' }, 'brand', 'DYNAMIC_CREATIVE_TYPE_COMMON', null, 'template-A');
    expect(resolved.id).toBe('general');
  });

  it('puts an enabled optional default into the Tencent payload and omits it when switched off', async () => {
    const account = { id: 'account-1', name: '腾讯03', accountNo: '123456', status: 'ACTIVE' };
    const snapshots = [
      { id: 'title-1', originAccountId: account.id, assetType: 'TITLE', componentField: 'title', name: '文案', payloadJson: { component: { value: { title: '文案' } } } },
      { id: 'video-1', originAccountId: account.id, assetType: 'VIDEO', componentField: 'video', name: '视频', payloadJson: { component: { value: { video_id: '721001' } } } },
    ];
    const defaultConfig = { id: 'default-1', componentType: 'action_button', componentName: '立即咨询', platformComponentId: '987654', componentSnapshot: {} };
    const prisma = {
      promotionAccount: { findMany: jest.fn().mockResolvedValue([account]) },
      promotionCreativeMaterialSnapshot: { findMany: jest.fn().mockResolvedValue(snapshots) },
      creativeAccountDefaultComponent: { findMany: jest.fn().mockResolvedValue([{ componentType: 'action_button' }]) },
    };
    const sync = { tencentAccountCredentialStatus: jest.fn().mockResolvedValue({ enabled: true, authorized: true, hasUserToken: true }) };
    const single = {
      templateDetail: jest.fn().mockResolvedValue({ template: { creative_template_id: 721, site_set: [] }, requirements: [
        { path: 'title', required: true }, { path: 'video', required: true }, { path: 'action_button', required: false },
      ] }),
      canonicalCreativeComponentField: (field: string) => field,
      componentSubmissionField: (field: string) => field,
      componentSubmissionValue: (_field: string, value: unknown) => value,
      assetMatchesTemplateDimensions: () => true,
      templateRequiresChannelImageFloatingZone: () => false,
      normalizeTencentAssetIds: (value: unknown) => value,
      aggregateImageListComponents: jest.fn(), validateTemplateComponents: jest.fn(), validatePlacementDependencies: jest.fn(),
      creativeName: jest.fn().mockReturnValue('测试创意'),
    };
    const scopedService = new MultiAccountCreativeBatchService(prisma as any, sync as any, single as any, {} as any, {} as any);
    jest.spyOn(scopedService as any, 'accountScope').mockResolvedValue({});
    jest.spyOn(scopedService as any, 'adgroup').mockResolvedValue({ adgroup_id: '147901557311', adgroup_name: '测试营销单元', marketing_goal: 'GOAL' });
    jest.spyOn(scopedService as any, 'mapAssetToTarget').mockImplementation(async (snapshot: any) => ({ snapshot, field: snapshot.componentField, component: snapshot.payloadJson.component, mappingStatus: 'AVAILABLE' }));
    jest.spyOn(scopedService as any, 'resolveDefault').mockResolvedValue(defaultConfig);
    jest.spyOn(scopedService as any, 'hydrateDefaultComponentName').mockResolvedValue(defaultConfig);
    jest.spyOn(scopedService as any, 'lookupDefaultComponent').mockResolvedValue({ row: { component_id: '987654' } });
    jest.spyOn(scopedService as any, 'componentFromRow').mockReturnValue({ component_id: 987654, value: { text: '立即咨询' } });
    const dto: any = {
      assetSnapshotIds: snapshots.map((item) => item.id), targets: [{ accountId: account.id, adgroupIds: ['147901557311'], templateId: '721' }],
      deliveryMode: 'DELIVERY_MODE_COMPONENT', creativeType: 'DYNAMIC_CREATIVE_TYPE_COMMON', combinationMode: 'SEQUENTIAL',
      namePattern: '{营销单元}+{序号}', rules: { titleCount: 1, videoCount: 1, imageCount: 0, maxPerAdgroup: 1, maxPerAccount: 1, maxTotal: 1 },
    };
    const enabled = await (scopedService as any).prepare(dto, { adminUserId: 'admin-1' });
    expect(enabled.targets[0].items[0].payload.creative_components.action_button).toEqual([{ component_id: 987654, value: { text: '立即咨询' } }]);
    expect(enabled.targets[0].defaults.map((entry: any) => entry.field)).toContain('action_button');
    dto.targets[0].disabledDefaultComponentTypes = ['action_button'];
    const disabled = await (scopedService as any).prepare(dto, { adminUserId: 'admin-1' });
    expect(disabled.targets[0].items[0].payload.creative_components.action_button).toBeUndefined();
  });

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

  it('disables a default component once and records the change in the same transaction', async () => {
    const row = { id: 'default-1', accountId: 'account-1', status: 'ACTIVE', componentType: 'label', componentSnapshot: {} };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const auditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const tx = { creativeAccountDefaultComponent: { updateMany }, auditLog: { create: auditCreate } };
    const prisma = {
      creativeAccountDefaultComponent: { findUnique: jest.fn().mockResolvedValueOnce(row).mockResolvedValueOnce({ ...row, status: 'DISABLED' }) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const scopedService = new MultiAccountCreativeBatchService(prisma as any, {} as any, {} as any, {} as any, {} as any);
    jest.spyOn(scopedService as any, 'account').mockResolvedValue({ id: 'account-1' });
    const user = { adminUserId: 'admin-1', role: 'SUPER_ADMIN' } as any;

    await expect(scopedService.deleteDefaultComponent('default-1', user)).resolves.toEqual({ id: 'default-1', disabled: true });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'default-1', status: 'ACTIVE' }, data: { status: 'DISABLED', updatedByAdminId: 'admin-1' } });
    expect(auditCreate).toHaveBeenCalledTimes(1);
    await expect(scopedService.deleteDefaultComponent('default-1', user)).resolves.toEqual({ id: 'default-1', disabled: true, alreadyDisabled: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('resolves a default landing-page component to the full name within its account', async () => {
    const findFirst = jest.fn()
      .mockResolvedValueOnce({ name: '落地页_20260929', payloadJson: { component: { value: { page_spec: { official_spec: { page_id: 6532454271 } } } } } })
      .mockResolvedValueOnce(null);
    const single = { canonicalCreativeComponentField: jest.fn((field: string) => field), officialLandingPageId: jest.fn().mockReturnValue('6532454271'), landingPageNameFromTencent: jest.fn().mockResolvedValue('完整落地页名称') };
    const scopedService = new MultiAccountCreativeBatchService({ promotionCreativeMaterialSnapshot: { findFirst } } as any, {} as any, single as any, {} as any, {} as any);
    const result = await (scopedService as any).hydrateDefaultComponentName('account-1', '123456', {
      componentType: 'main_jump_info', componentName: '落地页_20260929', platformComponentId: 'component-987',
    });
    expect(result.componentName).toBe('完整落地页名称');
    expect(findFirst.mock.calls[1][0].where).toMatchObject({ originAccountId: 'account-1', platformAssetKind: 'REFERENCE', platformAssetId: '6532454271' });
    expect(single.landingPageNameFromTencent).toHaveBeenCalledWith('123456', '6532454271');
  });

  it('replaces an old false nine-image label name with the actual label copy', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      name: '标签_20260919', payloadJson: { componentField: 'label', component: { value: { list: [
        { content: '当天种牙' }, { content: '到院领取优惠' },
      ] } } },
    });
    const single = new PromotionCreativeBatchService({} as any, {} as any, {} as any, {} as any);
    const scopedService = new MultiAccountCreativeBatchService({ promotionCreativeMaterialSnapshot: { findFirst } } as any, {} as any, single, {} as any, {} as any);
    const result = await (scopedService as any).hydrateDefaultComponentName('account-1', '123456', {
      componentType: 'label', componentName: '标签_20260919 · 九图组件（3 张）', platformComponentId: '1952471877569',
    });
    expect(result.componentName).toBe('当天种牙 · 到院领取优惠');
  });

  it('allows an approved official landing page to be saved as an account default', async () => {
    const snapshot = {
      id: 'landing-snapshot', originAccountId: 'account-1', platformAssetId: '6532454271',
      platformAssetKind: 'REFERENCE', assetType: 'LANDING_PAGE', componentField: 'main_jump_info', isDeleted: false,
      payloadJson: { kind: 'COMPONENT', componentField: 'main_jump_info', component: { value: { page_spec: { official_spec: { page_id: 6532454271 } } } } },
    };
    const created = { id: 'default-landing', accountId: 'account-1', componentType: 'main_jump_info' };
    const prisma = {
      promotionCreativeMaterialSnapshot: { findFirst: jest.fn().mockResolvedValue(snapshot) },
      creativeAccountDefaultComponent: { create: jest.fn().mockResolvedValue(created) },
    };
    const sync = { tencentApi: jest.fn().mockResolvedValue({ data: { page_id: 6532454271, page_status: 'LANDING_PAGE_STATUS_APPROVED' }, requestId: 'page-request' }) };
    const audit = { create: jest.fn().mockResolvedValue({}) };
    const single = new PromotionCreativeBatchService({} as any, {} as any, {} as any, {} as any);
    const service = new MultiAccountCreativeBatchService(prisma as any, sync as any, single, {} as any, audit as any);
    jest.spyOn(service as any, 'account').mockResolvedValue({ id: 'account-1', accountNo: '123456' });

    await expect(service.saveDefaultComponent({
      accountId: 'account-1', componentType: 'main_jump_info', platformComponentId: '6532454271', componentName: '完整落地页名称', priority: 0,
    } as any, { adminUserId: 'admin-1', role: 'SUPER_ADMIN' } as any)).resolves.toEqual(created);
    expect(sync.tencentApi).toHaveBeenCalledWith('GET', '/official_landing_page_detail/get', '123456', { page_id: 6532454271 });
    expect(prisma.creativeAccountDefaultComponent.create).toHaveBeenCalledTimes(1);
    const verified = await (service as any).lookupAsset('123456', snapshot);
    const component = (service as any).componentFromRow(verified.row, 'main_jump_info', snapshot.payloadJson);
    expect(component).toEqual(snapshot.payloadJson.component);
    expect(component).not.toHaveProperty('component_id');
  });
});
