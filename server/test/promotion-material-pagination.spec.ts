import { PromotionDataSyncService } from '../src/modules/operations/promotion-data-sync.service';

describe('Tencent material analysis pagination', () => {
  it('reads later report and creative pages, including dynamic creative components', async () => {
    const service = new PromotionDataSyncService({} as any, {} as any) as any;
    service.platformGet = jest.fn(async (url: string, _token: string, query: any) => {
      if (url.includes('daily_reports')) return { data: { list: [{ material_id: `${query.level}-${query.page}`, cost: 100 }], page_info: { total_page: 2 } } };
      return { data: { list: [{ title: `旧创意文案${query.page}` }], page_info: { total_page: 2 } } };
    });
    service.tencentApi = jest.fn(async (_method: string, _path: string, _account: string, query: any) => ({ data: { list: [{ creative_components: { title: `动态创意文案${query.page}` } }], page_info: { total_page: 2 } } }));
    const result = await service.fetchTencentMaterials('token', '10001', '2026-11-01', '2026-11-04');
    expect(result.items.some((item: any) => item.id === 'REPORT_LEVEL_MATERIAL_VIDEO-2')).toBe(true);
    expect(result.items.some((item: any) => item.name === '动态创意文案2')).toBe(true);
    expect(service.tencentApi).toHaveBeenCalledTimes(2);
  });
});
