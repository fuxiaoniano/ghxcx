import { ConsultationStatusCategory, Prisma } from '@prisma/client';
import { ConsultationReportService } from '../src/modules/consultation/consultation-report.service';

describe('consultation reports', () => {
  const user = { adminUserId: 'member-a', username: 'member-a', role: 'STAFF', permissions: ['CONSULTATION_VIEW'], dataScope: 'SELF' as const };
  const scope = { OR: [{ ownerAdminId: { in: ['member-a'] } }, { createdByAdminId: { in: ['member-a'] } }] };
  const rows = [
    { id: '1', recordedAt: new Date('2026-10-28T02:00:00Z'), channelSource: '腾讯营销', appointmentScheduled: true, paymentAmount: new Prisma.Decimal(200), customData: { quote: 15 }, project: { name: '口腔' }, promotionAccount: { id: 'account-a', name: '腾讯01', project: '口腔' }, owner: { id: 'member-a', username: 'member-a', nickname: '小王', team: { id: 'team-a', name: '网咨一组' } }, status: { code: 'VISITED', category: ConsultationStatusCategory.IN_PROGRESS } },
    { id: '2', recordedAt: new Date('2026-10-28T03:00:00Z'), channelSource: '腾讯营销', appointmentScheduled: false, paymentAmount: new Prisma.Decimal(0), customData: { quote: 5 }, project: { name: '口腔' }, promotionAccount: { id: 'account-b', name: '腾讯02', project: '口腔' }, owner: { id: 'member-b', username: 'member-b', nickname: '小李', team: { id: 'team-b', name: '网咨二组' } }, status: { code: 'INVALID', category: ConsultationStatusCategory.INVALID } }
  ];
  const prisma = {
    consultationFieldConfig: { findMany: jest.fn().mockResolvedValue([{ code: 'quote', name: '报价' }]) },
    consultationForm: { findMany: jest.fn().mockResolvedValue(rows) }
  };
  const dataScopes = { ownershipWhere: jest.fn().mockResolvedValue(scope) };
  const service = new ConsultationReportService(prisma as never, dataScopes as never);

  it('uses the member data scope and calculates rates from saved fields', async () => {
    const result = await service.report({ mode: 'channel', from: '2026-10-28', to: '2026-10-28', customFields: 'quote' }, user);
    expect(prisma.consultationForm.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { AND: expect.arrayContaining([scope]) } }));
    expect(result.summary).toMatchObject({ total: 2, valid: 1, effectiveRate: 50, appointment: 1, appointmentRate: 50, arrived: 1, arrivalRate: 50, payment: 200, custom: { quote: 20 } });
  });

  it('rejects unknown custom fields rather than reading arbitrary JSON data', async () => {
    await expect(service.report({ mode: 'daily', from: '2026-10-28', to: '2026-10-28', customFields: 'secret' }, user)).rejects.toThrow('包含不可用于报表');
  });

  it('groups channels by project, channel and account without merging accounts', async () => {
    const result = await service.report({ mode: 'channel', from: '2026-10-28', to: '2026-10-28' }, user);
    const project = result.tree[0];
    expect(project.label).toBe('口腔');
    expect(project.children[0].label).toBe('腾讯营销');
    expect(project.children[0].children.map(account => account.label)).toEqual(['腾讯01', '腾讯02']);
    expect(project.children[0].children.map(account => account.total)).toEqual([1, 1]);
  });

  it('uses the current consultation team as the first level of the consultation report', async () => {
    const result = await service.report({ mode: 'daily', from: '2026-10-28', to: '2026-10-28' }, user);
    expect(result.tree.map(team => team.label).sort()).toEqual(['网咨一组', '网咨二组'].sort());
    expect(result.tree.find(team => team.label === '网咨一组')?.children.map(member => member.label)).toEqual(['小王']);
    expect(result.tree.find(team => team.label === '网咨一组')?.children[0].children).toEqual([]);
  });
});
