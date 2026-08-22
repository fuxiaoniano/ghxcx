import { AppointmentStatus, AppointmentType, ContentStatus, DoctorScheduleStatus } from '@prisma/client';
import { EnterpriseService } from '../src/modules/enterprise/enterprise.service';

describe('EnterpriseService', () => {
  function fixture() {
    const user = {
      id: 'user_1',
      name: '现有用户',
      ageRange: '40-50岁',
      phoneEncrypted: 'encrypted',
      phoneHash: 'hash',
      phoneMasked: '138****8000'
    };
    const doctor = {
      id: 'doctor_1',
      name: '李医生',
      title: '主任医师',
      departmentId: 'category_1',
      clinicId: 'clinic_1',
      status: ContentStatus.ACTIVE,
      clinic: { id: 'clinic_1', name: '总院' },
      department: { id: 'category_1', name: '种植科' }
    };
    const project = { id: 'project_1', categoryId: 'category_1', name: '单颗种植', status: ContentStatus.ACTIVE };
    const schedule = {
      id: 'schedule_1',
      doctorId: doctor.id,
      clinicId: 'clinic_1',
      date: new Date('2099-08-23T00:00:00.000Z'),
      timeSlot: '上午',
      capacity: 2,
      bookedCount: 0,
      status: DoctorScheduleStatus.AVAILABLE
    };
    const created = {
      id: 'appointment_1',
      appointmentNo: 'YY20990823123456',
      userId: user.id,
      name: user.name,
      phoneMasked: user.phoneMasked,
      type: AppointmentType.DOCTOR_APPOINTMENT,
      status: AppointmentStatus.PENDING_CONTACT,
      appointmentDate: schedule.date,
      appointmentTime: schedule.timeSlot,
      symptomDescription: '缺牙',
      gender: null,
      createdAt: new Date(),
      clinic: doctor.clinic,
      doctor,
      dentalCategory: doctor.department,
      dentalProject: project,
      package: null
    };
    const transaction = {
      doctorSchedule: {
        findFirst: jest.fn().mockResolvedValue(schedule),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(schedule)
      },
      appointment: { create: jest.fn().mockResolvedValue(created) }
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      doctor: { findFirst: jest.fn().mockResolvedValue(doctor) },
      dentalProject: { findFirst: jest.fn().mockResolvedValue(project) },
      package: { findFirst: jest.fn() },
      appointment: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      $transaction: jest.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction))
    };
    const notifications = {
      sendAppointmentSuccess: jest.fn().mockResolvedValue({}),
      sendStaffAppointmentNotice: jest.fn().mockResolvedValue({})
    };
    const followup = { forwardAppointment: jest.fn().mockResolvedValue({}) };
    const audit = { create: jest.fn().mockResolvedValue({}) };
    const redis = { set: jest.fn().mockResolvedValue('OK'), del: jest.fn().mockResolvedValue(1) };
    return {
      service: new EnterpriseService(prisma as any, notifications as any, followup as any, audit as any, redis as any),
      prisma,
      transaction,
      notifications,
      followup,
      redis,
      user,
      doctor,
      project,
      created
    };
  }

  it('creates a doctor appointment in the shared appointments table and reserves the schedule', async () => {
    const { service, transaction, notifications, followup } = fixture();
    const result = await service.createDoctorAppointment('user_1', {
      doctorId: 'doctor_1',
      dentalCategoryId: 'category_1',
      dentalProjectId: 'project_1',
      appointmentDate: '2099-08-23',
      appointmentTime: '上午',
      symptomDescription: '缺牙',
      privacyAccepted: true
    });

    expect(transaction.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: AppointmentType.DOCTOR_APPOINTMENT,
          doctorId: 'doctor_1',
          dentalProjectId: 'project_1',
          phoneEncrypted: 'encrypted'
        })
      })
    );
    expect(transaction.doctorSchedule.updateMany).toHaveBeenCalled();
    expect(notifications.sendAppointmentSuccess).toHaveBeenCalledWith('appointment_1');
    expect(followup.forwardAppointment).toHaveBeenCalledWith('appointment_1');
    expect(result.typeText).toBe('医生预约');
  });

  it('creates a package consultation without creating a payment order', async () => {
    const { service, prisma, notifications } = fixture();
    prisma.package.findFirst.mockResolvedValue({ id: 'package_1', title: '洁牙套餐', status: ContentStatus.ACTIVE });
    prisma.appointment.create.mockResolvedValue({
      id: 'appointment_2',
      appointmentNo: 'TC20990823123456',
      name: '现有用户',
      phoneMasked: '138****8000',
      type: AppointmentType.PACKAGE_APPLICATION,
      status: AppointmentStatus.PENDING_CONTACT,
      appointmentDate: new Date('2099-08-23T00:00:00.000Z'),
      appointmentTime: null,
      symptomDescription: null,
      gender: null,
      createdAt: new Date(),
      clinic: null,
      doctor: null,
      dentalCategory: null,
      dentalProject: null,
      package: { id: 'package_1', title: '洁牙套餐', originalPrice: 100, salePrice: 68 }
    });

    const result = await service.createPackageApplication('user_1', {
      packageId: 'package_1',
      appointmentDate: '2099-08-23',
      privacyAccepted: true
    });

    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: AppointmentType.PACKAGE_APPLICATION, packageId: 'package_1' }) })
    );
    expect(notifications.sendStaffAppointmentNotice).toHaveBeenCalledWith('appointment_2');
    expect(result.typeText).toBe('套餐申请');
  });

  it('rejects a doctor that does not belong to the selected department and releases the lock', async () => {
    const { service, prisma, redis } = fixture();
    prisma.doctor.findFirst.mockResolvedValue({ id: 'doctor_1', departmentId: 'other', status: ContentStatus.ACTIVE });

    await expect(
      service.createDoctorAppointment('user_1', {
        doctorId: 'doctor_1',
        dentalCategoryId: 'category_1',
        dentalProjectId: 'project_1',
        appointmentDate: '2099-08-23',
        appointmentTime: '上午',
        symptomDescription: '缺牙',
        privacyAccepted: true
      })
    ).rejects.toThrow('医生与所选科室不匹配');
    expect(redis.del).toHaveBeenCalled();
  });

  it('rejects a full schedule without writing an appointment', async () => {
    const { service, transaction, redis } = fixture();
    transaction.doctorSchedule.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.createDoctorAppointment('user_1', {
        doctorId: 'doctor_1',
        dentalCategoryId: 'category_1',
        dentalProjectId: 'project_1',
        appointmentDate: '2099-08-23',
        appointmentTime: '上午',
        symptomDescription: '缺牙',
        privacyAccepted: true
      })
    ).rejects.toThrow('该出诊时段已约满');
    expect(transaction.appointment.create).not.toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalled();
  });

  it('rejects a package application for a past date before creating a record', async () => {
    const { service, prisma, redis } = fixture();
    prisma.package.findFirst.mockResolvedValue({ id: 'package_1', title: '洁牙套餐', status: ContentStatus.ACTIVE });

    await expect(
      service.createPackageApplication('user_1', {
        packageId: 'package_1',
        appointmentDate: '2000-01-01',
        privacyAccepted: true
      })
    ).rejects.toThrow('预约日期不能早于今天');
    expect(prisma.appointment.create).not.toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalled();
  });

  it('returns only masked profile data and official-account subscription state', async () => {
    const { service, prisma } = fixture();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      name: '现有用户',
      phoneEncrypted: 'encrypted',
      phoneMasked: '138****8000',
      identities: [{ subscribedOfficialAccount: true }]
    });
    (prisma as any).systemConfig = {
      findUnique: jest.fn().mockResolvedValue({ valueJson: { officialAccountName: '口腔医院公众号' } })
    };

    const result = await service.profile('user_1');

    expect(result).toEqual(expect.objectContaining({ phoneMasked: '138****8000', subscribedOfficialAccount: true }));
    expect(result).not.toHaveProperty('phoneEncrypted');
  });
});
