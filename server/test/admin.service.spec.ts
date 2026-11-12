import bcrypt from 'bcryptjs';
import { AdminRole, AdminStatus } from '@prisma/client';
import { AdminService } from '../src/modules/admin/admin.service';

describe('AdminService', () => {
  async function createService() {
    const passwordHash = await bcrypt.hash('secret', 4);
    const prisma = {
      adminUser: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'admin_1',
          username: 'admin',
          passwordHash,
          role: AdminRole.SUPER_ADMIN,
          permissionsJson: ['VIEW_FULL_PHONE'],
          status: AdminStatus.ACTIVE
        }),
        update: jest.fn().mockResolvedValue({})
      },
      appointment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'appt_1',
          appointmentNo: 'GH20260706000001',
          phoneEncrypted: 'encrypted-phone',
          phoneMasked: '138****8000'
        })
      },
      systemConfig: {
        findMany: jest.fn().mockResolvedValue([])
      }
    };
    const auth = { signAdmin: jest.fn().mockReturnValue('admin-jwt') };
    const crypto = { decryptPhone: jest.fn().mockReturnValue('13800138000') };
    const audit = { create: jest.fn().mockResolvedValue({}) };
    const notifications = {};
    const followupForwarder = {
      forwardAppointment: jest.fn().mockResolvedValue({ status: 'SUCCESS', statusText: '已转发' })
    };
    const configs = {
      updateMany: jest.fn().mockResolvedValue([{ key: 'landingPage' }]),
      deleteLandingPage: jest.fn().mockResolvedValue({
        id: 'landing_2',
        pageKey: 'page-two',
        name: '第二页',
        preservedAppointmentCount: 2,
        newDefaultPage: null
      })
    };
    const officialAccount = { publishCustomMenu: jest.fn().mockResolvedValue({ errcode: 0, errmsg: 'ok' }) };
    const config = {
      get: jest.fn((key: string) => key === 'MINI_APP_ID' ? 'wx99b598314f56c2f1' : undefined)
    };
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1)
    };
    return {
      service: new AdminService(
        prisma as any,
        auth as any,
        crypto as any,
        audit as any,
        notifications as any,
        followupForwarder as any,
        configs as any,
        officialAccount as any,
        config as any,
        redis as any
      ),
      prisma,
      auth,
      crypto,
      audit,
      followupForwarder,
      configs
    };
  }

  it('logs in admin with bcrypt password', async () => {
    const { service, auth } = await createService();
    const result = await service.login({ username: 'admin', password: 'secret' }, '127.0.0.1', 'jest');

    expect(auth.signAdmin).toHaveBeenCalled();
    expect(result.token).toBe('admin-jwt');
  });

  it('rejects reveal phone without permission', async () => {
    const { service, audit } = await createService();
    await expect(
      service.revealAppointmentPhone(
        'appt_1',
        { adminUserId: 'staff_1', username: 'staff', role: 'STAFF', permissions: [] },
        '127.0.0.1',
        'jest'
      )
    ).rejects.toThrow('无查看完整手机号权限');
    expect(audit.create).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'REVEAL_FULL_PHONE' }));
  });

  it('only exposes the legacy landing page key through the generic config endpoint', async () => {
    const { service, prisma } = await createService();
    await service.configs();
    expect(prisma.systemConfig.findMany).toHaveBeenCalledWith({
      where: { key: 'landingPage' },
      orderBy: { key: 'asc' }
    });
  });

  it('rejects sensitive keys on the generic config update endpoint', async () => {
    const { service, configs } = await createService();
    await expect(service.updateConfigs(
      [{ key: 'followupForward', valueJson: { authToken: 'should-not-be-written-here' } }],
      { adminUserId: 'admin_1', username: 'admin', role: 'SUPER_ADMIN', permissions: [] }
    )).rejects.toThrow('专用设置页面');
    expect(configs.updateMany).not.toHaveBeenCalled();
  });

  it('prevents delegated managers from granting permissions they do not own', async () => {
    const { service } = await createService();
    const delegated = { adminUserId: 'staff_1', username: 'staff', role: 'STAFF', permissions: ['SYSTEM_ROLES'] };
    expect(() => (service as any).assertCanGrantPermissions(delegated, ['SYSTEM_CONFIGS']))
      .toThrow('不能授予当前账号不具备的权限');
  });

  it('lets legacy aggregate permissions grant their compatible granular permissions', async () => {
    const { service } = await createService();
    const legacy = { adminUserId: 'staff_1', username: 'staff', role: 'STAFF', permissions: ['MANAGE_ADMINS'] };
    expect(() => (service as any).assertCanGrantPermissions(legacy, ['SYSTEM_MEMBERS', 'SYSTEM_ROLES']))
      .not.toThrow();
  });

  it('reveals phone with permission and writes audit log', async () => {
    const { service, audit, crypto } = await createService();
    const result = await service.revealAppointmentPhone(
      'appt_1',
      { adminUserId: 'manager_1', username: 'manager', role: 'MANAGER', permissions: ['VIEW_FULL_PHONE'] },
      '127.0.0.1',
      'jest'
    );

    expect(crypto.decryptPhone).toHaveBeenCalledWith('encrypted-phone');
    expect(result.phone).toBe('13800138000');
    expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'REVEAL_FULL_PHONE' }));
  });

  it('updates configs and writes audit log', async () => {
    const { service, configs, audit } = await createService();
    await service.updateConfigs(
      [{ key: 'landingPage', valueJson: { brandName: '测试品牌' } }],
      { adminUserId: 'admin_1', username: 'admin', role: 'SUPER_ADMIN', permissions: [] },
      '127.0.0.1',
      'jest'
    );

    expect(configs.updateMany).toHaveBeenCalled();
    expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE_SYSTEM_CONFIGS' }));
  });

  it('deletes a landing page and writes an audit log', async () => {
    const { service, configs, audit } = await createService();
    const result = await service.deleteLandingPage(
      'landing_2',
      { adminUserId: 'admin_1', username: 'admin', role: 'SUPER_ADMIN', permissions: [] },
      '127.0.0.1',
      'jest'
    );

    expect(configs.deleteLandingPage).toHaveBeenCalledWith('landing_2');
    expect(result.preservedAppointmentCount).toBe(2);
    expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE_LANDING_PAGE' }));
  });

  it('preserves simultaneous subscribe text and mini-program link settings', async () => {
    const { service } = await createService();

    const normalized = (service as any).normalizeOfficialAutoReply({
      enabled: true,
      subscribeReplyEnabled: true,
      subscribeReply: '欢迎关注',
      subscribeMiniProgramEnabled: true,
      subscribeMiniProgramType: 'LINK',
      subscribeMiniProgramAppId: 'wx99b598314f56c2f1',
      subscribeMiniProgramPagePath: 'pages/home/home?source=oa_subscribe',
      subscribeMiniProgramLinkText: '进入小程序',
      messageReplyEnabled: true,
      messageReply: '已收到',
      keywordReplyEnabled: true,
      keywordRules: []
    });

    expect(normalized).toEqual(expect.objectContaining({
      subscribeReplyEnabled: true,
      subscribeReply: '欢迎关注',
      subscribeMiniProgramEnabled: true,
      subscribeMiniProgramType: 'LINK',
      subscribeMiniProgramAppId: 'wx99b598314f56c2f1',
      subscribeMiniProgramPagePath: 'pages/home/home?source=oa_subscribe',
      subscribeMiniProgramLinkText: '进入小程序'
    }));
  });

  it('rejects a mini-program card without an internal JPG or PNG cover', async () => {
    const { service } = await createService();

    expect(() => (service as any).normalizeOfficialAutoReply({
      enabled: true,
      subscribeReplyEnabled: true,
      subscribeReply: '欢迎关注',
      subscribeMiniProgramEnabled: true,
      subscribeMiniProgramType: 'CARD',
      subscribeMiniProgramAppId: 'wx99b598314f56c2f1',
      subscribeMiniProgramPagePath: 'pages/home/home',
      subscribeMiniProgramCardTitle: '预约挂号',
      subscribeMiniProgramCoverUrl: 'https://outside.example.com/card.jpg',
      messageReplyEnabled: true,
      messageReply: '已收到',
      keywordReplyEnabled: true,
      keywordRules: []
    })).toThrow('小程序卡片封面必须选择本系统图片库中的 JPG 或 PNG 图片');
  });
});
