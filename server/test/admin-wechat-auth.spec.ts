import { AdminInviteStatus, AdminRole, AdminStatus } from '@prisma/client';
import { AdminService } from '../src/modules/admin/admin.service';

describe('AdminService WeChat member flow', () => {
  function createService() {
    const redisValues = new Map<string, string>();
    let savedInvite: any;
    const createdAdmin = {
      id: 'staff_1',
      username: 'wx_generated',
      nickname: '前台小周',
      passwordHash: null,
      role: AdminRole.STAFF,
      permissionsJson: ['VIEW_FULL_PHONE', 'MANAGE_APPOINTMENTS'],
      status: AdminStatus.ACTIVE,
      oaOpenId: 'oa_staff',
      unionId: 'union_staff',
      subscribedOfficialAccount: true,
      notifyEnabled: true,
      wechatBoundAt: new Date(),
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const transactionAdminCreate = jest.fn().mockResolvedValue(createdAdmin);
    const unboundAdmin = {
      ...createdAdmin,
      id: 'legacy_staff_1',
      username: 'legacy-staff',
      nickname: '周大叔',
      oaOpenId: null,
      unionId: null,
      subscribedOfficialAccount: false,
      wechatBoundAt: null
    };
    const transactionAdminUpdate = jest.fn().mockResolvedValue({
      ...unboundAdmin,
      oaOpenId: 'oa_staff',
      unionId: 'union_staff',
      subscribedOfficialAccount: true,
      wechatBoundAt: new Date()
    });
    const transactionInviteUpdate = jest.fn().mockResolvedValue({});
    const prisma = {
      adminUser: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(where.id === unboundAdmin.id ? unboundAdmin : null)
        )
      },
      adminWechatInvite: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(savedInvite)),
        create: jest.fn().mockImplementation(({ data }: any) => {
          savedInvite = {
            id: 'invite_1',
            ...data,
            status: AdminInviteStatus.PENDING,
            createdAt: new Date()
          };
          return Promise.resolve(savedInvite);
        }),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn()
      },
      $transaction: jest.fn().mockImplementation((callback: any) => callback({
        adminWechatInvite: {
          findUnique: jest.fn().mockImplementation(() => Promise.resolve(savedInvite)),
          update: transactionInviteUpdate
        },
        adminUser: {
          findUnique: jest.fn().mockImplementation(({ where }: any) =>
            Promise.resolve(where.id === unboundAdmin.id ? unboundAdmin : null)
          ),
          create: transactionAdminCreate,
          update: transactionAdminUpdate
        }
      }))
    };
    const redis = {
      get: jest.fn((key: string) => Promise.resolve(redisValues.get(key) || null)),
      set: jest.fn((key: string, value: string) => {
        redisValues.set(key, value);
        return Promise.resolve('OK');
      }),
      del: jest.fn((key: string) => {
        redisValues.delete(key);
        return Promise.resolve(1);
      })
    };
    const auth = { signAdmin: jest.fn().mockReturnValue('admin-token') };
    const audit = { create: jest.fn().mockResolvedValue({}) };
    const officialAccount = {
      resolveOauthIdentity: jest.fn().mockResolvedValue({
        oaOpenId: 'oa_staff', unionId: 'union_staff', subscribed: true
      }),
      buildAdminOauthUrl: jest.fn().mockReturnValue('https://wechat.example/oauth')
    };
    const config = { get: jest.fn().mockReturnValue('https://zbsfxn.cqzbskq.com') };
    const service = new AdminService(
      prisma as any,
      auth as any,
      {} as any,
      audit as any,
      {} as any,
      {} as any,
      {} as any,
      officialAccount as any,
      config as any,
      redis as any
    );
    return { service, prisma, transactionAdminCreate, transactionAdminUpdate, transactionInviteUpdate };
  }

  const superAdmin = {
    adminUserId: 'admin_1',
    username: 'admin',
    nickname: '傅小念',
    role: AdminRole.SUPER_ADMIN,
    permissions: []
  };

  it('creates the member only after the invited WeChat completes binding', async () => {
    const { service, transactionAdminCreate, transactionInviteUpdate } = createService();
    const invite = await service.createAdminWechatInvitation(
      {
        nickname: '前台小周',
        role: AdminRole.STAFF,
        permissions: ['VIEW_FULL_PHONE', 'MANAGE_APPOINTMENTS'],
        notifyEnabled: true
      },
      superAdmin
    );

    expect(transactionAdminCreate).not.toHaveBeenCalled();
    const token = new URL(invite.bindUrl).searchParams.get('token') || '';
    const member = await service.completeWechatInvite('wechat-code', token);

    expect(transactionAdminCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nickname: '前台小周', oaOpenId: 'oa_staff', passwordHash: null })
    }));
    expect(transactionInviteUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: AdminInviteStatus.BOUND, adminUserId: 'staff_1' })
    }));
    expect(member.nickname).toBe('前台小周');
  });

  it('rejects QR login when the WeChat account is not bound to an admin member', async () => {
    const { service } = createService();
    const session = await service.createWechatLoginSession();

    const confirmation = await service.completeWechatLogin('wechat-code', session.sessionId);
    const result = await service.pollWechatLoginSession(session.sessionId);

    expect(confirmation.success).toBe(false);
    expect(result).toEqual(expect.objectContaining({ status: 'ERROR' }));
  });

  it('reissues a binding QR for an existing unbound member without creating a duplicate account', async () => {
    const { service, transactionAdminCreate, transactionAdminUpdate } = createService();

    const invite = await service.createExistingAdminWechatInvitation('legacy_staff_1', superAdmin);
    const token = new URL(invite.bindUrl).searchParams.get('token') || '';
    const member = await service.completeWechatInvite('wechat-code', token);

    expect(transactionAdminCreate).not.toHaveBeenCalled();
    expect(transactionAdminUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'legacy_staff_1' },
      data: expect.objectContaining({ oaOpenId: 'oa_staff', unionId: 'union_staff' })
    }));
    expect(member.id).toBe('legacy_staff_1');
    expect(member.wechatBound).toBe(true);
  });
});
