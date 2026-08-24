import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

describe('NotificationsService', () => {
  const baseAppointment = {
    id: 'appt_1',
    appointmentNo: 'GH20260706000001',
    userId: 'user_1',
    name: '张三',
    phoneMasked: '138****1234',
    ageRange: '40-50岁',
    missingTeethType: '单颗缺失',
    source: 'mini_program',
    remark: '',
    createdAt: new Date('2026-07-06T00:00:00Z'),
    clinic: null
  };

  function createService(identities: Array<{ oaOpenId?: string | null; miniOpenId?: string | null }>) {
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue({
          ...baseAppointment,
          user: { identities }
        })
      },
      notificationLog: {
        create: jest.fn().mockResolvedValue({})
      },
      adminUser: {
        findMany: jest.fn().mockResolvedValue([])
      }
    };
    const config = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          NODE_ENV: 'test',
          OFFICIAL_ACCOUNT_TEMPLATE_APPOINTMENT_SUCCESS: 'oa-template',
          MINI_SUBSCRIBE_TEMPLATE_APPOINTMENT_SUCCESS: 'mini-template',
          MINI_APP_ID: 'wx-mini'
        };
        return map[key];
      })
    };
    const official = { getAccessToken: jest.fn() };
    const mini = { getAccessToken: jest.fn() };
    const configs = {
      getLandingPage: jest.fn().mockResolvedValue({ institutionName: '测试口腔机构' }),
      getAppointmentNotifyConfig: jest.fn().mockResolvedValue({ enabled: true, templateId: 'staff-template' })
    };
    return {
      service: new NotificationsService(prisma as any, config as any, official as any, mini as any, configs as any),
      prisma
    };
  }

  it('sends official account template first when oaOpenId exists', async () => {
    const { service, prisma } = createService([{ oaOpenId: 'oa-openid', miniOpenId: 'mini-openid' }]);

    const result = await service.sendAppointmentSuccess('appt_1');

    expect(result.officialAccount).toBe(NotificationStatus.SUCCESS);
    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: NotificationChannel.OFFICIAL_ACCOUNT_TEMPLATE,
          status: NotificationStatus.SUCCESS
        })
      })
    );
  });

  it('falls back to mini subscribe message when oaOpenId is missing', async () => {
    const { service, prisma } = createService([{ miniOpenId: 'mini-openid' }]);

    const result = await service.sendAppointmentSuccess('appt_1');

    expect(result.officialAccount).toBe(NotificationStatus.FAILED);
    expect(result.miniProgram).toBe(NotificationStatus.SUCCESS);
    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: NotificationChannel.MINI_PROGRAM_SUBSCRIBE,
          status: NotificationStatus.SUCCESS
        })
      })
    );
  });

  it('uses the exact fields configured by the mini-program appointment template', async () => {
    const { service, prisma } = createService([{ miniOpenId: 'mini-openid' }]);

    await service.sendAppointmentSuccess('appt_1');

    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: NotificationChannel.MINI_PROGRAM_SUBSCRIBE,
          payloadJson: expect.objectContaining({
            data: expect.objectContaining({
              thing1: { value: '您的挂号已提交，请保持电话畅通' },
              phrase2: { value: '张三' },
              thing5: { value: '单颗缺失' },
              date14: { value: '2026-07-06 08:00' },
              thing4: { value: '测试口腔机构' }
            })
          })
        })
      })
    );
  });

  it('sends staff notices only to active bound members with notifications enabled', async () => {
    const { service, prisma } = createService([]);
    prisma.adminUser.findMany.mockResolvedValue([
      { nickname: '傅小念', username: 'admin', oaOpenId: 'staff-openid' }
    ]);

    const result = await service.sendStaffAppointmentNotice('appt_1');

    expect(prisma.adminUser.findMany).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
        notifyEnabled: true,
        oaOpenId: { not: null }
      },
      select: { nickname: true, username: true, oaOpenId: true }
    });
    expect(result).toEqual({ total: 1, success: 1, failed: 0, skipped: 0 });
  });
});
