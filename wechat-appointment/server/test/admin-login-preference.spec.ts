import { AdminService } from '../src/modules/admin/admin.service';

describe('管理后台默认登录方式', () => {
  const systemConfig = { findUnique: jest.fn(), upsert: jest.fn().mockResolvedValue({}) };
  const bindingStatus = jest.fn();
  const audit = { create: jest.fn().mockResolvedValue({}) };
  const service = Object.create(AdminService.prototype) as AdminService;
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(service, { prisma: { systemConfig }, officialAccount: { bindingStatus }, audit });
  });

  it('没有配置时默认账号密码登录', async () => {
    systemConfig.findUnique.mockResolvedValue(null);
    bindingStatus.mockResolvedValue({ enabled: true, appId: 'app', hasAppSecret: true, hasToken: true });
    await expect(service.adminLoginPreference()).resolves.toEqual({ defaultWechatLogin: false, bindingReady: true });
  });

  it('公众号未完成绑定时即使旧配置开启也强制账号密码登录', async () => {
    systemConfig.findUnique.mockResolvedValue({ valueJson: { defaultWechatLogin: true } });
    bindingStatus.mockResolvedValue({ enabled: false, appId: 'app', hasAppSecret: true, hasToken: true });
    await expect(service.adminLoginPreference()).resolves.toEqual({ defaultWechatLogin: false, bindingReady: false });
    await expect(service.updateAdminLoginPreference(true, { adminUserId: 'admin' } as never)).rejects.toThrow('请先完成并启用公众号绑定');
    expect(systemConfig.upsert).not.toHaveBeenCalled();
  });

  it('公众号绑定可用时可开启默认扫码，且保留审计', async () => {
    systemConfig.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ valueJson: { defaultWechatLogin: true } });
    bindingStatus.mockResolvedValue({ enabled: true, appId: 'app', hasAppSecret: true, hasToken: true });
    await expect(service.updateAdminLoginPreference(true, { adminUserId: 'admin' } as never)).resolves.toEqual({ defaultWechatLogin: true, bindingReady: true });
    expect(systemConfig.upsert).toHaveBeenCalled();
    expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE_ADMIN_LOGIN_PREFERENCE' }));
  });
});
