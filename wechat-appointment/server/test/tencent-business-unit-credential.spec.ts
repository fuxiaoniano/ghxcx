import axios from 'axios';
import { OperationsService } from '../src/modules/operations/operations.service';
import { PromotionDataSyncService } from '../src/modules/operations/promotion-data-sync.service';

describe('腾讯业务单元共用凭证', () => {
  afterEach(() => jest.restoreAllMocks());

  it('逐户只读校验，未获授权的账户不会加入共用范围', async () => {
    const request = jest.spyOn(axios, 'request')
      .mockResolvedValueOnce({ data: { code: 0, data: { list: [] } }, headers: {} } as any)
      .mockResolvedValueOnce({ data: { code: 403001, message: 'no permission' }, headers: {} } as any);
    const service = new PromotionDataSyncService({} as never, {} as never);
    const result = await service.validateTencentBusinessUnitAccess('access-secret', [
      { accountNo: '10001', name: '腾讯01' }, { accountNo: '10002', name: '腾讯02' },
    ]);

    expect(result.covered).toEqual([{ accountNo: '10001', name: '腾讯01' }]);
    expect(result.rejected).toEqual([{ accountNo: '10002', name: '腾讯02', reason: '腾讯接口未确认该账户可访问' }]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][0]).toMatchObject({ method: 'GET', url: expect.stringContaining('/adgroups/get') });
  });

  it('已校验账户优先使用同一业务单元凭证，其余账户保留独立凭证', async () => {
    const service = new PromotionDataSyncService({} as never, {} as never) as any;
    const credential = { id: 'cred', accessTokenCipher: 'account-access', clientId: 'account-app', clientSecretCipher: 'account-secret', refreshTokenCipher: 'account-refresh' };
    const config = { id: 'shared', accessTokenCipher: 'shared-access', extraConfig: { clientId: 'shared-app', clientSecretCipher: 'shared-secret', refreshTokenCipher: 'shared-refresh', sharedAccountNos: ['10001'] } };
    expect(service.resolveTencentAuth(credential, config, '10001')).toMatchObject({ tokenCipher: 'shared-access', target: { configId: 'shared' } });
    expect(service.resolveTencentAuth(credential, config, '10002')).toMatchObject({ tokenCipher: 'account-access', target: { credentialId: 'cred' } });
    expect(service.resolveTencentAuth(null, config, '10002').tokenCipher).toBeNull();
  });

  it('并发请求只刷新一次共用 Refresh Token', async () => {
    const prisma = { promotionDataSyncConfig: {
      findUnique: jest.fn().mockResolvedValue({ id: 'shared', accessTokenCipher: 'old-access', extraConfig: { refreshTokenCipher: 'old-refresh' } }),
      update: jest.fn().mockResolvedValue({}),
    } };
    const crypto = { decryptText: jest.fn((value: string) => value), encryptText: jest.fn((value: string) => `encrypted:${value}`) };
    const refresh = jest.spyOn(axios, 'get').mockResolvedValue({ data: { code: 0, data: { access_token: 'new-access', refresh_token: 'new-refresh' } } } as any);
    const service = new PromotionDataSyncService(prisma as never, crypto as never) as any;
    const extra = { clientId: 'app', clientSecretCipher: 'secret', refreshTokenCipher: 'old-refresh', sharedAccountNos: ['10001', '10002'] };
    const tokens = await Promise.all([service.refreshTencentToken(extra, { configId: 'shared' }), service.refreshTencentToken(extra, { configId: 'shared' })]);
    expect(tokens).toEqual(['new-access', 'new-access']);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(prisma.promotionDataSyncConfig.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ extraConfig: expect.objectContaining({ sharedAccountNos: ['10001', '10002'], refreshTokenCipher: 'encrypted:new-refresh' }) }),
    }));
  });

  it('普通成员不能读取或更改业务单元授权', async () => {
    const prisma = { promotionDataSyncConfig: { findUnique: jest.fn(), upsert: jest.fn() } };
    const service = new OperationsService(prisma as never, {} as never, {} as never, {} as never);
    const staff = { adminUserId: 'staff', role: 'STAFF' } as any;
    await expect(service.tencentBusinessUnitCredential(staff)).rejects.toMatchObject({ status: 403 });
    await expect(service.updateTencentBusinessUnitCredential({ clientId: 'a', clientSecret: 'b', accessToken: 'c', refreshToken: 'd' }, staff)).rejects.toMatchObject({ status: 403 });
    expect(prisma.promotionDataSyncConfig.upsert).not.toHaveBeenCalled();
  });

  it('先校验后加密保存，审计不记录令牌', async () => {
    const prisma = {
      promotionAccount: { findMany: jest.fn().mockResolvedValue([{ accountNo: '10001', name: '腾讯01' }, { accountNo: '10002', name: '腾讯02' }]) },
      promotionDataSyncConfig: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({ id: 'config', updatedAt: new Date() }) },
    };
    const audit = { create: jest.fn().mockResolvedValue({}) };
    const crypto = { encryptText: jest.fn((value: string) => `encrypted:${value}`) };
    const sync = { validateTencentBusinessUnitAccess: jest.fn().mockResolvedValue({ covered: [{ accountNo: '10001', name: '腾讯01' }], rejected: [{ accountNo: '10002', name: '腾讯02', reason: '无权限' }] }) };
    const service = new OperationsService(prisma as never, audit as never, crypto as never, sync as never);
    const result = await service.updateTencentBusinessUnitCredential({ clientId: 'app', clientSecret: 'secret', accessToken: 'access', refreshToken: 'refresh' }, { adminUserId: 'admin', role: 'SUPER_ADMIN' } as any);
    expect(result.covered).toHaveLength(1);
    expect(prisma.promotionDataSyncConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ accessTokenCipher: 'encrypted:access', extraConfig: expect.objectContaining({ sharedAccountNos: ['10001'], refreshTokenCipher: 'encrypted:refresh' }) }),
    }));
    expect(JSON.stringify(audit.create.mock.calls)).not.toContain('secret');
    expect(JSON.stringify(audit.create.mock.calls)).not.toContain('refresh');
  });
});
