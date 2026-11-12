import { ConsultationService } from '../src/modules/consultation/consultation.service';

const member = { adminUserId: 'member-a', role: 'STAFF', permissions: ['CONSULTATION_VIEW'] } as any;

describe('Consultation callback counts', () => {
  const prisma = {
    consultationForm: { findMany: jest.fn(), count: jest.fn() },
    auditLog: { findMany: jest.fn() }
  } as any;
  const dataScopes = { ownershipWhere: jest.fn() } as any;
  const service = new ConsultationService(prisma, {} as any, {} as any, dataScopes, {} as any);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-07T04:00:00.000Z'));
    jest.clearAllMocks();
    dataScopes.ownershipWhere.mockResolvedValue({ ownerAdminId: 'member-a' });
    prisma.consultationForm.findMany.mockResolvedValue([]);
    prisma.consultationForm.count.mockResolvedValue(1);
  });

  afterEach(() => jest.useRealTimers());

  it('counts only follow-ups whose original callback time was today', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      { resourceId: 'today-form', beforeJson: { nextFollowUpAt: '2026-11-07T02:00:00.000Z' } },
      { resourceId: 'today-form', beforeJson: { nextFollowUpAt: '2026-11-07T02:00:00.000Z' } },
      { resourceId: 'other-day-form', beforeJson: { nextFollowUpAt: '2026-11-06T02:00:00.000Z' } },
      { resourceId: 'unscheduled-form', beforeJson: { nextFollowUpAt: null } }
    ]);

    const result = await service.todayCallbacks(member);

    expect(prisma.consultationForm.count).toHaveBeenCalledWith({
      where: { AND: [{ ownerAdminId: 'member-a' }, { id: { in: ['today-form'] } }] }
    });
    expect(result.counts.completed).toBe(1);
  });

  it('does not issue a form count when no completed follow-up came from today callback list', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      { resourceId: 'other-day-form', beforeJson: { nextFollowUpAt: '2026-11-06T02:00:00.000Z' } }
    ]);

    const result = await service.todayCallbacks(member);

    expect(prisma.consultationForm.count).not.toHaveBeenCalled();
    expect(result.counts.completed).toBe(0);
  });
});
