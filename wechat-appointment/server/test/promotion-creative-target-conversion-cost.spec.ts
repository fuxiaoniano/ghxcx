import { PromotionDataSyncService } from '../src/modules/operations/promotion-data-sync.service';

describe('Tencent creative asset target conversion cost', () => {
  it('uses the returned conversions_cost in cents and keeps missing values empty', async () => {
    const service = new PromotionDataSyncService({} as any, {} as any) as any;
    service.platformGet = jest.fn(async (url: string, _token: string, query: Record<string, string>) => {
      if (url.includes('/adcreatives/get')) return { data: { list: [] } };
      return { data: { list: [{ dimensions: { material_id: query.level === 'REPORT_LEVEL_MATERIAL_VIDEO' ? '101' : '202' }, metrics: {
        cost: 12000, conversions_count: 4,
        ...(query.level === 'REPORT_LEVEL_MATERIAL_VIDEO' ? { conversions_cost: 3000 } : {}),
      } }] } };
    });

    const result = await service.fetchTencentMaterials('token-for-test', '123', '2026-10-14', '2026-10-20');
    expect(result.items.find((item: any) => item.id === '101')?.metrics?.targetConversionCost).toBe(30);
    expect(result.items.find((item: any) => item.id === '202')?.metrics?.targetConversionCost).toBeNull();
    expect(service.platformGet).toHaveBeenCalledWith(expect.stringContaining('/daily_reports/get'), 'token-for-test',
      expect.objectContaining({ fields: expect.stringContaining('conversions_cost') }), 'TENCENT_ADS');
  });
});
