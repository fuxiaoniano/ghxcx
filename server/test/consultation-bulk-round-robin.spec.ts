import { ConsultationService } from '../src/modules/consultation/consultation.service';

describe('Consultation bulk round-robin assignment', () => {
  it('cycles eligible forms through selected owners and persists each notification job in the same transaction', async () => {
    const updates: Array<{ id: string; ownerId: string }> = [];
    const jobs: Array<{ formId: string; ownerAdminId: string }> = [];
    const prisma = {
      consultationForm: { update: jest.fn(async ({ where, data }) => { updates.push({ id: where.id, ownerId: data.ownerAdminId }); }) },
      consultationAssignmentNoticeJob: { create: jest.fn(async ({ data }) => { jobs.push(data); }) },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
    } as any;
    const service = new ConsultationService(prisma, {} as any, {} as any, {} as any, {} as any);
    jest.spyOn(service as any, 'bulkAssignmentOwners').mockResolvedValue([{ id: 'a', nickname: '甲' }, { id: 'b', nickname: '乙' }]);
    jest.spyOn(service as any, 'assignmentCandidates').mockResolvedValue({
      uniqueIds: ['1', 'missing', '2', '3'],
      allowed: [
        { id: '1', ownerAdminId: 'old', updatedAt: new Date('2026-11-06T00:00:01Z') },
        { id: '2', ownerAdminId: 'old', updatedAt: new Date('2026-11-06T00:00:02Z') },
        { id: '3', ownerAdminId: 'old', updatedAt: new Date('2026-11-06T00:00:03Z') },
      ],
      failures: [{ id: 'missing', reason: '表单不存在' }],
    });
    const result = await service.bulkAssign({ ids: ['1', 'missing', '2', '3'], ownerAdminIds: ['a', 'b'] }, { adminUserId: 'operator' } as any);
    expect(updates).toEqual([{ id: '1', ownerId: 'a' }, { id: '2', ownerId: 'b' }, { id: '3', ownerId: 'a' }]);
    expect(jobs.map(({ formId, ownerAdminId }) => ({ formId, ownerAdminId }))).toEqual([
      { formId: '1', ownerAdminId: 'a' }, { formId: '2', ownerAdminId: 'b' }, { formId: '3', ownerAdminId: 'a' }
    ]);
    expect(result).toMatchObject({ success: 3, failed: 1, distribution: [{ id: 'a', count: 2 }, { id: 'b', count: 1 }] });
  });
});
