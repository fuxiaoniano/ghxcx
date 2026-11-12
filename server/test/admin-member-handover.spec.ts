import { AdminRole, AdminStatus } from '@prisma/client';
import { AdminService } from '../src/modules/admin/admin.service';

describe('AdminService member deletion handover', () => {
  const operator = { adminUserId: 'super', username: 'super', role: 'SUPER_ADMIN', permissions: [] } as any;
  const target = {
    id: 'old-member', username: 'old', nickname: 'old', role: AdminRole.STAFF,
    status: AdminStatus.ACTIVE, deletedAt: null, permissionsJson: [], customRole: null,
  };
  const successor = {
    id: 'new-member', username: 'new', nickname: 'new', role: AdminRole.STAFF,
    status: AdminStatus.ACTIVE, deletedAt: null,
    permissionsJson: ['CONSULTATION_VIEW', 'CONSULTATION_FOLLOW_UP'], customRole: null,
  };

  function setup(failDuringMigration = false) {
    const tx = {
      consultationForm: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      appointment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      promotionAccount: { updateMany: failDuringMigration ? jest.fn().mockRejectedValue(new Error('migration failed')) : jest.fn().mockResolvedValue({ count: 1 }) },
      tencentAdLead: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      adminTeam: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      adminWechatInvite: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      adminUser: { update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      adminUser: {
        findUnique: jest.fn().mockResolvedValue(target),
        findFirst: jest.fn().mockResolvedValue(successor),
        count: jest.fn().mockResolvedValue(2),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = Object.create(AdminService.prototype) as any;
    service.prisma = prisma;
    service.adminUserHandoverSummary = jest.fn().mockResolvedValue({
      consultations: 2, todayCallbacks: 1, overdueCallbacks: 1,
      appointments: 1, promotionAccounts: 1, tencentLeads: 1, total: 5,
    });
    return { service, prisma, tx };
  }

  it('moves every current ownership relation, disables the account and audits inside one transaction', async () => {
    const { service, prisma, tx } = setup();

    await expect(service.deleteAdminUser(target.id, successor.id, operator, '127.0.0.1', 'jest'))
      .resolves.toMatchObject({ deleted: true, successorAdminId: successor.id });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.consultationForm.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerAdminId: successor.id }) }));
    expect(tx.appointment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { assignedToAdminId: successor.id } }));
    expect(tx.promotionAccount.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { ownerAdminId: successor.id } }));
    expect(tx.tencentAdLead.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { assignedToAdminId: successor.id } }));
    expect(tx.adminUser.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: AdminStatus.DISABLED, deletedAt: expect.any(Date) }) }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'DELETE_ADMIN_USER_WITH_HANDOVER' }) }));
  });

  it('does not reach account deletion when any ownership migration fails', async () => {
    const { service, tx } = setup(true);

    await expect(service.deleteAdminUser(target.id, successor.id, operator)).rejects.toThrow('migration failed');
    expect(tx.adminUser.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects deletion when no successor is supplied', async () => {
    const { service, prisma } = setup();

    await expect(service.deleteAdminUser(target.id, '', operator)).rejects.toThrow('必须选择新归属成员');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
