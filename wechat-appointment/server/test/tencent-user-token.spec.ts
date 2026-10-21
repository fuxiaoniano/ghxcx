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
});
