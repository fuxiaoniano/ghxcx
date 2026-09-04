import { AppointmentStatus } from '@prisma/client';
import { AppointmentsService } from '../src/modules/appointments/appointments.service';

describe('AppointmentsService', () => {
  const appointment = {
    id: 'appt_1',
    appointmentNo: 'GH20260706000001',
    userId: 'user_1',
    name: '张三',
    phoneMasked: '138****8000',
    ageRange: '40-50岁',
    missingTeethType: '单颗缺失',
    status: AppointmentStatus.PENDING_CONTACT,
    remark: '',
    source: 'test',
    createdAt: new Date('2026-07-06T00:00:00Z'),
    clinic: null
  };

  function createService(redisSetResult: 'OK' | null = 'OK') {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user_1',
          phoneEncrypted: 'encrypted',
          phoneHash: 'hash',
          phoneMasked: '138****8000'
        }),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({ id: 'user_1' })
      },
      appointment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(appointment),
        findMany: jest.fn(),
        findFirst: jest.fn()
      }
    };
    const notifications = {
      sendAppointmentSuccess: jest.fn().mockResolvedValue({}),
      sendStaffAppointmentNotice: jest.fn().mockResolvedValue({})
    };
    const followupForwarder = {
      forwardAppointment: jest.fn().mockResolvedValue({})
    };
    const redis = { set: jest.fn().mockResolvedValue(redisSetResult) };
    const crypto = {
      encryptPhone: jest.fn().mockReturnValue('encrypted-public'),
      hashPhone: jest.fn().mockReturnValue('hash-public'),
      maskPhone: jest.fn().mockReturnValue('139****9000')
    };
    const configs = {
      getLandingPage: jest.fn().mockResolvedValue({
        pageId: 'landing_1',
        pageKey: 'page-one',
        formOptions: {
          ageRanges: ['40-50岁'],
          missingTeethTypes: ['单颗缺失']
        },
        clinics: []
      })
    };
    return {
      service: new AppointmentsService(
        prisma as any,
        notifications as any,
        followupForwarder as any,
        crypto as any,
        configs as any,
        redis as any
      ),
      prisma,
      notifications,
      followupForwarder,
      crypto,
      configs,
      redis
    };
  }

  it('creates appointment with phone copied from current user', async () => {
    const { service, prisma, notifications, followupForwarder } = createService();
    const result = await service.create('user_1', {
      name: '张三',
      ageRange: '40-50岁',
      missingTeethType: '单颗缺失',
      privacyAccepted: true,
      source: 'unit'
    });

    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phoneEncrypted: 'encrypted',
          phoneHash: 'hash',
          phoneMasked: '138****8000',
          landingPageId: 'landing_1'
        })
      })
    );
    expect(notifications.sendAppointmentSuccess).toHaveBeenCalledWith('appt_1');
    expect(notifications.sendStaffAppointmentNotice).toHaveBeenCalledWith('appt_1');
    expect(followupForwarder.forwardAppointment).toHaveBeenCalledWith('appt_1');
    expect(result.phoneMasked).toBe('138****8000');
  });

  it('blocks duplicate submit in 30 seconds', async () => {
    const { service } = createService(null);
    await expect(
      service.create('user_1', {
        name: '张三',
        ageRange: '40-50岁',
        missingTeethType: '单颗缺失',
        privacyAccepted: true
      })
    ).rejects.toThrow('请勿重复点击');
  });

  it('creates an H5 appointment with encrypted phone and triggers notifications', async () => {
    const { service, prisma, crypto, notifications, followupForwarder } = createService();
    prisma.appointment.create.mockResolvedValue({
      ...appointment,
      phoneMasked: '139****9000',
      source: 'h5_page-one'
    });

    const result = await service.createPublic('page-one', {
      name: '李四',
      phone: '13900009000',
      ageRange: '40-50岁',
      missingTeethType: '单颗缺失',
      privacyAccepted: true
    });

    expect(crypto.encryptPhone).toHaveBeenCalledWith('13900009000');
    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phoneEncrypted: 'encrypted-public',
          phoneHash: 'hash-public',
          phoneMasked: '139****9000',
          landingPageId: 'landing_1'
        })
      })
    );
    expect(JSON.stringify(prisma.appointment.create.mock.calls[0][0])).not.toContain('13900009000');
    expect(notifications.sendStaffAppointmentNotice).toHaveBeenCalledWith('appt_1');
    expect(followupForwarder.forwardAppointment).toHaveBeenCalledWith('appt_1');
    expect(result.phoneMasked).toBe('139****9000');
  });
});
