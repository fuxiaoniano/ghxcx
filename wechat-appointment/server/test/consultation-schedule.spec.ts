import { ConsultationService } from '../src/modules/consultation/consultation.service';

const staff = { adminUserId: 'member-a', role: 'STAFF', permissions: ['CONSULTATION_SCHEDULE_VIEW'] } as any;

describe('Consultation schedule', () => {
  const prisma = {
    adminUser: { findFirst: jest.fn() },
    consultationSchedule: { findUnique: jest.fn(), deleteMany: jest.fn(), upsert: jest.fn(), findMany: jest.fn() },
  } as any;
  const audit = { create: jest.fn() } as any;
  const service = new ConsultationService(prisma, {} as any, audit, {} as any, {} as any);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.adminUser.findFirst.mockResolvedValue({ id: 'member-a' });
    prisma.consultationSchedule.findUnique.mockResolvedValue(null);
  });

  it('lets a member mark their own rest day and keeps other members protected', async () => {
    prisma.consultationSchedule.upsert.mockResolvedValue({});
    await service.saveSchedule({ adminUserId: 'member-a', date: '2026-11-04', shift: 'REST' }, staff);
    expect(prisma.consultationSchedule.upsert).toHaveBeenCalled();
    await expect(service.saveSchedule({ adminUserId: 'member-b', date: '2026-11-04', shift: 'REST' }, staff)).rejects.toThrow();
  });

  it('removes a rest override when a day returns to the default morning shift', async () => {
    prisma.consultationSchedule.deleteMany.mockResolvedValue({ count: 1 });
    await service.saveSchedule({ adminUserId: 'member-a', date: '2026-11-04', shift: 'MORNING' }, staff);
    expect(prisma.consultationSchedule.deleteMany).toHaveBeenCalledWith({ where: { adminUserId: 'member-a', workDate: new Date('2026-11-04T00:00:00.000Z') } });
  });

  it('rejects invalid calendar dates', async () => {
    await expect(service.saveSchedule({ adminUserId: 'member-a', date: '2026-02-30', shift: 'REST' }, staff)).rejects.toThrow();
  });
});
