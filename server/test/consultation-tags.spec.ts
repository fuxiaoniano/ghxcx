import { ConsultationStatusCategory } from '@prisma/client';
import { ConsultationService } from '../src/modules/consultation/consultation.service';

describe('Consultation tag updates', () => {
  function setup() {
    const before = {
      id: 'form-1',
      invalidReason: null,
      status: { id: 'status-invalid', category: ConsultationStatusCategory.INVALID },
    };
    const updated = { ...before, tags: [{ id: 'tag-1' }] };
    const prisma = {
      consultationFormTag: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      consultationForm: { update: jest.fn().mockResolvedValue(updated) },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
    } as any;
    const audit = { create: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ConsultationService(prisma, {} as any, audit, {} as any, {} as any);
    jest.spyOn(service as any, 'requireAccessible').mockResolvedValue(before);
    jest.spyOn(service as any, 'activeTags').mockResolvedValue([{ id: 'tag-1' }]);
    jest.spyOn(service, 'detail').mockResolvedValue(updated as any);
    return { service, prisma };
  }

  it('allows tags to be added or removed without requiring a legacy invalid reason', async () => {
    const { service, prisma } = setup();

    await expect(service.update('form-1', { tagIds: ['tag-1'] }, {
      adminUserId: 'admin-1', role: 'STAFF', permissions: ['CONSULTATION_EDIT'],
    } as any)).resolves.toEqual(expect.objectContaining({ id: 'form-1' }));

    expect(prisma.consultationFormTag.deleteMany).toHaveBeenCalledWith({ where: { formId: 'form-1' } });
    expect(prisma.consultationFormTag.createMany).toHaveBeenCalledWith({ data: [{ formId: 'form-1', tagId: 'tag-1' }] });
  });

  it('still requires a reason when the invalid status is explicitly selected', async () => {
    const { service, prisma } = setup();
    jest.spyOn(service as any, 'activeStatus').mockResolvedValue({
      id: 'status-invalid', category: ConsultationStatusCategory.INVALID, code: 'INVALID',
    });

    await expect(service.update('form-1', { statusId: 'status-invalid', invalidReason: null }, {
      adminUserId: 'admin-1', role: 'STAFF', permissions: ['CONSULTATION_EDIT'],
    } as any)).rejects.toMatchObject({ status: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
