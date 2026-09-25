import axios from 'axios';
import { FollowupForwardStatus } from '@prisma/client';
import { FollowupForwarderService } from '../src/modules/followup-forwarder/followup-forwarder.service';

jest.mock('axios');

describe('FollowupForwarderService', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const appointment = {
    id: 'appt_1',
    appointmentNo: 'GH20260706000001',
    userId: 'user_1',
    name: '张三',
    phoneEncrypted: 'encrypted-phone',
    phoneMasked: '138****8000',
    phoneHash: 'hash',
    ageRange: '40-50岁',
    missingTeethType: '单颗缺失',
    clinicId: 'clinic_1',
    source: 'mini_program',
    status: 'PENDING_CONTACT',
    remark: '下午方便',
    adminRemark: null,
    assignedToAdminId: null,
    followupForwardStatus: FollowupForwardStatus.PENDING,
    followupForwardedAt: null,
    followupForwardLastTriedAt: null,
    followupForwardErrorCode: null,
    followupForwardErrorMessage: null,
    followupForwardResponse: null,
    followupForwardRetryCount: 0,
    createdAt: new Date('2026-07-06T08:00:00Z'),
    updatedAt: new Date('2026-07-06T08:00:00Z'),
    contactedAt: null,
    confirmedAt: null,
    cancelledAt: null,
    clinic: {
      id: 'clinic_1',
      name: '总院',
      address: '重庆',
      phone: '023-12345678',
      status: 'ACTIVE',
      createdAt: new Date('2026-07-06T08:00:00Z'),
      updatedAt: new Date('2026-07-06T08:00:00Z')
    }
  };

  function createService(config: {
    enabled: boolean;
    url: string;
    authToken?: string;
    authHeader?: string;
    authScheme?: string;
    timeoutMs?: number;
    includeFullPhone?: boolean;
    extraHeaders?: Record<string, string>;
  }) {
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        update: jest.fn().mockResolvedValue({})
      }
    };
    const crypto = {
      decryptPhone: jest.fn().mockReturnValue('13800138000')
    };
    const configs = {
      getFollowupForwardConfig: jest.fn().mockResolvedValue({
        authHeader: 'Authorization',
        authScheme: 'Bearer',
        authToken: '',
        timeoutMs: 5000,
        includeFullPhone: true,
        extraHeaders: {},
        ...config
      })
    };
    return {
      service: new FollowupForwarderService(prisma as any, crypto as any, configs as any),
      prisma,
      crypto,
      configs
    };
  }

  beforeEach(() => {
    mockedAxios.post.mockReset();
  });

  it('posts appointment payload and marks success', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: { code: 0, id: 'followup_1' } });
    const { service, prisma, crypto } = createService({
      enabled: true,
      url: 'https://followup.example.com/api/appointments',
      authToken: 'token'
    });

    const result = await service.forwardAppointment('appt_1');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://followup.example.com/api/appointments',
      expect.objectContaining({
        event: 'APPOINTMENT_CREATED',
        appointment: expect.objectContaining({
          appointmentNo: 'GH20260706000001',
          phone: '13800138000',
          clinic: expect.objectContaining({ name: '总院' })
        })
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token' })
      })
    );
    expect(crypto.decryptPhone).toHaveBeenCalledWith('encrypted-phone');
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          followupForwardStatus: FollowupForwardStatus.SUCCESS,
          followupForwardErrorCode: null,
          followupForwardErrorMessage: null
        })
      })
    );
    expect(result.status).toBe(FollowupForwardStatus.SUCCESS);
  });

  it('marks skipped when forwarding is disabled', async () => {
    const { service, prisma } = createService({
      enabled: false,
      url: 'https://followup.example.com/api/appointments'
    });

    const result = await service.forwardAppointment('appt_1');

    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          followupForwardStatus: FollowupForwardStatus.SKIPPED,
          followupForwardErrorCode: 'FOLLOWUP_FORWARD_DISABLED'
        })
      })
    );
    expect(result.status).toBe(FollowupForwardStatus.SKIPPED);
  });
});
