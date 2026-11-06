import { DashboardWorkspaceService } from '../src/modules/admin/dashboard-workspace.service';

describe('dashboard workspace ownership', () => {
  const prisma = {
    adminDashboardPreference: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
    adminDashboardTodo: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({ count: 0 }), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) }
  };
  const service = new DashboardWorkspaceService(prisma as never);

  it('defaults to callbacks and consultation forms', async () => {
    await expect(service.preferences('admin-a')).resolves.toEqual({ modules: ['PAGE:/consultations/callbacks', 'PAGE:/consultations'] });
  });

  it('scopes todo reads to the signed-in account', async () => {
    await service.todos('admin-a');
    expect(prisma.adminDashboardTodo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { adminUserId: 'admin-a' } }));
  });

  it('does not update another account’s todo', async () => {
    await expect(service.updateTodo('admin-a', 'todo-b', { completed: true })).rejects.toThrow('待办不存在');
    expect(prisma.adminDashboardTodo.updateMany).toHaveBeenCalledWith({ where: { id: 'todo-b', adminUserId: 'admin-a' }, data: { completed: true } });
  });

  it('saves menu modules alongside existing dashboard modules', async () => {
    const result = await service.savePreferences('admin-a', ['METRICS', 'PAGE:/consultations/report']);
    expect(result.modules).toEqual(['METRICS', 'PAGE:/consultations/report']);
    expect(prisma.adminDashboardPreference.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { adminUserId: 'admin-a' } }));
    await expect(service.savePreferences('admin-a', ['PAGE:https://outside.example'])).rejects.toThrow('仪表盘模块无效');
  });
});
