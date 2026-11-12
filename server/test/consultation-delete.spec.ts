import { ConsultationService } from '../src/modules/consultation/consultation.service';

describe('Consultation hard delete', () => {
  it('checks data scope and deletes form plus associated audit snapshots transactionally', async () => {
    const calls: string[] = [];
    const prisma = {
      consultationForm: { findUnique: jest.fn().mockResolvedValue({ id: 'form-1', ownerAdminId: 'member-a', createdByAdminId: 'member-a', status: { category: 'IN_PROGRESS' } }), delete: jest.fn(async () => { calls.push('form'); }) },
      auditLog: { deleteMany: jest.fn(async () => { calls.push('old-audit'); }), create: jest.fn(async () => { calls.push('deletion-audit'); }) },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
    } as any;
    const dataScopes = { assertOwned: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ConsultationService(prisma, {} as any, {} as any, dataScopes, {} as any);
    const user = { adminUserId: 'member-a', role: 'STAFF', permissions: ['CONSULTATION_DELETE'] } as any;
    await service.deleteForm('form-1', user);
    expect(dataScopes.assertOwned).toHaveBeenCalled();
    expect(calls).toEqual(['old-audit', 'form', 'deletion-audit']);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'DELETE_CONSULTATION', afterJson: { deleted: true } }) });
  });

  it('does not delete a form outside the member data scope', async () => {
    const prisma = { consultationForm: { findUnique: jest.fn().mockResolvedValue({ id: 'other', ownerAdminId: 'other', createdByAdminId: 'other' }) }, $transaction: jest.fn() } as any;
    const dataScopes = { assertOwned: jest.fn().mockRejectedValue(new Error('forbidden')) } as any;
    const service = new ConsultationService(prisma, {} as any, {} as any, dataScopes, {} as any);
    await expect(service.deleteForm('other', { adminUserId: 'member-a', role: 'STAFF' } as any)).rejects.toThrow('forbidden');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
