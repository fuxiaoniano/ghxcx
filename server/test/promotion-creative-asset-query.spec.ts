import 'reflect-metadata';
import { validate } from 'class-validator';
import { PromotionCreativeAssetQueryDto } from '../src/modules/operations/dto';
import { PromotionCreativeBatchService } from '../src/modules/operations/promotion-creative-batch.service';

describe('promotion creative asset query', () => {
  it('accepts video-channel assets and an exact material dimension filter', async () => {
    const dto = Object.assign(new PromotionCreativeAssetQueryDto(), {
      accountId: 'account-local-id',
      source: 'ACCOUNT',
      assetType: 'WECHAT_CHANNELS',
      dimensions: '720×1280',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects malformed dimension filters', async () => {
    const dto = Object.assign(new PromotionCreativeAssetQueryDto(), {
      accountId: 'account-local-id',
      source: 'ACCOUNT',
      assetType: 'MEDIA',
      dimensions: '720x1280 OR 1=1',
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('maps every default-component category to its real Tencent component fields', () => {
    const service = new PromotionCreativeBatchService({} as any, {} as any, {} as any, {} as any) as any;
    expect(service.assetQueryScope('WECHAT_CHANNELS')).toEqual({ componentField: { in: ['wechat_channels'] } });
    expect(service.assetQueryScope('CONVERSION')).toEqual({ componentField: { in: ['consult', 'phone', 'form'] } });
    expect(service.assetQueryScope('OTHER')).toEqual({ assetType: 'OTHER' });
    expect(service.requestedAssetMatches('WECHAT_CHANNELS', 'WECHAT_CHANNELS', 'wechat_channels')).toBe(true);
    expect(service.requestedAssetMatches('CONVERSION', 'CONVERSION', 'form')).toBe(true);
  });

  it('accepts separate image, video and nine-image component queries', async () => {
    for (const assetType of ['IMAGE', 'VIDEO', 'NINE_IMAGE']) {
      const dto = Object.assign(new PromotionCreativeAssetQueryDto(), { accountId: 'account-local-id', source: 'ACCOUNT', assetType });
      await expect(validate(dto)).resolves.toHaveLength(0);
    }
  });

  it('keeps built image-list components separate from single images', () => {
    const service = new PromotionCreativeBatchService({} as any, {} as any, {} as any, {} as any) as any;
    const bundle = { assetType: 'IMAGE', componentField: 'image_list', payloadJson: { component: { value: { list: Array.from({ length: 9 }, (_, index) => ({ image_id: String(index + 1) })) } } } };
    const single = { assetType: 'IMAGE', componentField: 'image', payloadJson: { component: { value: { image_id: '10' } } } };
    const video = { assetType: 'VIDEO', componentField: 'video', payloadJson: {} };
    expect(service.assetQueryScope('NINE_IMAGE')).toEqual({ assetType: 'IMAGE', componentField: 'image_list' });
    expect(service.assetQueryScope('IMAGE')).toEqual({ assetType: 'IMAGE' });
    expect(service.assetQueryScope('VIDEO')).toEqual({ assetType: 'VIDEO' });
    expect(service.requestedAssetMatches('NINE_IMAGE', 'IMAGE', 'image_list')).toBe(true);
    expect(service.requestedAssetMatches('NINE_IMAGE', 'IMAGE', 'image')).toBe(false);
    expect(service.selectedMediaKindMatches('NINE_IMAGE', bundle)).toBe(true);
    expect(service.selectedMediaKindMatches('IMAGE', bundle)).toBe(false);
    expect(service.selectedMediaKindMatches('IMAGE', single)).toBe(true);
    expect(service.selectedMediaKindMatches('VIDEO', video)).toBe(true);
    expect(service.selectedMediaKindMatches('VIDEO', single)).toBe(false);
  });
});
