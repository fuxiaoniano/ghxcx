import { PromotionCreativeBatchService } from '../src/modules/operations/promotion-creative-batch.service';

describe('PromotionCreativeBatchService platform safety policies', () => {
  const service = new PromotionCreativeBatchService({} as any, {} as any, {} as any, {} as any) as any;

  it('reads Tencent video dimensions and blocks landscape videos for a portrait-only template', () => {
    const requirements = service.templateRequirements({ creative_permissions: { creative_components: [{
      name: 'video', valid: { required: true, min_occurs: 1, max_occurs: 15 },
      component_sub_type_options: [{ value_field: [{ name: 'video_id', valid: { width: 720, height: 1280, min_width: 720, min_height: 1280, ratio_width: 9, ratio_height: 16 } }] }],
    }] } });
    expect(requirements[0].mediaRules).toEqual([{ width: 720, height: 1280, minWidth: 720, minHeight: 1280, ratioWidth: 9, ratioHeight: 16 }]);
    expect(service.assetMatchesTemplateDimensions({ payloadJson: { width: 1280, height: 960 } }, 'video', requirements)).toBe(false);
    expect(service.assetMatchesTemplateDimensions({ payloadJson: { width: 720, height: 1280 } }, 'video', requirements)).toBe(true);
    expect(service.assetMatchesTemplateDimensions({ payloadJson: { width: 1080, height: 1920 } }, 'video', requirements)).toBe(true);
  });

  it('matches Tencent-returned creative components, including nested image lists, without counting unrelated IDs', () => {
    const creative = { creative_components: { video: [{ value: { video_id: '101', cover_id: '202' } }], image_list: [{ value: { list: [{ image_id: '303' }] } }], description: [{ component_id: '404', value: { content: '文案' } }] } };
    expect(service.tencentCreativeUsesAsset(creative, { platformAssetId: '101', platformAssetKind: 'VIDEO' })).toBe(true);
    expect(service.tencentCreativeUsesAsset(creative, { platformAssetId: '303', platformAssetKind: 'IMAGE' })).toBe(true);
    expect(service.tencentCreativeUsesAsset(creative, { platformAssetId: '404', platformAssetKind: 'COMPONENT' })).toBe(true);
    expect(service.tencentCreativeUsesAsset(creative, { platformAssetId: '999', platformAssetKind: 'VIDEO' })).toBe(false);
  });

  it('refuses partial Tencent pagination instead of presenting a false count', async () => {
    const api = jest.fn().mockResolvedValue({ data: { list: Array.from({ length: 100 }, (_, index) => ({ dynamic_creative_id: index + 1, creative_components: {} })) } });
    const scopedService = new PromotionCreativeBatchService({} as any, { tencentApi: api } as any, {} as any, {} as any) as any;
    await expect(scopedService.tencentCreativeUsageRows('account-1', 'admin-1')).rejects.toThrow('安全分页上限');
    expect(api).toHaveBeenCalledTimes(100);
  });

  it('bypasses the creative-count cache on an explicit platform refresh', async () => {
    const api = jest.fn().mockResolvedValue({ data: { list: [{ dynamic_creative_id: 1, creative_components: {} }] } });
    const scopedService = new PromotionCreativeBatchService({} as any, { tencentApi: api } as any, {} as any, {} as any) as any;
    await scopedService.tencentCreativeUsageRows('123456', 'admin-1');
    await scopedService.tencentCreativeUsageRows('123456', 'admin-1');
    expect(api).toHaveBeenCalledTimes(1);
    await scopedService.tencentCreativeUsageRows('123456', 'admin-1', true);
    expect(api).toHaveBeenCalledTimes(2);
  });

  it('counts real Tencent creatives for only the requested account assets', async () => {
    const assets = [{ id: 'asset-1', platformAssetId: '101', platformAssetKind: 'VIDEO', componentField: 'video' }];
    const prisma = { promotionCreativeMaterialSnapshot: { findMany: jest.fn().mockResolvedValue(assets) } };
    const api = jest.fn().mockResolvedValue({ data: { list: [
      { dynamic_creative_id: 1, dynamic_creative_name: '腾讯后台创意', adgroup_id: 2, creative_components: { video: [{ value: { video_id: '101' } }] } },
      { dynamic_creative_id: 3, creative_components: { video: [{ value: { video_id: '999' } }] } },
    ] } });
    const scopedService = new PromotionCreativeBatchService(prisma as any, { tencentApi: api } as any, {} as any, {} as any) as any;
    jest.spyOn(scopedService, 'account').mockResolvedValue({ id: 'account-1', accountNo: '123456' });
    expect(await scopedService.assetCreativeUsageCounts('account-1', 'asset-1', { adminUserId: 'admin-1' })).toEqual({ scope: 'TENCENT_PLATFORM', counts: { 'asset-1': 1 } });
    expect(prisma.promotionCreativeMaterialSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ originAccountId: 'account-1' }) }));
    expect(api).toHaveBeenCalledWith('GET', '/dynamic_creatives/get', '123456', expect.any(Object), true, 'admin-1');
  });

  it('allows multiple copy, video, image and landing-page values for an ordinary creative within template limits', () => {
    const requirements = [
      { path: 'title', required: true, min: 1, max: 3, description: '文案' },
      { path: 'video', required: true, min: 1, max: 3, description: '视频' },
      { path: 'image', required: false, min: 0, max: 3, description: '图片' },
      { path: 'main_jump_info', required: true, min: 1, max: 3, description: '落地页' },
    ];
    expect(() => service.validateTemplateComponents(requirements, {
      title: [{}, {}], video: [{}, {}], image: [{}, {}], main_jump_info: [{}, {}],
    }, 'DYNAMIC_CREATIVE_TYPE_COMMON'))
      .not.toThrow();
    expect(() => service.validateTemplateComponents([{ path: 'title', required: true, min: 1, max: 2 }], { title: [{}, {}, {}] }, 'DYNAMIC_CREATIVE_TYPE_COMMON'))
      .toThrow('最多允许 2 项');
    expect(() => service.validateTemplateComponents([{ path: 'brand', required: true, min: 1, max: 1 }], { brand: [{}, {}] }, 'DYNAMIC_CREATIVE_TYPE_COMMON'))
      .toThrow('最多允许 1 项');
  });

  it('aligns dynamic required fields with the ordinary creative while retaining dynamic maximums', () => {
    const detail = {
      creative_permissions: { creative_components: [
        { name: 'video', valid: { required: true, min_occurs: 2, max_occurs: 5 } },
        { name: 'image', valid: { required: true, min_occurs: 1, max_occurs: 3 } },
        { name: 'floating_zone', valid: { required: true, min_occurs: 1, max_occurs: 1 } },
      ] },
      __ordinaryRequirements: [
        { name: 'video', path: 'video', required: true, min: 1, max: 1 },
        { name: 'image', path: 'image', required: false, min: 0, max: 1 },
        { name: 'main_jump_info', path: 'main_jump_info', required: true, min: 1, max: 1 },
      ],
    };
    const dynamic = service.templateRequirementsForContext(detail, '721', 'DYNAMIC_CREATIVE_TYPE_PROGRAM');
    expect(dynamic.find((item: any) => item.name === 'video')).toEqual(expect.objectContaining({ required: true, min: 1, max: 5 }));
    expect(dynamic.find((item: any) => item.name === 'image')).toEqual(expect.objectContaining({ required: false, min: 0, max: 3 }));
    expect(dynamic.find((item: any) => item.name === 'floating_zone')).toEqual(expect.objectContaining({ required: false, min: 0, max: 1 }));
    expect(dynamic.find((item: any) => item.name === 'main_jump_info')).toEqual(expect.objectContaining({ required: true, min: 1 }));
  });

  it('blocks missing required components and template maximum overflow', () => {
    const requirements = [{ path: 'creative_components.video', required: true, min: 1, max: 2, description: '视频' }];
    expect(() => service.validateTemplateComponents(requirements, {}, 'DYNAMIC_CREATIVE_TYPE_PROGRAM'))
      .toThrow('缺少必填组件');
    expect(() => service.validateTemplateComponents(requirements, { video: [{}, {}, {}] }, 'DYNAMIC_CREATIVE_TYPE_PROGRAM'))
      .toThrow('最多允许 2 项');
  });

  it('requires explicit dynamic ability returned by the Tencent template', () => {
    expect(() => service.assertDynamicSupport({}, 'DYNAMIC_CREATIVE_TYPE_PROGRAM'))
      .toThrow('未返回动态素材能力');
    expect(() => service.assertDynamicSupport({ support_dynamic_ability_spec_list: { dynamic_ability_type: ['MATERIAL'] } }, 'DYNAMIC_CREATIVE_TYPE_PROGRAM'))
      .not.toThrow();
  });

  it('accepts a normal Tencent adgroup even when system status is omitted, but rejects a fully unknown state', () => {
    expect(service.adgroupUsable({ configured_status: 'AD_STATUS_NORMAL', is_deleted: false })).toBe(true);
    expect(service.adgroupUsable({ system_status: 'ADGROUP_STATUS_CREATIVE_EMPTY', is_deleted: false })).toBe(true);
    expect(service.adgroupUsable({ is_deleted: false })).toBe(false);
    expect(service.adgroupUnavailableReason({ is_deleted: false })).toContain('未返回营销单元状态');
  });

  it('directly references usable assets inside the same business unit and still blocks other business units', () => {
    expect(() => service.assertAssetUsable({
      businessUnitKey: 'TENCENT_ADS:重庆', originAccountId: 'other-account', name: '其他账户视频',
      payloadJson: { kind: 'VIDEO' }, isDeleted: false, status: 'AVAILABLE', auditStatus: 'APPROVED',
    }, 'target-account', 'TENCENT_ADS:重庆')).not.toThrow();
    expect(() => service.assertAssetUsable({
      businessUnitKey: 'TENCENT_ADS:绵阳', originAccountId: 'other-account', name: '其他业务单元视频',
      payloadJson: { kind: 'VIDEO' }, isDeleted: false, status: 'AVAILABLE', auditStatus: 'APPROVED',
    }, 'target-account', 'TENCENT_ADS:重庆')).toThrow('不属于目标业务单元');
  });

  it('uses title content as the component display name when no custom name exists', () => {
    expect(service.componentName(
      { component_id: 123 },
      'title',
      { component_id: 123, value: { content: '口腔健康标题文案' } },
    )).toBe('口腔健康标题文案');
  });

  it('classifies Tencent brand and marketing components into selectable groups', () => {
    expect(service.assetFamily('brand')).toBe('BRAND');
    expect(service.assetFamily('wechat_channels')).toBe('WECHAT_CHANNELS');
    expect(service.assetFamily('text_link')).toBe('MARKETING');
    expect(service.assetFamily('floating_zone')).toBe('MARKETING');
    expect(service.assetFamily('main_jump_info')).toBe('LANDING_PAGE');
  });

  it('reads required components from the Tencent creative_permissions response shape', () => {
    expect(service.templateRequirements({ creative_permissions: { creative_components: [{
      name: 'brand', desc: '新版品牌形象', valid: { required: true, min_occurs: 1, max_occurs: 1 },
    }] } })).toEqual([expect.objectContaining({ name: 'brand', required: true, min: 1, max: 1, description: '新版品牌形象' })]);
  });

  it('exposes Tencent component types when the specification uses component_type', () => {
    expect(service.templateRequirements({ creative_components: [{
      name: 'floating_zone', component_type: 'FLOATING_ZONE', required: true,
    }] })).toEqual([expect.objectContaining({ name: 'floating_zone', elementType: 'FLOATING_ZONE', required: true })]);
  });

  it('does not invent a one-item maximum when Tencent omits max_occurs', () => {
    const requirements = service.templateRequirements({ creative_components: [{ name: 'form', valid: { required: false } }] });
    expect(requirements[0].max).toBeNull();
    expect(() => service.validateTemplateComponents(requirements, { form: [{}, {}] }, 'DYNAMIC_CREATIVE_TYPE_COMMON')).not.toThrow();
  });

  it('maps the new operator-facing asset categories to exact Tencent component fields', () => {
    expect(service.assetQueryScope('MEDIA')).toEqual({ assetType: { in: ['VIDEO', 'IMAGE'] } });
    expect(service.assetQueryScope('BRAND')).toEqual({ componentField: { in: ['brand', 'channels_brand'] } });
    expect(service.assetQueryScope('FLOATING_ZONE')).toEqual({ componentField: { in: ['floating_zone', 'floating_zone_list'] } });
    expect(service.assetQueryScope('SOCIAL_SKILL')).toEqual({ componentField: { in: ['social_skill'] } });
  });

  it('refreshes an account component category when only business-unit snapshots exist', async () => {
    const localService = new PromotionCreativeBatchService({
      promotionCreativeMaterialSnapshot: { findMany: jest.fn().mockResolvedValue([
        { payloadJson: { platformAssetScopes: ['BUSINESS_UNIT'] } },
      ]) },
    } as any, {} as any, {} as any, {} as any) as any;
    await expect(localService.hasFreshAssetSnapshots('account-1', 'TEXT_LINK', 'ACCOUNT')).resolves.toBe(false);
    await expect(localService.hasFreshAssetSnapshots('account-1', 'TEXT_LINK', 'BUSINESS_UNIT')).resolves.toBe(true);
    expect(localService.prisma.promotionCreativeMaterialSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ originAccountId: 'account-1', componentField: { in: ['text_link'] } }),
    }));
  });

  it('treats media cache as fresh only when both image and video dimensions are present', async () => {
    const findMany = jest.fn()
      .mockResolvedValueOnce([
        { assetType: 'VIDEO', payloadJson: { platformAssetScopes: ['ACCOUNT'], width: 1280, height: 720 } },
      ])
      .mockResolvedValueOnce([
        { assetType: 'VIDEO', payloadJson: { platformAssetScopes: ['ACCOUNT'], width: 1280, height: 720 } },
        { assetType: 'IMAGE', payloadJson: { platformAssetScopes: ['ACCOUNT'], width: 1080, height: 1080 } },
      ]);
    const localService = new PromotionCreativeBatchService({ promotionCreativeMaterialSnapshot: { findMany } } as any, {} as any, {} as any, {} as any) as any;
    await expect(localService.hasFreshAssetSnapshots('account-1', 'MEDIA', 'ACCOUNT')).resolves.toBe(false);
    await expect(localService.hasFreshAssetSnapshots('account-1', 'MEDIA', 'ACCOUNT')).resolves.toBe(true);
  });

  it('normalizes cached Tencent aliases to creative submission fields', () => {
    expect(service.canonicalCreativeComponentField('jump_info')).toBe('main_jump_info');
    expect(service.canonicalCreativeComponentField('floating_zone_list')).toBe('floating_zone');
    expect(service.canonicalCreativeComponentField('floating_zone')).toBe('floating_zone');
  });

  it('maps generic media fields to the selected Tencent template requirement', () => {
    expect(service.componentSubmissionField('video', [{ name: 'short_video' }])).toBe('short_video');
    expect(service.componentSubmissionField('video', [{ name: 'video' }])).toBe('video');
    expect(service.componentSubmissionField('image', [{ path: 'creative_components.image_list' }])).toBe('image_list');
  });

  it('wraps a single image with the SDK image-list component structure', () => {
    expect(service.componentSubmissionValue('image_list', { value: { image_id: '123', image_url: 'https://img.test/1.jpg' } })).toEqual({
      value: { list: [{ image_id: '123', image_url: 'https://img.test/1.jpg' }] },
    });
  });

  it('preserves a Tencent prebuilt nine-image component for direct submission', () => {
    const list = Array.from({ length: 9 }, (_, index) => ({ image_id: String(index + 1) }));
    expect(service.componentSubmissionValue('image_list', {
      component_id: '90001', value: { list, display_mode: 'IMAGE_LIST_DISPLAY_MODE_DEFAULT' },
    })).toEqual({
      component_id: '90001', value: { list, display_mode: 'IMAGE_LIST_DISPLAY_MODE_DEFAULT' },
    });
  });

  it('submits video ID only and leaves Tencent to use its default cover', () => {
    expect(service.componentSubmissionValue('video', { value: { video_id: '123', cover_id: '456' } })).toEqual({
      value: { video_id: '123' },
    });
    expect(service.componentSubmissionValue('short_video', { value: { video_id: '123', cover_id: '456' } })).toEqual({
      value: { video_id: '123' },
    });
  });

  it('keeps Tencent ratio and minimum-size rules when width and height are zero', () => {
    const requirements = service.templateRequirements({ creative_components: [{ name: 'video', required: true,
      component_sub_type_options: [{ value_field: [{ name: 'video_id', valid: {
        width: 0, height: 0, min_width: 720, min_height: 1280, ratio_width: 9, ratio_height: 16,
      } }, { name: 'cover_id', valid: { width: 720, height: 1280, required: true } }] }],
    }] });
    expect(requirements[0].mediaRules).toHaveLength(1);
    expect(requirements[0].coverRules).toEqual([{ width: 720, height: 1280 }]);
    expect(service.assetMatchesTemplateDimensions({ payloadJson: { width: 1280, height: 960 } }, 'video', requirements)).toBe(false);
    expect(service.assetMatchesTemplateDimensions({ payloadJson: { width: 720, height: 1280 } }, 'video', requirements)).toBe(true);
    expect(service.assetMatchesTemplateDimensions({ payloadJson: { width: 1080, height: 1920 } }, 'video', requirements)).toBe(true);
    expect(service.assetMatchesTemplateDimensions({ payloadJson: { width: 540, height: 960 } }, 'video', requirements)).toBe(false);
  });

  it('checks the existing Tencent default video cover without adding a cover to the creative payload', async () => {
    const tencentApi = jest.fn().mockResolvedValue({ data: { list: [{ image_id: '456', width: 1280, height: 960 }] } });
    const localService = new PromotionCreativeBatchService({} as any, { tencentApi } as any, {} as any, {} as any) as any;
    const asset = { name: '测试视频', payloadJson: { component: { value: { video_id: '123', cover_id: '456' } } } };
    const requirements = [{ name: 'video', coverRules: [{ width: 720, height: 1280 }], mediaRules: [{ ratioWidth: 9, ratioHeight: 16, minWidth: 720, minHeight: 1280 }] }];
    await expect(localService.videoDefaultCoverIssue(asset, '90913514', 'video', requirements, 'operator')).resolves.toContain('默认封面尺寸为 1280×960');
    expect(tencentApi).toHaveBeenCalledWith('GET', '/images/get', '90913514', expect.any(Object), true, 'operator');
    tencentApi.mockResolvedValueOnce({ data: { list: [{ image_id: '456', width: 720, height: 1280 }] } });
    await expect(localService.videoDefaultCoverIssue(asset, '90913514', 'video', requirements, 'operator')).resolves.toBeNull();
    tencentApi.mockResolvedValueOnce({ data: { list: [{ image_id: '456', width: 1080, height: 1920 }] } });
    await expect(localService.videoDefaultCoverIssue(asset, '90913514', 'video', requirements, 'operator')).resolves.toBeNull();
    tencentApi.mockResolvedValueOnce({ data: { list: [{ image_id: '456', width: 540, height: 960 }] } });
    await expect(localService.videoDefaultCoverIssue(asset, '90913514', 'video', requirements, 'operator')).resolves.toContain('不小于 720×1280');
    tencentApi.mockResolvedValueOnce({ data: { list: [{ image_id: '456', width: 1080, height: 1920 }] } });
    await expect(localService.videoDefaultCoverIssue(asset, '90913514', 'video', [{ name: 'video', coverRules: [{ width: 720, height: 1280 }] }], 'operator')).resolves.toContain('当前规格要求 720×1280');
  });

  it('matches the same video-channel new brand and prefers the original account', () => {
    const component = (username: string) => ({
      componentSubType: 'BRAND_WECHAT_CHANNEL',
      component: { value: { jump_info: { page_spec: { wechat_channels_profile_spec: { username } } } } },
    });
    const matched = service.matchWechatChannelBrand([
      { id: 'other', originAccountId: 'other-account', payloadJson: component('dentist') },
      { id: 'preferred', originAccountId: 'target-account', payloadJson: component('dentist') },
      { id: 'wrong', originAccountId: 'target-account', payloadJson: component('different') },
    ], 'dentist', 'target-account');
    expect(matched.id).toBe('preferred');
  });

  it('derives the Tencent compatibility component from the selected new brand account', () => {
    const component = (username: string) => ({ component: { value: { username } } });
    const matched = service.matchWechatChannelComponent([
      { id: 'other', componentField: 'wechat_channels', originAccountId: 'other-account', payloadJson: component('dentist') },
      { id: 'preferred', componentField: 'wechat_channels', originAccountId: 'target-account', payloadJson: component('dentist') },
      { id: 'wrong', componentField: 'wechat_channels', originAccountId: 'target-account', payloadJson: component('different') },
    ], 'dentist', 'target-account');
    expect(matched.id).toBe('preferred');
  });

  it('requires text-link and floating-zone components for a video-channel placement', () => {
    const template = { site_set: ['SITE_SET_MOMENTS', 'SITE_SET_CHANNELS'], creative_components: [{ name: 'video', required: true }] };
    const channel = { value: { username: 'dentist' } };
    expect(() => service.validatePlacementDependencies(template, { wechat_channels: [channel] }))
      .toThrow('文字链');
    expect(() => service.validatePlacementDependencies(template, { wechat_channels: [channel], text_link: [{}] }))
      .toThrow('浮层卡片');
    expect(() => service.validatePlacementDependencies(template, { wechat_channels: [channel], text_link: [{}], floating_zone: [{}] }))
      .not.toThrow();
  });

  it('accepts a selected image-text link without auto-adding a mutually exclusive text link', async () => {
    const localService = new PromotionCreativeBatchService({
      promotionCreativeMaterialSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
    } as any, {} as any, {} as any, {} as any) as any;
    const page = { value: { jump_info: { page_spec: { official_spec: { page_id: '6532454271' } } } } };
    const components = {
      wechat_channels: [{ value: { username: 'dentist' } }],
      brand: [{ value: { jump_info: { page_spec: { wechat_channels_profile_spec: { username: 'dentist' } } } } }],
      main_jump_info: [{ value: { page_spec: { official_spec: { page_id: '6532454271' } } } }],
      mini_card_link: [page], floating_zone: [{ value: { floating_zone_name: '活动' } }],
    };
    const template = { site_set: ['SITE_SET_CHANNELS'], creative_components: [{ name: 'video', required: true }] };
    const result = await localService.upgradeLegacyChannelComponents({ creative_components: components },
      { accountId: 'target', businessUnitKey: 'unit' }, [], template);
    expect(result.payload.creative_components.mini_card_link).toEqual([page]);
    expect(result.payload.creative_components.text_link).toBeUndefined();
    expect(() => localService.validatePlacementDependencies(template, result.payload.creative_components)).not.toThrow();
    expect(() => localService.validateTemplateComponents([], { ...components, text_link: [page] }, 'DYNAMIC_CREATIVE_TYPE_COMMON'))
      .toThrow('不能同时使用');
  });

  it('reads a missing linked landing-page name from Tencent detail only for the matching page', async () => {
    const api = jest.fn().mockResolvedValue({ data: { page_id: 6532454271, page_config: { page_name: '完整落地页名称' } } });
    const localService = new PromotionCreativeBatchService({} as any, { tencentApi: api } as any, {} as any, {} as any) as any;
    expect(await localService.landingPageNameFromTencent('123456', '6532454271')).toBe('完整落地页名称');
    expect(await localService.landingPageNameFromTencent('123456', '6532454271')).toBe('完整落地页名称');
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith('GET', '/official_landing_page_detail/get', '123456', { page_id: 6532454271 });
  });

  it('shows only the current approved official landing page, not duplicate component snapshots', async () => {
    const component = {
      id: 'component-1', originAccountId: 'account-1', businessUnitKey: 'TENCENT_ACCOUNT:123456',
      platformAssetId: '6532454271', platformAssetKind: 'REFERENCE', assetType: 'LANDING_PAGE',
      componentField: 'main_jump_info', name: '完整落地页名称', isDeleted: false, status: 'LANDING_PAGE_STATUS_APPROVED', auditStatus: 'APPROVED',
      platformCreatedAt: new Date('2026-09-29'), originAccount: { id: 'account-1', name: '测试账户', accountNo: '123456', project: '测试' },
      payloadJson: { kind: 'COMPONENT', platformAssetScopes: ['ACCOUNT'], component: { value: { page_spec: { official_spec: { page_id: 6532454271 } } } } },
    };
    const reference = { platformAssetId: '6532454271', name: '完整落地页名称', payloadJson: { component: { value: { page_spec: { official_spec: { page_id: 6532454271 } } } } } };
    const findMany = jest.fn().mockResolvedValueOnce([component]).mockResolvedValueOnce([reference]);
    const localService = new PromotionCreativeBatchService({ promotionCreativeMaterialSnapshot: { findMany } } as any, {} as any, {} as any, {} as any) as any;
    jest.spyOn(localService, 'account').mockResolvedValue({ id: 'account-1', accountNo: '123456', project: '测试' });
    jest.spyOn(localService, 'hasFreshAssetSnapshots').mockResolvedValue(true);
    jest.spyOn(localService, 'syncAssets').mockResolvedValue(undefined);

    const result = await localService.assets({ accountId: 'account-1', source: 'ACCOUNT', assetType: 'LANDING_PAGE' }, { role: 'SUPER_ADMIN' });
    expect(result.list).toHaveLength(1);
    expect(result.list[0]).toMatchObject({ name: '完整落地页名称', contentSummary: '完整落地页名称', linkedLandingPage: { pageId: '6532454271', name: '完整落地页名称' } });
    expect(findMany.mock.calls[0][0].where).toMatchObject({ platformAssetKind: 'REFERENCE', status: 'LANDING_PAGE_STATUS_APPROVED' });
    expect(findMany.mock.calls[1][0].where).toMatchObject({ originAccountId: 'account-1', platformAssetKind: 'REFERENCE' });
  });

  it('excludes obsolete component snapshots when Tencent no longer returns the page', async () => {
    const component = {
      id: 'component-1', originAccountId: 'account-1', businessUnitKey: 'TENCENT_ACCOUNT:123456',
      platformAssetId: 'component-987', platformAssetKind: 'COMPONENT', assetType: 'LANDING_PAGE', componentField: 'main_jump_info',
      name: '落地页_20260918', isDeleted: false, status: 'AVAILABLE', platformCreatedAt: new Date('2026-09-18'),
      originAccount: { id: 'account-1', name: '测试账户', accountNo: '123456', project: '测试' },
      payloadJson: { kind: 'COMPONENT', platformAssetScopes: ['ACCOUNT'], component: { value: { page_spec: { official_spec: { page_id: 6308377364 } } } } },
    };
    const findMany = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const localService = new PromotionCreativeBatchService({ promotionCreativeMaterialSnapshot: { findMany } } as any, {} as any, {} as any, {} as any) as any;
    jest.spyOn(localService, 'account').mockResolvedValue({ id: 'account-1', accountNo: '123456', project: '测试' });
    jest.spyOn(localService, 'hasFreshAssetSnapshots').mockResolvedValue(true);
    jest.spyOn(localService, 'syncAssets').mockResolvedValue(undefined);
    jest.spyOn(localService, 'landingPageNameFromTencent').mockResolvedValue(null);
    const result = await localService.assets({ accountId: 'account-1', source: 'ACCOUNT', assetType: 'LANDING_PAGE' }, { role: 'SUPER_ADMIN' });
    expect(result.list).toHaveLength(0);
  });

  it('reconciles stale account landing-page references only after a complete Tencent response', async () => {
    const upsert = jest.fn(); const updateMany = jest.fn();
    const localService = new PromotionCreativeBatchService({ promotionCreativeMaterialSnapshot: {
      findUnique: jest.fn().mockResolvedValue(null), upsert, updateMany,
    } } as any, { tencentApi: jest.fn().mockResolvedValue({ data: { list: [{
      page_id: 6577803211, page_name: '20261001-绵阳', page_status: 'LANDING_PAGE_STATUS_APPROVED',
    }] } }) } as any, {} as any, {} as any) as any;
    jest.spyOn(localService, 'tencentAssetRows').mockResolvedValue([]);
    await localService.syncAssets({ id: 'account-1', accountNo: '123456', project: '测试' }, 'LANDING_PAGE');
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { originAccountId: 'account-1', platformAssetKind: 'REFERENCE', assetType: 'LANDING_PAGE', platformAssetId: { notIn: ['6577803211'] } },
      data: { isDeleted: true },
    });
  });

  it('returns real label copy even though Tencent groups labels as OTHER assets', async () => {
    const label = {
      id: 'label-1', originAccountId: 'account-1', businessUnitKey: 'TENCENT_ACCOUNT:123456',
      platformAssetId: '987', platformAssetKind: 'COMPONENT', assetType: 'OTHER', componentField: 'label',
      name: '标签组件', isDeleted: false, status: 'AVAILABLE', auditStatus: null,
      platformCreatedAt: new Date('2026-09-29'),
      originAccount: { id: 'account-1', name: '测试账户', accountNo: '123456', project: '测试' },
      payloadJson: { kind: 'COMPONENT', componentField: 'label', platformAssetScopes: ['ACCOUNT'], component: { value: { list: [
        { image_id: '1001', content: '品质种牙' }, { image_id: '1002', content: '免费查看优惠价' },
      ] } } },
    };
    const localService = new PromotionCreativeBatchService({ promotionCreativeMaterialSnapshot: {
      findMany: jest.fn().mockResolvedValue([label]),
    } } as any, {} as any, {} as any, {} as any) as any;
    jest.spyOn(localService, 'account').mockResolvedValue({ id: 'account-1', accountNo: '123456', project: '测试' });
    jest.spyOn(localService, 'hasFreshAssetSnapshots').mockResolvedValue(true);
    jest.spyOn(localService, 'syncAssets').mockResolvedValue(new Set(['COMPONENT:987']));
    const result = await localService.assets({ accountId: 'account-1', source: 'ACCOUNT', assetType: 'LABEL' }, { role: 'SUPER_ADMIN' });
    expect(result.list[0]).toMatchObject({ type: 'LABEL', componentField: 'label', labelTexts: ['品质种牙', '免费查看优惠价'], contentSummary: '品质种牙 · 免费查看优惠价', bundleItemCount: null, usable: true });
    expect(localService.imageListItemCount(label.payloadJson, 'label')).toBe(0);
  });

  it('does not let a label without Tencent copy masquerade as an image bundle', async () => {
    const label = {
      id: 'label-without-copy', originAccountId: 'account-1', businessUnitKey: 'TENCENT_ACCOUNT:123456',
      platformAssetId: '988', platformAssetKind: 'COMPONENT', assetType: 'OTHER', componentField: 'label',
      name: '标签_20260919', isDeleted: false, status: 'AVAILABLE', auditStatus: null,
      platformCreatedAt: new Date('2026-09-29'),
      originAccount: { id: 'account-1', name: '测试账户', accountNo: '123456', project: '测试' },
      payloadJson: { kind: 'COMPONENT', componentField: 'label', platformAssetScopes: ['ACCOUNT'], component: { value: { list: [
        { image_id: '1001' }, { image_id: '1002' }, { image_id: '1003' },
      ] } } },
    };
    const localService = new PromotionCreativeBatchService({ promotionCreativeMaterialSnapshot: {
      findMany: jest.fn().mockResolvedValue([label]),
    } } as any, {} as any, {} as any, {} as any) as any;
    jest.spyOn(localService, 'account').mockResolvedValue({ id: 'account-1', accountNo: '123456', project: '测试' });
    jest.spyOn(localService, 'syncAssets').mockResolvedValue(new Set(['COMPONENT:988']));
    const result = await localService.assets({ accountId: 'account-1', source: 'ACCOUNT', assetType: 'LABEL' }, { role: 'SUPER_ADMIN' });
    expect(result.list[0]).toMatchObject({ type: 'LABEL', bundleItemCount: null, usable: false, unavailableReason: expect.stringContaining('未返回具体文案') });
    expect(result.list[0].contentSummary).not.toContain('九图组件');
  });

  it('shows only live Tencent component IDs and removes duplicate component payloads', async () => {
    const base = {
      originAccountId: 'account-1', businessUnitKey: 'TENCENT_ACCOUNT:123456', platformAssetKind: 'COMPONENT', assetType: 'OTHER',
      componentField: 'label', name: '标签文案', isDeleted: false, status: 'AVAILABLE', auditStatus: null,
      platformCreatedAt: new Date('2026-09-29'), originAccount: { id: 'account-1', name: '测试账户', accountNo: '123456', project: '测试' },
      payloadJson: { kind: 'COMPONENT', platformAssetScopes: ['ACCOUNT'], component: { value: { list: [{ content: '品质种牙' }] } } },
    };
    const rows = [
      { ...base, id: 'current-1', platformAssetId: '101' },
      { ...base, id: 'current-duplicate', platformAssetId: '102' },
      { ...base, id: 'old-snapshot', platformAssetId: '103', name: '过期组件' },
    ];
    const localService = new PromotionCreativeBatchService({ promotionCreativeMaterialSnapshot: {
      findMany: jest.fn().mockResolvedValue(rows),
    } } as any, {} as any, {} as any, {} as any) as any;
    jest.spyOn(localService, 'account').mockResolvedValue({ id: 'account-1', accountNo: '123456', project: '测试' });
    const sync = jest.spyOn(localService, 'syncAssets').mockResolvedValue(new Set(['COMPONENT:101', 'COMPONENT:102']));
    const query = { accountId: 'account-1', source: 'ACCOUNT', assetType: 'LABEL' };
    const first = await localService.assets(query, { role: 'SUPER_ADMIN' });
    expect(first.pageInfo.totalNumber).toBe(1);
    expect(first.list.map((item: any) => item.platformAssetId)).toEqual(['101']);
    await localService.assets(query, { role: 'SUPER_ADMIN' });
    expect(sync).toHaveBeenCalledTimes(1);
    await localService.assets({ ...query, refresh: true }, { role: 'SUPER_ADMIN' });
    expect(sync).toHaveBeenCalledTimes(2);
    expect(sync).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'account-1' }), undefined, 1, 100, 'ACCOUNT');
  });

  it('does not require video-only floating cards for channel-branded large-image specifications', () => {
    const template = {
      site_set: ['SITE_SET_CHANNELS'],
      creative_template_appellation: '卡片广告横版大图',
      creative_components: [{ name: 'image', required: true }, { name: 'brand', required: true }],
    };
    expect(service.templateUsesVideo(template)).toBe(false);
    expect(() => service.validatePlacementDependencies(template, {
      wechat_channels: [{ value: { username: 'dentist' } }],
      brand: [{ value: { jump_info: { page_spec: { wechat_channels_profile_spec: { username: 'dentist' } } } } }],
      image: [{ value: { image_id: '1' } }],
    })).not.toThrow();
  });

  it.each(['常规大图 1:1', '九图 1:1'])('requires a floating card for channel placement %s', (name) => {
    const template = {
      site_set: ['SITE_SET_CHANNELS'], creative_template_appellation: name,
      creative_components: [{ name: 'image_list', required: true }],
    };
    const components = { wechat_channels: [{ value: { username: 'dentist' } }], image_list: [{}] };
    expect(service.templateRequiresChannelImageFloatingZone(template)).toBe(true);
    expect(service.templateRequirementsForContext(template, 'test', 'DYNAMIC_CREATIVE_TYPE_COMMON'))
      .toEqual(expect.arrayContaining([expect.objectContaining({ path: 'floating_zone', required: true })]));
    expect(() => service.validatePlacementDependencies(template, components)).toThrow('浮层卡片');
    expect(() => service.validatePlacementDependencies(template, { ...components, floating_zone: [{}] })).not.toThrow();
  });

  it('adds the selected floating card to a 1:1 channel image creative without adding a text link', async () => {
    const scoped = new PromotionCreativeBatchService({ promotionCreativeMaterialSnapshot: {
      findMany: jest.fn().mockResolvedValue([]),
    } } as any, {} as any, {} as any, {} as any) as any;
    const components = {
      wechat_channels: [{ value: { username: 'dentist' } }],
      brand: [{ value: { jump_info: { page_spec: { wechat_channels_profile_spec: { username: 'dentist' } } } } }],
      image_list: [{}],
    };
    const card = { id: 'card-1', name: '浮层卡片', componentField: 'floating_zone', originAccountId: 'target',
      businessUnitKey: 'unit', platformAssetId: '123', status: 'ACTIVE', isDeleted: false,
      payloadJson: { component: { component_id: 123, value: { floating_zone_name: '活动' } } } };
    const result = await scoped.upgradeLegacyChannelComponents({ creative_components: components },
      { accountId: 'target', businessUnitKey: 'unit' }, [card], {
        site_set: ['SITE_SET_CHANNELS'], creative_template_appellation: '常规大图 1:1',
        creative_components: [{ name: 'image_list', required: true }],
      });
    expect(result.payload.creative_components.floating_zone).toEqual([card.payloadJson.component]);
    expect(result.payload.creative_components.text_link).toBeUndefined();
  });

  it('does not auto-add text-link or floating-zone components to large-image creatives', async () => {
    const localService = new PromotionCreativeBatchService({
      promotionCreativeMaterialSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
    } as any, {} as any, {} as any, {} as any) as any;
    const components = {
      wechat_channels: [{ value: { username: 'dentist' } }],
      brand: [{ value: { jump_info: { page_spec: { wechat_channels_profile_spec: { username: 'dentist' } } } } }],
      image: [{ value: { image_id: '1' } }],
    };
    const result = await localService.upgradeLegacyChannelComponents(
      { creative_components: components },
      { accountId: 'target', businessUnitKey: 'unit' },
      [],
      { creative_components: [{ name: 'image', required: true }, { name: 'brand', required: true }] },
    );
    expect(result.payload.creative_components).toEqual(components);
    expect(result.payload.creative_components.text_link).toBeUndefined();
    expect(result.payload.creative_components.floating_zone).toBeUndefined();
  });

  it('rejects a video-channel text link whose page ID differs from the main landing page', () => {
    const template = { site_set: ['SITE_SET_CHANNELS'], creative_components: [{ name: 'video', required: true }] };
    const components = {
      wechat_channels: [{ value: { username: 'dentist' } }],
      main_jump_info: [{ value: { page_spec: { official_spec: { page_id: '6532454271' } } } }],
      text_link: [{ value: { jump_info: { page_spec: { official_spec: { page_id: '6308377364' } } } } }],
      floating_zone: [{ value: { floating_zone_name: '种牙活动' } }],
    };
    expect(() => service.validatePlacementDependencies(template, components))
      .toThrow('文字链落地页必须与主落地页一致');
  });

  it('automatically replaces a mismatched selected text link with one for the main landing page', async () => {
    const localService = new PromotionCreativeBatchService({
      promotionCreativeMaterialSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
    } as any, {} as any, {} as any, {} as any) as any;
    const mainPage = { value: { page_spec: { official_spec: { page_id: '6532454271' } } } };
    const wrongLink = { value: { jump_info: { page_spec: { official_spec: { page_id: '6308377364' } } } } };
    const rightLink = { value: { jump_info: { page_spec: { official_spec: { page_id: '6532454271' } } } } };
    const result = await localService.upgradeLegacyChannelComponents({ creative_components: {
      wechat_channels: [{ value: { username: 'dentist' } }],
      brand: [{ value: { jump_info: { page_spec: { wechat_channels_profile_spec: { username: 'dentist' } } } } }],
      main_jump_info: [mainPage],
      text_link: [wrongLink],
      floating_zone: [{ value: { floating_zone_name: '种牙活动' } }],
    } }, { accountId: 'target', businessUnitKey: 'unit' }, [{
      id: 'right-link', componentField: 'text_link', originAccountId: 'target', businessUnitKey: 'unit',
      name: '匹配文字链', isDeleted: false, status: 'AVAILABLE', auditStatus: 'APPROVED',
      payloadJson: { component: rightLink },
    }], { creative_components: [{ name: 'video', required: true }] });
    expect(localService.officialLandingPageId(result.payload.creative_components.text_link[0])).toBe('6532454271');
    expect(result.assets.map((item: any) => item.id)).toContain('right-link');
  });

  it('matches a text link against the selected official landing page', () => {
    const component = (pageId: string) => ({ value: { jump_info: { page_spec: { official_spec: { page_id: pageId } } } } });
    const matched = service.matchPlacementComponent([
      { id: 'wrong', componentField: 'text_link', originAccountId: 'target', payloadJson: { component: component('1') } },
      { id: 'right', componentField: 'text_link', originAccountId: 'target', payloadJson: { component: component('2') } },
    ], 'text_link', 'target', '2');
    expect(matched.id).toBe('right');
  });

  it('accepts a selected floating-zone alias before falling back to cached defaults', () => {
    const matched = service.matchPlacementComponent([
      { id: 'selected', componentField: 'floating_zone_list', originAccountId: 'target', payloadJson: { component: { value: { floating_zone_name: '用户选择' } } } },
    ], 'floating_zone', 'target');
    expect(matched.id).toBe('selected');
  });

  it('rotates every selected account component by field without putting duplicates in one common creative', () => {
    const base = [{ titleIds: ['title-1'], videoIds: ['video-1'], landingPageIds: ['page-1'], conversionIds: [], imageIds: [], otherComponentIds: [] }];
    const assets = [
      { id: 'brand-1', componentField: 'brand', payloadJson: {} },
      { id: 'brand-2', componentField: 'brand', payloadJson: {} },
      { id: 'card-1', componentField: 'floating_zone', payloadJson: {} },
      { id: 'card-2', componentField: 'floating_zone_list', payloadJson: {} },
      { id: 'card-3', componentField: 'floating_zone', payloadJson: {} },
    ];
    const result = service.applyFixedComponentVariants(base, assets, [{ name: 'brand' }, { name: 'floating_zone' }], 'BALANCED', 50);
    expect(result).toHaveLength(3);
    expect(result.every((item: any) => item.otherComponentIds.length === 2)).toBe(true);
    expect(new Set(result.flatMap((item: any) => item.otherComponentIds))).toEqual(new Set(['brand-1', 'brand-2', 'card-1', 'card-2', 'card-3']));
  });

  it('includes fixed component variants in full-combination mode', () => {
    const base = [{ titleIds: ['title-1'], videoIds: [], landingPageIds: ['page-1'], conversionIds: [], imageIds: ['image-1'], otherComponentIds: [] }];
    const assets = [
      { id: 'brand-1', componentField: 'brand', payloadJson: {} },
      { id: 'brand-2', componentField: 'brand', payloadJson: {} },
      { id: 'button-1', componentField: 'action_button', payloadJson: {} },
      { id: 'button-2', componentField: 'action_button', payloadJson: {} },
    ];
    expect(service.applyFixedComponentVariants(base, assets, [{ name: 'brand' }, { name: 'action_button' }], 'CARTESIAN', 50)).toHaveLength(4);
  });

  it('builds a creative name from component name placeholders', () => {
    const name = service.creativeName('{账户}-{品牌形象}-{标题}-{营销组件}-{序号}', 2, [
      { assetType: 'BRAND', name: '傅小念口腔' },
      { assetType: 'TITLE', name: '种牙优惠' },
      { assetType: 'MARKETING', name: '浮层卡片' },
    ], '腾讯01');
    expect(name).toBe('腾讯01-傅小念口腔-种牙优惠-浮层卡片-002');
  });

  it('adds plus separators between adjacent creative-name placeholders', () => {
    const name = service.creativeName('{账户}{标题}{视频}{图片}{序号}', 1, [
      { assetType: 'TITLE', name: '种牙优惠' },
      { assetType: 'VIDEO', name: '视频A' },
      { assetType: 'IMAGE', name: '横版大图A' },
    ], '腾讯03');
    expect(name).toBe('腾讯03+种牙优惠+视频A+横版大图A+001');
  });

  it('expands the selected Tencent specification in a creative name', () => {
    expect(service.creativeName('{账户}+{规格}+{序号}', 1, [], '腾讯04', '卡片广告 横版大图 16:9'))
      .toBe('腾讯04+卡片广告 横版大图 16:9+001');
  });

  it('reports the actual specification instead of calling every image_list a nine-image creative', () => {
    const components = { image_list: [{ value: { list: Array.from({ length: 5 }, (_, index) => ({ image_id: String(index + 1) })) } }] };
    expect(() => service.validateTemplateComponents(
      [{ name: 'image_list', required: true, min: 1, max: 1, itemMin: 1, itemMax: 1 }],
      components, 'DYNAMIC_CREATIVE_TYPE_COMMON', '卡片广告 横版大图 16:9',
    )).toThrow('创意规格“卡片广告 横版大图 16:9”每个图片组件只允许 1 张图片');
  });

  it('keeps video-channel authorization results independent from official-account APIs', async () => {
    const tencentApi = jest.fn().mockResolvedValue({ data: { list: [{
      wechat_channels_account_id: 'wx-channel-1',
      wechat_channels_account_name: '傅小念口腔视频号',
    }] } });
    const localService = new PromotionCreativeBatchService({} as any, { tencentApi } as any, {} as any, {} as any) as any;
    const result = await localService.authorizedBrandAccounts('987654321');
    expect(result.channels.get('wx-channel-1')?.wechat_channels_account_name).toBe('傅小念口腔视频号');
    expect(tencentApi).toHaveBeenCalledTimes(1);
    expect(tencentApi).toHaveBeenCalledWith('GET', '/wechat_channels_accounts/get', '987654321', expect.any(Object));
  });

  it('maps Tencent component-report cost to copy component IDs in yuan', async () => {
    const tencentApi = jest.fn().mockResolvedValue({ data: { list: [
      { dimensions: { component_id: 123456 }, metrics: { cost: 1250 } },
      { component_id: 123456, cost: 250 },
    ] } });
    const localService = new PromotionCreativeBatchService({} as any, { tencentApi } as any, {} as any, {} as any) as any;
    const result = await localService.componentSpendWindows('987654321', '123456');
    expect(result.seven.get('123456')).toBe(15);
    expect(result.fifteen.get('123456')).toBe(15);
    expect(tencentApi).toHaveBeenCalledWith('GET', '/daily_reports/get', '987654321', expect.objectContaining({
      level: 'REPORT_LEVEL_COMPONENT',
      group_by: JSON.stringify(['component_id']),
      organization_id: 123456,
    }), false);
  });

  it('extracts readable content for title, brand and marketing components', () => {
    expect(service.componentContent('title', { value: { content: '标题正文' } }, '标题组件')).toBe('标题正文');
    expect(service.componentContent('brand', { value: { brand_name: '傅小念口腔' } }, '品牌组件')).toBe('傅小念口腔');
    expect(service.componentContent('floating_zone', { value: { floating_zone_name: '种牙活动', floating_zone_desc: '到院领取' } }, '浮层卡片')).toBe('种牙活动 · 到院领取');
    expect(service.componentContent('social_skill', { value: { social_skill_first_comment: '统一回复：是真的！' } }, '首评回复')).toBe('统一回复：是真的！');
    expect(service.componentContent('brand', { value: { jump_info: { page_spec: { wechat_channels_profile_spec: { nickname: '傅小念视频号' } } } } }, '品牌组件')).toBe('傅小念视频号');
    expect(service.componentContent('text_link', { value: { link_name_type: 'VIEW_DETAILS' } }, '文字链组件')).toBe('查看详情');
    expect(service.componentContent('text_link', { value: { link_name_type: 'MORE_INFO' } }, '文字链组件')).toBe('了解更多');
    expect(service.componentContent('mini_card_link', { value: { mini_card_link_description: '在线查询种牙价格', mini_card_link_button_text: '查看详情' } }, '图文链接')).toBe('在线查询种牙价格 · 查看详情');
    const label = { value: { list: [
      { type: 'LABEL_TYPE_CUSTOMIZETEXT', content: '品质种牙' },
      { type: 'LABEL_TYPE_CUSTOMIZETEXT', content: '大额补贴', display_content: '补贴活动' },
      { type: 'LABEL_TYPE_CUSTOMIZETEXT', content: '报名享优惠价' },
    ] } };
    expect(service.labelTexts(label)).toEqual(['品质种牙', '补贴活动', '报名享优惠价']);
    expect(service.componentContent('label', label, '标签_20260919')).toBe('品质种牙 · 补贴活动 · 报名享优惠价');
    expect(service.labelTexts({ value: { label_list: [{ label_content: '当天种牙' }, { label_text: '医保咨询' }] } }))
      .toEqual(['当天种牙', '医保咨询']);
  });

  it('labels authorized video-channel and official-account brand components distinctly', () => {
    const authorized = {
      channels: new Map([['channel-id', { wechat_channels_account_name: '傅小念口腔视频号', wechat_channels_account_icon: 'https://example.test/channel.png' }]]),
      officials: new Map([['official-id', { wechat_official_account_name: '傅小念口腔公众号' }]]),
    };
    expect(service.brandAuthorization({ value: { jump_info: { page_spec: { wechat_channels_profile_spec: { wechat_channels_account_id: 'channel-id' } } } } }, authorized))
      .toMatchObject({ label: '视频号 · 傅小念口腔视频号', account: { type: 'WECHAT_CHANNELS' } });
    expect(service.brandAuthorization({ value: { jump_info: { page_spec: { wechat_official_account_detail_spec: { app_id: 'official-id' } } } } }, authorized))
      .toMatchObject({ label: '公众号 · 傅小念口腔公众号', account: { type: 'WECHAT_OFFICIAL' } });
  });

  it('normalizes Tencent creative media IDs to strings without changing numeric entity IDs', () => {
    const normalized = service.normalizeTencentCreativePayload({
      account_id: 123456,
      adgroup_id: 234567,
      creative_template_id: 345678,
      creative_components: {
        video: [{ value: { video_id: 50793985457, cover_id: 60793985457 } }],
        image: [{ value: { image_id: 70793985457 } }],
        main_jump_info: [{ value: { page_spec: { official_spec: { page_id: 456789 } } } }],
      },
    });

    expect(normalized).toMatchObject({
      account_id: 123456,
      adgroup_id: 234567,
      creative_template_id: 345678,
      creative_components: {
        video: [{ value: { video_id: '50793985457', cover_id: '60793985457' } }],
        image: [{ value: { image_id: '70793985457' } }],
        main_jump_info: [{ value: { page_spec: { official_spec: { page_id: 456789 } } } }],
      },
    });
  });

  it('blocks reference-only and invalid platform assets', () => {
    expect(() => service.assertAssetUsable({
      businessUnitKey: 'TENCENT_ADS:重庆', originAccountId: 'target-account', name: '参考落地页',
      payloadJson: { kind: 'REFERENCE' }, isDeleted: false, status: 'AVAILABLE', auditStatus: 'APPROVED',
    }, 'target-account', 'TENCENT_ADS:重庆')).toThrow('缺少可提交结构');
  });

  it('allows only authorized video-channel brand components', () => {
    const base = { businessUnitKey: 'TENCENT_ADS:重庆', originAccountId: 'target-account', componentField: 'brand', isDeleted: false, status: 'AVAILABLE', auditStatus: 'APPROVED' };
    expect(() => service.assertAssetUsable({ ...base, name: '公众号品牌', payloadJson: { kind: 'COMPONENT', componentSubType: 'BRAND_WECHAT' } }, 'target-account', 'TENCENT_ADS:重庆')).toThrow('视频号品牌组件');
    expect(() => service.assertAssetUsable({ ...base, name: '视频号品牌', payloadJson: { kind: 'COMPONENT', componentSubType: 'BRAND_WECHAT_CHANNEL' } }, 'target-account', 'TENCENT_ADS:重庆')).not.toThrow();
  });

  it('verifies platform components independent of order while rejecting changed material values', () => {
    const expected = { title: [{ component_id: 1, value: { content: 'A' } }, { component_id: 2, value: { content: 'B' } }] };
    const reordered = { title: [{ component_id: 2, value: { content: 'B' }, is_deleted: false }, { component_id: 1, value: { content: 'A' } }] };
    const changed = { title: [{ component_id: 2, value: { content: 'C' } }, { component_id: 1, value: { content: 'A' } }] };
    expect(service.platformComponentsMatch(expected, reordered)).toBe(true);
    expect(service.platformComponentsMatch(expected, changed)).toBe(true); // component IDs are the Tencent source of truth.
    expect(service.platformComponentsMatch({ title: [{ value: { content: 'A' } }] }, { title: [{ value: { content: 'B' } }] })).toBe(false);
    expect(service.platformComponentsMatch(
      { video: [{ value: { video_id: '100' } }] },
      { video: [{ component_id: 9, value: { video_id: '100', cover_id: '200' }, is_deleted: false }] },
    )).toBe(true); // Tencent may append the video's default cover during creation.
    expect(service.platformComponentsMatch(
      { video: [{ value: { video_id: '100' } }] },
      { video: [{ value: { video_id: '101', cover_id: '200' } }] },
    )).toBe(false);
    expect(service.platformComponentsMatch(
      { main_jump_info: [{ value: { page_type: 'PAGE_TYPE_OFFICIAL', platform_type: 'ALL', jumpinfo_account_id: 123, page_spec: { official_spec: { page_id: 456 } } } }] },
      { main_jump_info: [{ component_id: 9, value: { page_type: 'PAGE_TYPE_OFFICIAL', page_spec: { official_spec: { page_id: 456 } } }, is_deleted: false }] },
    )).toBe(true); // Tencent removes submission-only landing-page metadata.
  });

  it('redacts credentials and masks Tencent identifiers before writing platform submission logs', () => {
    expect(service.redact({ access_token: 'plain-token', account_id: 12345678, nested: { creativeId: '98765432' } })).toEqual({
      access_token: '[REDACTED]', account_id: '****5678', nested: { creativeId: '****5432' },
    });
  });

  it('returns an actionable recovery instruction for Tencent real-name token failures', () => {
    expect(service.recoverySuggestion('11101', '请求缺失实名认证令牌')).toContain('User Token');
    expect(service.recoverySuggestion('11101', '请求缺失实名认证令牌')).toContain('仅重试失败项');
  });

  it('reads nested nine-image constraints from the Tencent template and aggregates one image-list component', () => {
    const requirements = service.templateRequirements({
      creative_permissions: { creative_components: [{
        name: 'image_list', valid: { required: true, min_occurs: 1, max_occurs: 15 },
        component_sub_type_options: [{ component_sub_type: 'IMAGE_LIST_1X1_9', value_field: [{
          name: 'list', valid: { min_occurs: 9, max_occurs: 9 },
          structure: [{ name: 'image_id', valid: { width: 800, height: 800 } }],
        }] }],
      }] },
    });
    expect(requirements[0]).toEqual(expect.objectContaining({ itemMin: 9, itemMax: 9 }));
    expect(requirements[0].itemRules[0]).toEqual(expect.objectContaining({ width: 800, height: 800 }));

    const components: Record<string, unknown[]> = {
      image_list: Array.from({ length: 9 }, (_, index) => ({ value: { list: [{ image_id: String(index + 1) }] } })),
    };
    service.aggregateImageListComponents(components, requirements);
    expect(components.image_list).toHaveLength(1);
    expect((components.image_list[0] as any).value.list).toHaveLength(9);
    expect(() => service.validateTemplateComponents(requirements, components, 'DYNAMIC_CREATIVE_TYPE_COMMON')).not.toThrow();
  });

  it('rejects an incomplete nine-image component before calling Tencent', () => {
    const requirements = [{ name: 'image_list', path: 'image_list', required: true, min: 1, max: 15, itemMin: 9, itemMax: 9 }];
    const components = { image_list: [{ value: { list: [{ image_id: '1' }] } }] };
    expect(() => service.validateTemplateComponents(requirements, components, 'DYNAMIC_CREATIVE_TYPE_COMMON')).toThrow('只允许 9 张图片');
  });

  it('accepts a matching Tencent nine-image component without top-level dimensions', () => {
    const requirements = [{
      name: 'image_list', itemMin: 9, itemMax: 9,
      itemRules: [{ componentSubType: 'IMAGE_LIST_1X1_9', min: 9, max: 9, width: 800, height: 800 }],
    }];
    const payloadJson = {
      componentSubType: 'IMAGE_LIST_1X1_9',
      component: { component_id: '90001', value: { list: Array.from({ length: 9 }, (_, index) => ({ image_id: String(index + 1) })) } },
    };
    expect(service.assetMatchesTemplateDimensions({ payloadJson }, 'image_list', requirements)).toBe(true);
    expect(service.imageListItemCount(payloadJson, 'image_list')).toBe(9);
    expect(service.imageListItemCount({ ...payloadJson, componentField: 'label' })).toBe(0);
  });

  it('rejects a bundle whose own Tencent subtype disagrees with its image count', () => {
    const requirement = { name: 'image_list', itemMin: 3, itemMax: 9, itemRules: [
      { componentSubType: 'IMAGE_LIST_1X1_3', min: 3, max: 3 },
      { componentSubType: 'IMAGE_LIST_1X1_9', min: 9, max: 9 },
    ] };
    const asset = { componentField: 'image_list', payloadJson: { componentSubType: 'IMAGE_LIST_1X1_3', component: { value: { list: Array.from({ length: 9 }, (_, index) => ({ image_id: String(index + 1) })) } } } };
    expect(service.assetMatchesTemplateDimensions(asset, 'image_list', [requirement])).toBe(false);
  });

  it('keeps multiple complete nine-image components separate when Tencent allows them', () => {
    const bundle = (prefix: string) => ({ value: { list: Array.from({ length: 9 }, (_, index) => ({ image_id: `${prefix}-${index}` })) } });
    const requirements = [{ name: 'image_list', min: 1, max: 15, itemMin: 9, itemMax: 9 }];
    const components = { image_list: [bundle('a'), bundle('b')] };
    service.aggregateImageListComponents(components, requirements);
    expect(components.image_list).toHaveLength(2);
    expect(() => service.validateTemplateComponents(requirements, components, 'DYNAMIC_CREATIVE_TYPE_COMMON')).not.toThrow();
  });

  it('groups six single images into two three-image components instead of one invalid six-image component', () => {
    const requirements = [{ name: 'image_list', min: 1, max: 15, itemMin: 3, itemMax: 3, itemRules: [{ min: 3, max: 3 }] }];
    const components: Record<string, unknown[]> = { image_list: Array.from({ length: 6 }, (_, index) => ({ value: { list: [{ image_id: String(index + 1) }] } })) };
    service.aggregateImageListComponents(components, requirements);
    expect(components.image_list).toHaveLength(2);
    expect((components.image_list[0] as any).value.list).toHaveLength(3);
    expect((components.image_list[1] as any).value.list).toHaveLength(3);
    expect(() => service.validateTemplateComponents(requirements, components, 'DYNAMIC_CREATIVE_TYPE_COMMON')).not.toThrow();
  });

  it('checks actual image-list subtypes rather than accepting every count between the smallest and largest', () => {
    const requirement = { name: 'image_list', min: 1, max: 15, itemMin: 3, itemMax: 9, itemRules: [{ min: 3, max: 3 }, { min: 4, max: 4 }, { min: 6, max: 6 }, { min: 9, max: 9 }] };
    const components = { image_list: [{ value: { list: Array.from({ length: 5 }, (_, index) => ({ image_id: String(index + 1) })) } }] };
    expect(() => service.validateTemplateComponents([requirement], components, 'DYNAMIC_CREATIVE_TYPE_COMMON')).toThrow('只允许 3、4、6、9 张图片');
  });

  it('enforces a selected conditional component minimum without requiring the component when absent', () => {
    const requirements = [{ name: 'floating_zone_list', required: false, min: 3, max: 5 }];
    expect(() => service.validateTemplateComponents(requirements, {}, 'DYNAMIC_CREATIVE_TYPE_COMMON')).not.toThrow();
    expect(() => service.validateTemplateComponents(requirements, { floating_zone_list: [{}] }, 'DYNAMIC_CREATIVE_TYPE_COMMON')).toThrow('至少需要 3 项');
  });

  it('reports an unsupported required field explicitly rather than silently omitting it', () => {
    expect(() => service.validateTemplateComponents([{ name: 'future_component', required: true, min: 1, max: 1 }], {}, 'DYNAMIC_CREATIVE_TYPE_COMMON')).toThrow('当前系统尚未支持');
  });

  it.each([
    ['641 三图', 3], ['642 四图', 4], ['643 六图', 6], ['2277 九图', 9],
  ])('follows the Tencent nested image-list size for %s', (_name, imageCount) => {
    const requirements = [{ name: 'image_list', required: true, min: 1, max: 15,
      itemMin: imageCount, itemMax: imageCount, itemRules: [{ min: imageCount, max: imageCount }] }];
    const components = { image_list: [{ value: { list: Array.from({ length: imageCount }, (_, index) => ({ image_id: String(index + 1) })) } }] };
    expect(() => service.validateTemplateComponents(requirements, components, 'DYNAMIC_CREATIVE_TYPE_COMMON')).not.toThrow();
    components.image_list[0].value.list.pop();
    expect(() => service.validateTemplateComponents(requirements, components, 'DYNAMIC_CREATIVE_TYPE_COMMON')).toThrow(`只允许 ${imageCount} 张图片`);
  });

  it.each([
    ['618 视频', 'floating_zone'], ['643 六图', 'action_button'], ['1707 卡片横图', 'image_list'],
  ])('requires the Tencent-declared field for %s', (_name, field) => {
    expect(() => service.validateTemplateComponents([{ name: field, required: true, min: 1, max: 1 }], {}, 'DYNAMIC_CREATIVE_TYPE_COMMON')).toThrow('缺少必填组件');
  });

  it('keeps component-mode card images separate and permits Tencent-returned 3 copies and 15 image components', () => {
    const requirements = service.templateRequirements({ creative_components: [
      { name: 'description', valid: { required: true, min_occurs: 1, max_occurs: 3 } },
      { name: 'image_list', valid: { required: true, min_occurs: 1, max_occurs: 15 },
        component_sub_type_options: [{ component_sub_type: 'IMAGE_LIST_16X9_1', value_field: [{ name: 'list', valid: { min_occurs: 1, max_occurs: 1 } }] }] },
    ] });
    const components: Record<string, unknown[]> = {
      description: Array.from({ length: 3 }, (_, index) => ({ value: { description: `文案${index}` } })),
      image_list: Array.from({ length: 15 }, (_, index) => ({ value: { list: [{ image_id: String(index + 1) }] } })),
    };
    service.aggregateImageListComponents(components, requirements);
    expect(components.image_list).toHaveLength(15);
    expect(() => service.validateTemplateComponents(requirements, components, 'DYNAMIC_CREATIVE_TYPE_COMMON', '卡片广告 横版大图 16:9')).not.toThrow();
    components.image_list.push({ value: { list: [{ image_id: '16' }] } });
    expect(() => service.validateTemplateComponents(requirements, components, 'DYNAMIC_CREATIVE_TYPE_COMMON')).toThrow('最多允许 15 项');
  });

  it('respects the custom-mode Tencent limit of one copy and one card image component', () => {
    const requirements = service.templateRequirements({ creative_components: [
      { name: 'description', valid: { required: true, min_occurs: 1, max_occurs: 1 } },
      { name: 'image_list', valid: { required: true, min_occurs: 1, max_occurs: 1 },
        component_sub_type_options: [{ component_sub_type: 'IMAGE_LIST_16X9_1', value_field: [{ name: 'list', valid: { min_occurs: 1, max_occurs: 1 } }] }] },
    ] });
    const components = { description: [{}, {}, {}], image_list: [{ value: { list: [{ image_id: '1' }] } }] };
    expect(() => service.validateTemplateComponents(requirements, components, 'DYNAMIC_CREATIVE_TYPE_COMMON')).toThrow('最多允许 1 项');
  });
});
