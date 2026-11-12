import { PromotionDataSyncService } from '../src/modules/operations/promotion-data-sync.service';

describe('scheduled promotion sync coordination', () => {
  const makeRedis = () => {
    const keys = new Map<string, string>();
    return {
      get: jest.fn(async (key: string) => keys.get(key) ?? null),
      set: jest.fn(async (key: string, token: string) => {
        if (keys.has(key)) return null;
        keys.set(key, token); return 'OK';
      }),
      eval: jest.fn(async (script: string, count: number, ...args: string[]) => {
        const [key, second, third] = args;
        const token = count === 2 ? third : second;
        if (keys.get(key) !== token) return 0;
        if (script.includes("redis.call('set'")) keys.set(second, '1');
        if (script.includes("redis.call('del'")) keys.delete(key);
        return 1;
      }),
    };
  };

  it('allows only one instance per slot and records completion', async () => {
    const redis = makeRedis();
    const first = new PromotionDataSyncService({} as any, {} as any, redis as any) as any;
    const second = new PromotionDataSyncService({} as any, {} as any, redis as any) as any;
    first.getScheduledSync = second.getScheduledSync = () => ({ slot: 'test-slot', statDate: '2026-11-05' });
    let finish!: () => void;
    first.sync = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    second.sync = jest.fn().mockResolvedValue([]);
    const running = first.runScheduledSync();
    while (!finish) await Promise.resolve();
    await second.runScheduledSync();
    expect(second.sync).not.toHaveBeenCalled();
    finish();
    await running;
    await second.runScheduledSync();
    expect(second.sync).not.toHaveBeenCalled();
    expect(first.sync).toHaveBeenCalledTimes(1);
  });

  it('does not start scheduled sync without Redis', async () => {
    const service = new PromotionDataSyncService({} as any, {} as any) as any;
    service.getScheduledSync = () => ({ slot: 'test-slot', statDate: '2026-11-05' });
    service.sync = jest.fn();
    await service.runScheduledSync();
    expect(service.sync).not.toHaveBeenCalled();
  });
});
