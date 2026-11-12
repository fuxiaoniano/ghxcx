import { WechatGroupNotificationsService } from '../src/modules/wechat-group-notifications/wechat-group-notifications.service';

describe('WechatGroupNotificationsService durable outbox', () => {
  const appointment = { id: 'a1', landingPageId: 'page-a', createdAt: new Date('2026-10-21T00:00:00Z') };
  function setup(routes: Array<{ id: string; groupId: string }> = []) {
    const prisma = {
      appointment: { findUnique: jest.fn().mockResolvedValue(appointment), findMany: jest.fn().mockResolvedValue([]) },
      wechatGroupRoute: { findMany: jest.fn().mockResolvedValue(routes) },
      wechatGroupDelivery: { createMany: jest.fn().mockResolvedValue({ count: routes.length }) }
    };
    const service = new WechatGroupNotificationsService(prisma as any, {} as any);
    return { service, prisma };
  }

  it('uses saved landingPageId, never free-form source, and skips pages without routes', async () => {
    const { service, prisma } = setup();
    expect(await service.enqueueForAppointment('a1')).toBe(0);
    expect(prisma.wechatGroupRoute.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ landingPageId: 'page-a', enabled: true })
    }));
    expect(prisma.wechatGroupDelivery.createMany).not.toHaveBeenCalled();
  });

  it('creates one independently idempotent item per verified target group', async () => {
    const { service, prisma } = setup([{ id: 'route-1', groupId: 'group-1' }, { id: 'route-2', groupId: 'group-2' }]);
    expect(await service.enqueueForAppointment('a1')).toBe(2);
    expect(prisma.wechatGroupDelivery.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ appointmentId: 'a1', routeId: 'route-1', groupId: 'group-1' }),
        expect.objectContaining({ appointmentId: 'a1', routeId: 'route-2', groupId: 'group-2' })
      ], skipDuplicates: true
    });
  });

  it('queues even when sender is offline, rather than dropping the appointment', async () => {
    const { service, prisma } = setup([{ id: 'route-1', groupId: 'group-1' }]);
    await service.enqueueForAppointment('a1');
    expect(prisma.wechatGroupRoute.findMany.mock.calls[0][0].where.group.sender).toBeUndefined();
  });

  it('never enables an unverified transport', async () => {
    const { service } = setup();
    await expect(service.enableRoute('route-1')).rejects.toThrow('禁止启用路由');
  });
});
