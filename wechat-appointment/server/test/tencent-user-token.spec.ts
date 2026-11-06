import { OperationsService } from '../src/modules/operations/operations.service';
import { AdminCurrentUser } from '../src/common/decorators/current-user.decorator';

describe('Logged-in Tencent User Token settings', () => {
  const user: AdminCurrentUser = { adminUserId: 'employee-a', username: 'a', role: 'STAFF', permissions: ['PROMOTION_ACCOUNTS'] };
  function setup() {
    let row: { tokenCipher: string; expiresAt: Date | null } | null = null;
    const prisma = { tencentUserToken: {
      findUnique: jest.fn(async () => row),
      upsert: jest.fn(async ({ create }) => { row = create; return row; }),
      deleteMany: jest.fn(async () => { row = null; return { count: 1 }; }),
    } };
    const audit = { create: jest.fn().mockResolvedValue({}) };
    const crypto = { encryptText: jest.fn((token: string) => `encrypted:${token}`) };
    return { prisma, audit, crypto, service: new OperationsService(prisma as never, audit as never, crypto as never, {} as never) };
  }

  it('stores the token under the authenticated user and exposes only status to responses and audit logs', async () => {
    const { service, prisma, audit, crypto } = setup();
    const result = await service.saveMyTencentUserToken({ userToken: ' real-name-token ' }, user);
    expect(prisma.tencentUserToken.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { adminUserId: 'employee-a' },
      create: expect.objectContaining({ adminUserId: 'employee-a', tokenCipher: 'encrypted:real-name-token' }),
    }));
    expect(crypto.encryptText).toHaveBeenCalledWith('real-name-token');
    expect(result.hasUserToken).toBe(true);
    expect(Object.keys(result).sort()).toEqual(['hasUserToken', 'userTokenExpiresAt']);
    expect(JSON.stringify(audit.create.mock.calls)).not.toContain('real-name-token');
    expect(prisma.tencentUserToken.findUnique).toHaveBeenCalledWith({ where: { adminUserId: 'employee-a' } });
  });

  it('clears only the authenticated user token', async () => {
    const { service, prisma } = setup();
    const result = await service.saveMyTencentUserToken({ clearUserToken: true }, user);
    expect(prisma.tencentUserToken.deleteMany).toHaveBeenCalledWith({ where: { adminUserId: 'employee-a' } });
    expect(result.hasUserToken).toBe(false);
  });

  it('rejects expired and conflicting updates before persisting a token', async () => {
    const { service, prisma } = setup();
    await expect(service.saveMyTencentUserToken({ userToken: 'token', userTokenExpiresAt: new Date(Date.now() - 1_000).toISOString() }, user)).rejects.toThrow('已过期');
    await expect(service.saveMyTencentUserToken({ userToken: 'token', clearUserToken: true }, user)).rejects.toThrow('不能同时');
    expect(prisma.tencentUserToken.upsert).not.toHaveBeenCalled();
  });

  it('keeps Tencent callback tokens on the server and consumes one-time state', async () => {
    const { prisma, audit, crypto } = setup();
    (prisma as any).adminUser = { findFirst: jest.fn().mockResolvedValue({ id: 'employee-a' }) };
    const redis = {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue(JSON.stringify({ adminUserId: 'employee-a' })),
    };
    const config = { get: jest.fn((key: string) => key === 'SERVER_BASE_URL' ? 'https://api.example.com' : 'https://admin.example.com') };
    const service = new OperationsService(prisma as never, audit as never, crypto as never, {} as never, undefined, undefined, redis as never, config as never);
    const authorization = await service.createTencentUserTokenAuthorization(user);
    expect(authorization.authorizationUrl).toContain(encodeURIComponent('https://api.example.com/api/admin/operations/tencent-user-token-auth/callback'));
    expect(authorization.authorizationUrl).not.toContain('user_token=');
    expect(redis.set).toHaveBeenCalledWith(expect.stringMatching(/^tencent:user-token-auth:/), expect.stringContaining('employee-a'), 'EX', 600, 'NX');

    const result = await service.completeTencentUserTokenAuthorization({
      state: 'a'.repeat(64), userStatus: '2', userToken: 'server-only-token', expireTime: String(Math.floor(Date.now() / 1000) + 3600),
    });
    expect(result.redirectUrl).toBe('https://admin.example.com/promotion/accounts?user_token_status=success');
    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(crypto.encryptText).toHaveBeenCalledWith('server-only-token');
    expect(JSON.stringify(audit.create.mock.calls)).not.toContain('server-only-token');
    expect(result.redirectUrl).not.toContain('server-only-token');
  });
});
