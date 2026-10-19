import { diagnosePromotionMaterial } from '../src/modules/operations/promotion-material-health';

describe('promotion material health', () => {
  it('marks a delivered material with clicks but no conversion as risk', () => {
    const result = diagnosePromotionMaterial({
      id: 'video-1', type: 'VIDEO', name: '视频 1',
      metrics: { spend: 600, impressions: 10_000, clicks: 80, conversions: 0 },
    });
    expect(result.health).toBe('RISK');
    expect(result.issues).toContain('已有点击但没有转化');
  });

  it('does not invent performance attribution for configuration-only assets', () => {
    const result = diagnosePromotionMaterial({ id: 'title-1', type: 'COPY', name: '种植牙咨询', metrics: null });
    expect(result.health).toBe('UNASSESSED');
    expect(result.calculated.costPerConversion).toBeNull();
    expect(result.issues[0]).toContain('未返回');
  });

  it('marks platform low-efficiency material as risk', () => {
    const result = diagnosePromotionMaterial({ id: 'video-2', type: 'VIDEO', name: '视频 2', officialLowEfficiency: true, metrics: null });
    expect(result.health).toBe('RISK');
  });
});
