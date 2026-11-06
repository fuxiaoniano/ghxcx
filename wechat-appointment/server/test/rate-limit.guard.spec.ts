import { RateLimitGuard } from '../src/common/guards/rate-limit.guard';

describe('rate limiter', () => {
  it('increments and sets expiry atomically and blocks requests above the limit', async () => {
    const redis = { eval: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2) };
    const config = { get: (key: string) => key === 'RATE_LIMIT_MAX' ? 1 : 60 };
    const guard = new RateLimitGuard(redis as any, config as any);
    const context = { switchToHttp: () => ({ getRequest: () => ({ ip: '127.0.0.1', method: 'GET', path: '/test' }) }) } as any;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 429 });
    expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining("redis.call('expire'"), 1, 'rate:127.0.0.1:GET:/test', '60');
  });
});
