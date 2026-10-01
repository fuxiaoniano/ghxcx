import { AppointmentStatus, AppointmentType, ContentStatus, DoctorScheduleStatus } from '@prisma/client';
import { access, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
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
      departments: [{ departmentId: 'category_1', department: { id: 'category_1', name: '种植科' } }],
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
      doctor: { findFirst: jest.fn().mockResolvedValue(doctor), findMany: jest.fn() },
      doctorSchedule: {
        createMany: jest.fn().mockResolvedValue({ count: 28 }),
        findMany: jest.fn().mockResolvedValue([])
      },
      dentalProject: { findFirst: jest.fn().mockResolvedValue(project) },
      package: { findFirst: jest.fn(), findMany: jest.fn() },
      packageCategory: { findMany: jest.fn() },
      homeBanner: { findMany: jest.fn() },
      homeAd: { findMany: jest.fn() },
      dentalCategory: { findMany: jest.fn() },
      systemConfig: { findUnique: jest.fn().mockResolvedValue(null) },
      mediaAsset: { findMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
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
    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('statusText');
  });

  it('accepts an appointment through a secondary department linked to the doctor', async () => {
    const { service, prisma, transaction } = fixture();
    prisma.doctor.findFirst.mockResolvedValue({
      id: 'doctor_1',
      departmentId: 'other_category',
      clinicId: 'clinic_1',
      status: ContentStatus.ACTIVE,
      clinic: { id: 'clinic_1', name: '总院' },
      department: { id: 'other_category', name: '综合科' },
      departments: [{ departmentId: 'category_1' }]
    });

    await service.createDoctorAppointment('user_1', {
      doctorId: 'doctor_1', dentalCategoryId: 'category_1', dentalProjectId: 'project_1',
      appointmentDate: '2099-08-23', appointmentTime: '上午', symptomDescription: '缺牙', privacyAccepted: true
    });

    expect(transaction.appointment.create).toHaveBeenCalled();
  });

  it('creates the default morning and afternoon schedule for the next 14 days', async () => {
    const { service, prisma } = fixture();

    await service.doctorDetail('doctor_1');

    expect(prisma.doctorSchedule.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ timeSlot: '上午', capacity: 20 }),
          expect.objectContaining({ timeSlot: '下午', capacity: 20 })
        ]),
        skipDuplicates: true
      })
    );
    expect(prisma.doctorSchedule.createMany.mock.calls[0][0].data).toHaveLength(28);
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

  it('returns ad jump configuration on the public home endpoint', async () => {
    const { service, prisma } = fixture();
    prisma.homeBanner.findMany.mockResolvedValue([]);
    prisma.homeAd.findMany.mockResolvedValue([
      { id: 'ad_1', imageUrl: 'https://example.com/ad.png', title: '套餐广告', linkType: 'PAGE', linkValue: '/pages/packages/packages' }
    ]);
    prisma.dentalCategory.findMany.mockResolvedValue([]);
    prisma.doctor.findMany.mockResolvedValue([]);

    const result = await service.home();

    expect(result.ads[0]).toEqual(expect.objectContaining({
      linkType: 'PAGE',
      linkValue: '/pages/packages/packages'
    }));
  });

  it('returns all active packages when no category filter is supplied', async () => {
    const { service, prisma } = fixture();
    prisma.packageCategory.findMany.mockResolvedValue([{ id: 'category_1', name: '种植牙' }]);
    prisma.package.findMany.mockResolvedValue([
      { id: 'package_1', originalPrice: 100, salePrice: 68 },
      { id: 'package_2', originalPrice: 200, salePrice: 128 }
    ]);

    const result = await service.packages({});

    expect(prisma.package.findMany.mock.calls[0][0].where.categoryId).toBeUndefined();
    expect(result.packages).toHaveLength(2);
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

    expect(result).toEqual(expect.objectContaining({
      phoneMasked: '138****8000',
      subscribedOfficialAccount: true,
      hospitalName: '傅小念口腔'
    }));
    expect(result).not.toHaveProperty('phoneEncrypted');
  });

  it('deletes the media library record and its original uploaded file', async () => {
    const { service, prisma } = fixture();
    const previousDirectory = process.env.ENTERPRISE_ASSET_DIR;
    const directory = await mkdtemp(join(tmpdir(), 'enterprise-assets-'));
    const filename = 'asset-delete-test.png';
    const filePath = join(directory, filename);
    process.env.ENTERPRISE_ASSET_DIR = directory;
    await writeFile(filePath, 'image');
    prisma.mediaAsset.findUnique.mockResolvedValue({
      id: 'asset_1',
      url: `https://example.com/uploads/enterprise-assets/${filename}`
    });
    prisma.mediaAsset.delete.mockResolvedValue({ id: 'asset_1' });

    try {
      await expect(service.deleteMediaAsset('asset_1')).resolves.toEqual({
        id: 'asset_1', deleted: true, fileDeleted: true
      });
      await expect(access(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 'asset_1' } });
    } finally {
      if (previousDirectory === undefined) delete process.env.ENTERPRISE_ASSET_DIR;
      else process.env.ENTERPRISE_ASSET_DIR = previousDirectory;
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('returns readable names for media assets uploaded with a Latin-1 multipart filename', async () => {
    const { service, prisma } = fixture();
    const original = '深度洁牙.jpg';
    prisma.mediaAsset.findMany.mockResolvedValue([
      { id: 'asset_1', name: Buffer.from(original, 'utf8').toString('latin1'), url: 'https://example.com/a.jpg' }
    ]);

    await expect(service.mediaAssets()).resolves.toEqual([
      expect.objectContaining({ id: 'asset_1', name: original })
    ]);
  });

  it('refuses to delete files outside the managed enterprise asset directory', async () => {
    const { service, prisma } = fixture();
    prisma.mediaAsset.findUnique.mockResolvedValue({
      id: 'asset_2',
      url: 'https://example.com/uploads/landing-assets/unrelated.png'
    });

    await expect(service.deleteMediaAsset('asset_2')).rejects.toThrow('图片不属于系统上传目录');
    expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
  });
});
