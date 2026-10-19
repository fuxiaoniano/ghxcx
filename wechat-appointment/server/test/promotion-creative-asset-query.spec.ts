import 'reflect-metadata';
import { validate } from 'class-validator';
import { PromotionCreativeAssetQueryDto } from '../src/modules/operations/dto';

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
});
