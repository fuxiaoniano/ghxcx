import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import axios from 'axios';

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
    landingPageId: 'landing_default',
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
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
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
      getLandingPageForAppointment: jest.fn().mockResolvedValue({ institutionName: '测试口腔机构' }),
      getAppointmentNotifyConfig: jest.fn().mockResolvedValue({ enabled: true, templateId: 'staff-template' })
    };
    const locks = new Set<string>();
    const redis = {
      set: jest.fn(async (key: string) => { if (locks.has(key)) return null; locks.add(key); return 'OK'; }),
      eval: jest.fn(async (_script: string, _count: number, key: string) => { locks.delete(key); return 1; })
    };
    return {
      service: new NotificationsService(prisma as any, config as any, official as any, mini as any, configs as any, redis as any),
      prisma, redis
    };
  }

  it('rejects retrying a notification already recorded as successful', async () => {
    const { service, prisma } = createService([]);
    prisma.notificationLog.findUnique.mockResolvedValue({ id: 'log-1', appointmentId: 'appt_1', status: NotificationStatus.SUCCESS });
    await expect(service.retryNotification('log-1')).rejects.toThrow('通知已发送成功，无需重试');
    expect(prisma.notificationLog.update).not.toHaveBeenCalled();
    expect(prisma.notificationLog.create).not.toHaveBeenCalled();
  });

  it('does not automatically resend a patient notice with a settled result', async () => {
    const { service, prisma } = createService([{ oaOpenId: 'patient-1' }]);
    prisma.notificationLog.findMany.mockResolvedValue([{ status: NotificationStatus.SUCCESS, errorCode: null, payloadJson: { touser: 'patient-1' } }]);
    const result = await service.sendAppointmentSuccess('appt_1');
    expect(result).toEqual(expect.objectContaining({ officialAccount: NotificationStatus.SKIPPED }));
    expect(prisma.notificationLog.create).not.toHaveBeenCalled();
  });

  it('skips only staff recipients whose prior result is settled', async () => {
    const { service, prisma } = createService([]);
    prisma.adminUser.findMany.mockResolvedValue([{ nickname: 'A', username: 'a', oaOpenId: 'staff-1' }, { nickname: 'B', username: 'b', oaOpenId: 'staff-2' }]);
    prisma.notificationLog.findMany.mockImplementation(async ({ where }: any) => where.targetOpenId === 'staff-1'
      ? [{ status: NotificationStatus.SUCCESS, payloadJson: { kind: 'STAFF_APPOINTMENT_NOTICE' } }]
      : []);
    const result = await service.sendStaffAppointmentNotice('appt_1');
    expect(result.success).toBe(2);
    expect(prisma.notificationLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.notificationLog.create.mock.calls[0][0].data.targetOpenId).toBe('staff-2');
  });

  it('retries only the failed staff recipient', async () => {
    const { service, prisma } = createService([]);
    const log = { id: 'log-1', appointmentId: 'appt_1', targetOpenId: 'staff-1', status: NotificationStatus.FAILED, errorCode: '40003', payloadJson: { kind: 'STAFF_APPOINTMENT_NOTICE' } };
    prisma.notificationLog.findUnique.mockResolvedValue(log);
    prisma.notificationLog.findMany.mockResolvedValue([log]);
    const send = jest.spyOn(service, 'sendStaffAppointmentNotice').mockResolvedValue({ total: 1, success: 1, failed: 0, skipped: 0 });
    await service.retryNotification('log-1');
    expect(send).toHaveBeenCalledWith('appt_1', 'staff-1', true);
    expect(prisma.notificationLog.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'log-1', status: NotificationStatus.FAILED } }));
  });

  it('blocks retry if the recipient already received the fallback or the result is unknown', async () => {
    const { service, prisma } = createService([]);
    const log = { id: 'log-1', appointmentId: 'appt_1', targetOpenId: 'staff-1', status: NotificationStatus.FAILED, errorCode: '40003', payloadJson: { kind: 'STAFF_APPOINTMENT_NOTICE' } };
    prisma.notificationLog.findUnique.mockResolvedValue(log);
    prisma.notificationLog.findMany.mockResolvedValueOnce([log, { id: 'log-2', status: NotificationStatus.SUCCESS, payloadJson: { kind: 'STAFF_APPOINTMENT_NOTICE_CUSTOM_TEXT' } }]);
    await expect(service.retryNotification('log-1')).rejects.toThrow('已有成功记录');
    prisma.notificationLog.findMany.mockResolvedValueOnce([{ ...log, errorCode: 'HTTP_ERROR' }]);
    await expect(service.retryNotification('log-1')).rejects.toThrow('发送结果不明');
    expect(prisma.notificationLog.updateMany).not.toHaveBeenCalled();
  });

  it('prevents two retries from claiming the same record', async () => {
    const { service, prisma } = createService([]);
    const log = { id: 'log-1', appointmentId: 'appt_1', targetOpenId: 'staff-1', status: NotificationStatus.FAILED, errorCode: '40003', payloadJson: { kind: 'STAFF_APPOINTMENT_NOTICE' } };
    prisma.notificationLog.findUnique.mockResolvedValue(log);
    prisma.notificationLog.findMany.mockResolvedValue([log]);
    prisma.notificationLog.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }).mockResolvedValue({ count: 1 });
    let finish!: (value: { total: number; success: number; failed: number; skipped: number }) => void;
    jest.spyOn(service, 'sendStaffAppointmentNotice').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const first = service.retryNotification('log-1');
    while (!finish) await Promise.resolve();
    await expect(service.retryNotification('log-1')).rejects.toThrow('正在处理');
    finish({ total: 1, success: 1, failed: 0, skipped: 0 });
    await first;
  });

  it('prevents concurrent retries of different failure records for the same staff recipient', async () => {
    const { service, prisma } = createService([]);
    const log = { appointmentId: 'appt_1', targetOpenId: 'staff-1', status: NotificationStatus.FAILED, errorCode: '40003', payloadJson: { kind: 'STAFF_APPOINTMENT_NOTICE' } };
    prisma.notificationLog.findUnique.mockImplementation(async ({ where }: any) => ({ ...log, id: where.id }));
    prisma.notificationLog.findMany.mockResolvedValue([{ ...log, id: 'log-1' }, { ...log, id: 'log-2' }]);
    let finish!: (value: { total: number; success: number; failed: number; skipped: number }) => void;
    const send = jest.spyOn(service, 'sendStaffAppointmentNotice').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const first = service.retryNotification('log-1');
    while (!finish) await Promise.resolve();
    await expect(service.retryNotification('log-2')).rejects.toThrow('正在处理');
    finish({ total: 1, success: 1, failed: 0, skipped: 0 });
    await first;
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the retry lock service is unavailable', async () => {
    const { service, prisma, redis } = createService([]);
    prisma.notificationLog.findUnique.mockResolvedValue({ id: 'log-1', appointmentId: 'appt_1', targetOpenId: 'staff-1', status: NotificationStatus.FAILED, payloadJson: { kind: 'STAFF_APPOINTMENT_NOTICE' } });
    redis.set.mockRejectedValueOnce(new Error('redis unavailable'));
    await expect(service.retryNotification('log-1')).rejects.toThrow('通知重试服务暂不可用');
    expect(prisma.notificationLog.updateMany).not.toHaveBeenCalled();
  });

  it('does not send a staff fallback when the template request times out', async () => {
    const { service, prisma } = createService([]);
    prisma.adminUser.findMany.mockResolvedValue([{ nickname: '测试', username: 'test', oaOpenId: 'staff-1' }]);
    jest.spyOn(service as any, 'isMock').mockReturnValue(false);
    jest.spyOn((service as any).official, 'getAccessToken').mockResolvedValue('test-token');
    const post = jest.spyOn(axios, 'post').mockRejectedValue(new Error('timeout'));
    try {
      await expect(service.sendStaffAppointmentNotice('appt_1')).resolves.toMatchObject({ success: 0, failed: 1 });
      expect(post).toHaveBeenCalledTimes(1);
      expect(prisma.notificationLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ errorCode: 'HTTP_ERROR' }) }));
    } finally {
      post.mockRestore();
    }
  });

  it('does not send the mini-program fallback when the official request times out', async () => {
    const { service } = createService([{ oaOpenId: 'oa-1', miniOpenId: 'mini-1' }]);
    jest.spyOn(service as any, 'isMock').mockReturnValue(false);
    jest.spyOn((service as any).official, 'getAccessToken').mockResolvedValue('test-token');
    const miniToken = jest.spyOn((service as any).mini, 'getAccessToken');
    const post = jest.spyOn(axios, 'post').mockRejectedValue(new Error('timeout'));
    try {
      await expect(service.sendAppointmentSuccess('appt_1')).resolves.toMatchObject({ officialAccount: NotificationStatus.FAILED, miniProgram: NotificationStatus.SKIPPED, reason: expect.stringContaining('待核实') });
      expect(post).toHaveBeenCalledTimes(1);
      expect(miniToken).not.toHaveBeenCalled();
    } finally {
      post.mockRestore();
    }
  });

  it('treats a staff response without a business code as unknown', async () => {
    const { service, prisma } = createService([]);
    prisma.adminUser.findMany.mockResolvedValue([{ nickname: '测试', username: 'test', oaOpenId: 'staff-1' }]);
    jest.spyOn(service as any, 'isMock').mockReturnValue(false);
    jest.spyOn((service as any).official, 'getAccessToken').mockResolvedValue('test-token');
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: {} });
    try {
      await expect(service.sendStaffAppointmentNotice('appt_1')).resolves.toMatchObject({ success: 0, failed: 1 });
      expect(post).toHaveBeenCalledTimes(1);
      expect(prisma.notificationLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ errorCode: 'UNKNOWN_RESPONSE' }) }));
    } finally {
      post.mockRestore();
    }
  });

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

  it('limits a staff retry query to its original recipient', async () => {
    const { service, prisma } = createService([]);
    prisma.adminUser.findMany.mockResolvedValue([{ nickname: '测试', username: 'test', oaOpenId: 'staff-1' }]);
    await service.sendStaffAppointmentNotice('appt_1', 'staff-1');
    expect(prisma.adminUser.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ oaOpenId: 'staff-1' }) }));
    expect(prisma.notificationLog.create).toHaveBeenCalledTimes(1);
  });
});
