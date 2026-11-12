import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { validate } from 'class-validator';
import { AdminService } from '../src/modules/admin/admin.service';
import { ChangeOwnPasswordDto } from '../src/modules/admin/dto';

describe('current admin password change', () => {
  it('validates new password length', async () => {
    const dto = Object.assign(new ChangeOwnPasswordDto(), { currentPassword: 'old-password', newPassword: 'short' });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('changes only the authenticated user after current password verification and audits without secrets', async () => {
    const oldHash = await bcrypt.hash('old-password', 4);
    const prisma = {
      adminUser: {
        findUnique: jest.fn().mockResolvedValue({ id: 'member-1', status: 'ACTIVE', passwordHash: oldHash }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const redis = { get: jest.fn().mockResolvedValue(null), del: jest.fn() };
    const audit = { create: jest.fn() };
    const service = new AdminService(prisma as any, {} as any, {} as any, audit as any, {} as any, {} as any, {} as any, {} as any, {} as any, redis as any);
    await expect(service.changeOwnPassword({ currentPassword: 'old-password', newPassword: 'new-password-123' }, { adminUserId: 'member-1' } as any)).resolves.toEqual({ changed: true });
    expect(prisma.adminUser.findUnique).toHaveBeenCalledWith({ where: { id: 'member-1' }, select: { id: true, passwordHash: true, status: true } });
    const update = prisma.adminUser.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'member-1', passwordHash: oldHash });
    expect(await bcrypt.compare('new-password-123', update.data.passwordHash)).toBe(true);
    expect(JSON.stringify(audit.create.mock.calls)).not.toContain('new-password-123');
    expect(JSON.stringify(audit.create.mock.calls)).not.toContain('old-password');
  });

  it('rejects an incorrect current password without changing the hash', async () => {
    const prisma = { adminUser: { findUnique: jest.fn().mockResolvedValue({ id: 'member-1', status: 'ACTIVE', passwordHash: await bcrypt.hash('correct-password', 4) }), updateMany: jest.fn() } };
    const redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), incr: jest.fn().mockResolvedValue(1), expire: jest.fn() };
    const service = new AdminService(prisma as any, {} as any, {} as any, { create: jest.fn() } as any, {} as any, {} as any, {} as any, {} as any, {} as any, redis as any);
    await expect(service.changeOwnPassword({ currentPassword: 'wrong-password', newPassword: 'new-password-123' }, { adminUserId: 'member-1' } as any)).rejects.toThrow('当前密码不正确');
    expect(prisma.adminUser.updateMany).not.toHaveBeenCalled();
  });
});
