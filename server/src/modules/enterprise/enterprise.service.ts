import { Inject, Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import Redis from 'ioredis';
import {
  AppointmentStatus,
  AppointmentType,
  ContentStatus,
  DoctorScheduleStatus,
  Prisma
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/utils/business-exception';
import { NotificationsService } from '../notifications/notifications.service';
import { FollowupForwarderService } from '../followup-forwarder/followup-forwarder.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AdminCurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateDoctorAppointmentDto,
  CreatePackageApplicationDto,
  DoctorDto,
  DoctorScheduleDto,
  EnterpriseHomeConfigDto,
  PackageDto,
  PackageImageItemDto
} from './dto';

type AuditContext = { user: AdminCurrentUser; ip?: string; userAgent?: string };

/** 新企业官网业务服务；所有写入均复用原 Prisma、用户、通知、回访和审计基础设施。 */
@Injectable()
export class EnterpriseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly followupForwarder: FollowupForwarderService,
    private readonly auditLogs: AuditLogsService,
    @Inject('REDIS') private readonly redis: Redis
  ) {}

  /** 首页聚合只返回已启用内容，并按后台排序稳定输出。 */
  async home() {
    const [config, banners, ads, categories, doctors] = await Promise.all([
      this.enterpriseHomeConfig(),
      this.prisma.homeBanner.findMany({ where: { status: ContentStatus.ACTIVE }, orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }] }),
      this.prisma.homeAd.findMany({ where: { status: ContentStatus.ACTIVE }, orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }] }),
      this.prisma.dentalCategory.findMany({ where: { status: ContentStatus.ACTIVE }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.doctor.findMany({
        where: { status: ContentStatus.ACTIVE, recommend: true },
        include: { department: true, clinic: true },
        orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
        take: 10
      })
    ]);
    return { config, banners, ads, categories, doctors: doctors.map((row) => this.doctorView(row)) };
  }

  /** 科室接口一次返回其全部启用项目，支持新版预约双栏布局。 */
  categories() {
    return this.prisma.dentalCategory.findMany({
      where: { status: ContentStatus.ACTIVE },
      include: { projects: { where: { status: ContentStatus.ACTIVE }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }]
    });
  }

  /** 医生列表按用户最新要求不分页，筛选后一次返回全部。 */
  async doctors(query: Record<string, string>) {
    const keyword = String(query.keyword || '').trim();
    const rows = await this.prisma.doctor.findMany({
      where: {
        status: ContentStatus.ACTIVE,
        ...(query.departmentId ? { departmentId: query.departmentId } : {}),
        ...(keyword
          ? { OR: [{ name: { contains: keyword } }, { title: { contains: keyword } }, { specialty: { contains: keyword } }] }
          : {})
      },
      include: { department: true, clinic: true },
      orderBy: [{ sort: 'asc' }, { recommend: 'desc' }, { createdAt: 'desc' }]
    });
    return rows.map((row) => this.doctorView(row));
  }

  async doctorDetail(id: string) {
    const row = await this.prisma.doctor.findFirst({
      where: { id, status: ContentStatus.ACTIVE },
      include: {
        department: true,
        clinic: true,
        schedules: {
          where: { status: { not: DoctorScheduleStatus.DISABLED }, date: { gte: dayjs().startOf('day').toDate() } },
          include: { clinic: true },
          orderBy: [{ date: 'asc' }, { sort: 'asc' }],
          take: 60
        }
      }
    });
    if (!row) throw new BusinessException(404401, '医生不存在');
    return { ...this.doctorView(row), schedules: row.schedules };
  }

  async packages(query: Record<string, string>) {
    const keyword = String(query.keyword || '').trim();
    const [categories, packages] = await Promise.all([
      this.prisma.packageCategory.findMany({ where: { status: ContentStatus.ACTIVE }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.package.findMany({
        where: {
          status: ContentStatus.ACTIVE,
          ...(query.categoryId ? { categoryId: query.categoryId } : {}),
          ...(keyword ? { title: { contains: keyword } } : {})
        },
        include: { category: true },
        orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }]
      })
    ]);
    return { categories, packages: packages.map((row) => this.packageView(row)) };
  }

  async packageDetail(id: string) {
    const row = await this.prisma.package.findFirst({
      where: { id, status: ContentStatus.ACTIVE },
      include: { category: true, images: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } }
    });
    if (!row) throw new BusinessException(404402, '套餐不存在');
    return this.packageView(row);
  }

  /** 医生预约使用独立事务写入统一 appointments，并原子占用排期名额。 */
  async createDoctorAppointment(userId: string, dto: CreateDoctorAppointmentDto) {
    this.assertPrivacy(dto.privacyAccepted);
    const lockKey = `enterprise:doctor-appointment:create:${userId}`;
    await this.acquireLock(lockKey);
    try {
      const [user, doctor, project] = await Promise.all([
        this.requireUserWithPhone(userId),
        this.prisma.doctor.findFirst({
          where: { id: dto.doctorId, status: ContentStatus.ACTIVE },
          include: { clinic: true, department: true }
        }),
        this.prisma.dentalProject.findFirst({
          where: { id: dto.dentalProjectId, categoryId: dto.dentalCategoryId, status: ContentStatus.ACTIVE }
        })
      ]);
      if (!doctor || doctor.departmentId !== dto.dentalCategoryId) throw new BusinessException(400403, '医生与所选科室不匹配');
      if (!project) throw new BusinessException(400404, '预约项目不存在或已停用');
      const date = dayjs(dto.appointmentDate).startOf('day');
      if (!date.isValid() || date.isBefore(dayjs().startOf('day'))) throw new BusinessException(400405, '预约日期不能早于今天');

      const appointment = await this.prisma.$transaction(async (transaction) => {
        const schedule = await transaction.doctorSchedule.findFirst({
          where: { doctorId: doctor.id, date: date.toDate(), timeSlot: dto.appointmentTime, status: DoctorScheduleStatus.AVAILABLE }
        });
        if (!schedule || schedule.bookedCount >= schedule.capacity) throw new BusinessException(409402, '该出诊时段已约满，请选择其他时段', 409);
        const updated = await transaction.doctorSchedule.updateMany({
          where: { id: schedule.id, bookedCount: { lt: schedule.capacity }, status: DoctorScheduleStatus.AVAILABLE },
          data: { bookedCount: { increment: 1 } }
        });
        if (updated.count !== 1) throw new BusinessException(409402, '该出诊时段已约满，请选择其他时段', 409);
        if (schedule.bookedCount + 1 >= schedule.capacity) {
          await transaction.doctorSchedule.update({ where: { id: schedule.id }, data: { status: DoctorScheduleStatus.FULL } });
        }
        return transaction.appointment.create({
          data: {
            appointmentNo: await this.createAppointmentNo('YY'),
            userId,
            name: this.patientName(dto.name, user.name),
            phoneEncrypted: user.phoneEncrypted!,
            phoneHash: user.phoneHash!,
            phoneMasked: user.phoneMasked!,
            ageRange: user.ageRange || '未填写',
            missingTeethType: project.name,
            type: AppointmentType.DOCTOR_APPOINTMENT,
            clinicId: schedule.clinicId || doctor.clinicId,
            doctorId: doctor.id,
            dentalCategoryId: dto.dentalCategoryId,
            dentalProjectId: project.id,
            appointmentDate: date.toDate(),
            appointmentTime: dto.appointmentTime,
            symptomDescription: dto.symptomDescription,
            gender: dto.gender || null,
            source: dto.source || 'mini_program_enterprise',
            remark: dto.symptomDescription
          },
          include: { clinic: true, doctor: true, dentalCategory: true, dentalProject: true, package: true }
        });
      });
      await this.afterAppointmentCreated(appointment.id);
      return this.appointmentView(appointment);
    } catch (error) {
      await this.redis.del(lockKey).catch(() => undefined);
      throw error;
    }
  }

  /** 套餐不创建支付订单，仅写入 PACKAGE_APPLICATION 类型咨询申请。 */
  async createPackageApplication(userId: string, dto: CreatePackageApplicationDto) {
    this.assertPrivacy(dto.privacyAccepted);
    const lockKey = `enterprise:package-application:create:${userId}`;
    await this.acquireLock(lockKey);
    try {
      const [user, packageItem] = await Promise.all([
        this.requireUserWithPhone(userId),
        this.prisma.package.findFirst({ where: { id: dto.packageId, status: ContentStatus.ACTIVE } })
      ]);
      if (!packageItem) throw new BusinessException(404402, '套餐不存在或已停用');
      const date = dayjs(dto.appointmentDate).startOf('day');
      if (!date.isValid() || date.isBefore(dayjs().startOf('day'))) throw new BusinessException(400405, '预约日期不能早于今天');
      const appointment = await this.prisma.appointment.create({
        data: {
          appointmentNo: await this.createAppointmentNo('TC'),
          userId,
          name: this.patientName(dto.name, user.name),
          phoneEncrypted: user.phoneEncrypted!,
          phoneHash: user.phoneHash!,
          phoneMasked: user.phoneMasked!,
          ageRange: user.ageRange || '未填写',
          missingTeethType: '套餐咨询',
          type: AppointmentType.PACKAGE_APPLICATION,
          packageId: packageItem.id,
          appointmentDate: date.toDate(),
          source: dto.source || 'mini_program_package',
          remark: `套餐申请：${packageItem.title}`
        },
        include: { clinic: true, doctor: true, dentalCategory: true, dentalProject: true, package: true }
      });
      await this.afterAppointmentCreated(appointment.id);
      return this.appointmentView(appointment);
    } catch (error) {
      await this.redis.del(lockKey).catch(() => undefined);
      throw error;
    }
  }

  /** 新个人中心记录接口；旧 /api/appointments/my 保持不变。 */
  async myRecords(userId: string, query: Record<string, string>) {
    const allowed = Object.values(AppointmentType);
    const type = allowed.includes(query.type as AppointmentType) ? (query.type as AppointmentType) : undefined;
    const rows = await this.prisma.appointment.findMany({
      where: { userId, ...(type ? { type } : {}) },
      include: { clinic: true, doctor: true, dentalCategory: true, dentalProject: true, package: true },
      orderBy: { createdAt: 'desc' }
    });
    return rows.map((row) => this.appointmentView(row));
  }

  /** 个人中心资料只返回脱敏信息与公众号关注状态。 */
  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { identities: { select: { subscribedOfficialAccount: true } } }
    });
    if (!user) throw new BusinessException(404301, '用户不存在');
    const config = await this.enterpriseHomeConfig();
    return {
      id: user.id,
      name: user.name,
      phoneMasked: user.phoneMasked,
      hasPhone: Boolean(user.phoneEncrypted),
      subscribedOfficialAccount: user.identities.some((item) => item.subscribedOfficialAccount),
      officialAccountName: String((config as Record<string, unknown>).officialAccountName || '')
    };
  }

  async enterpriseHomeConfig() {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'enterpriseHome' } });
    return {
      hospitalName: '官方口腔医院',
      slogan: '专业口腔诊疗服务',
      logo: '',
      customerServicePath: '',
      officialAccountName: '',
      ...((row?.valueJson && typeof row.valueJson === 'object' ? row.valueJson : {}) as Record<string, unknown>)
    };
  }

  // --- 同一后台使用的内容管理方法 ---
  adminBanners() { return this.prisma.homeBanner.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }] }); }
  adminAds() { return this.prisma.homeAd.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }] }); }
  adminCategories() { return this.prisma.dentalCategory.findMany({ include: { projects: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }); }
  adminProjects() { return this.prisma.dentalProject.findMany({ include: { category: true }, orderBy: [{ categoryId: 'asc' }, { sort: 'asc' }] }); }
  adminDoctors() { return this.prisma.doctor.findMany({ include: { department: true, clinic: true }, orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }] }); }
  adminSchedules(doctorId?: string) { return this.prisma.doctorSchedule.findMany({ where: doctorId ? { doctorId } : {}, include: { doctor: true, clinic: true }, orderBy: [{ date: 'asc' }, { sort: 'asc' }] }); }
  adminPackageCategories() { return this.prisma.packageCategory.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }); }
  adminPackages() { return this.prisma.package.findMany({ include: { category: true, images: { orderBy: { sort: 'asc' } } }, orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }] }); }

  async createBanner(data: any, audit: AuditContext) { const row = await this.prisma.homeBanner.create({ data: this.clean(data) }); await this.audit('CREATE', 'home_banners', row.id, undefined, row, audit); return row; }
  async updateBanner(id: string, data: any, audit: AuditContext) { return this.updateSimple('homeBanner', 'home_banners', id, data, audit); }
  async deleteBanner(id: string, audit: AuditContext) { return this.deleteSimple('homeBanner', 'home_banners', id, audit); }
  async createAd(data: any, audit: AuditContext) { const row = await this.prisma.homeAd.create({ data: this.clean(data) }); await this.audit('CREATE', 'home_ads', row.id, undefined, row, audit); return row; }
  async updateAd(id: string, data: any, audit: AuditContext) { return this.updateSimple('homeAd', 'home_ads', id, data, audit); }
  async deleteAd(id: string, audit: AuditContext) { return this.deleteSimple('homeAd', 'home_ads', id, audit); }
  async createCategory(data: any, audit: AuditContext) { const row = await this.prisma.dentalCategory.create({ data: this.clean(data) }); await this.audit('CREATE', 'dental_categories', row.id, undefined, row, audit); return row; }
  async updateCategory(id: string, data: any, audit: AuditContext) { return this.updateSimple('dentalCategory', 'dental_categories', id, data, audit); }
  async deleteCategory(id: string, audit: AuditContext) { const used = await this.prisma.dentalCategory.findUnique({ where: { id }, include: { _count: { select: { doctors: true, projects: true, appointments: true } } } }); if (!used) throw new BusinessException(404410, '科室不存在'); if (used._count.doctors + used._count.projects + used._count.appointments > 0) return this.updateCategory(id, { status: ContentStatus.DISABLED }, audit); return this.deleteSimple('dentalCategory', 'dental_categories', id, audit); }
  async createProject(data: any, audit: AuditContext) { const row = await this.prisma.dentalProject.create({ data: this.clean(data) }); await this.audit('CREATE', 'dental_projects', row.id, undefined, row, audit); return row; }
  async updateProject(id: string, data: any, audit: AuditContext) { return this.updateSimple('dentalProject', 'dental_projects', id, data, audit); }
  async deleteProject(id: string, audit: AuditContext) { const count = await this.prisma.appointment.count({ where: { dentalProjectId: id } }); if (count) return this.updateProject(id, { status: ContentStatus.DISABLED }, audit); return this.deleteSimple('dentalProject', 'dental_projects', id, audit); }

  async createDoctor(data: DoctorDto, audit: AuditContext) { const row = await this.prisma.doctor.create({ data: { ...this.clean(data), images: data.images || [] } as any }); await this.audit('CREATE', 'doctors', row.id, undefined, row, audit); return row; }
  async updateDoctor(id: string, data: DoctorDto, audit: AuditContext) { return this.updateSimple('doctor', 'doctors', id, { ...this.clean(data), images: data.images || [] }, audit); }
  async deleteDoctor(id: string, audit: AuditContext) { const count = await this.prisma.appointment.count({ where: { doctorId: id } }); if (count) return this.updateSimple('doctor', 'doctors', id, { status: ContentStatus.DISABLED }, audit); return this.deleteSimple('doctor', 'doctors', id, audit); }
  async createSchedule(data: DoctorScheduleDto, audit: AuditContext) { const row = await this.prisma.doctorSchedule.create({ data: { ...this.clean(data), date: dayjs(data.date).startOf('day').toDate() } as any }); await this.audit('CREATE', 'doctor_schedules', row.id, undefined, row, audit); return row; }
  async updateSchedule(id: string, data: DoctorScheduleDto, audit: AuditContext) { return this.updateSimple('doctorSchedule', 'doctor_schedules', id, { ...this.clean(data), date: dayjs(data.date).startOf('day').toDate() }, audit); }
  async deleteSchedule(id: string, audit: AuditContext) { return this.deleteSimple('doctorSchedule', 'doctor_schedules', id, audit); }
  async createPackageCategory(data: any, audit: AuditContext) { const row = await this.prisma.packageCategory.create({ data: this.clean(data) }); await this.audit('CREATE', 'package_categories', row.id, undefined, row, audit); return row; }
  async updatePackageCategory(id: string, data: any, audit: AuditContext) { return this.updateSimple('packageCategory', 'package_categories', id, data, audit); }
  async deletePackageCategory(id: string, audit: AuditContext) { const count = await this.prisma.package.count({ where: { categoryId: id } }); if (count) return this.updatePackageCategory(id, { status: ContentStatus.DISABLED }, audit); return this.deleteSimple('packageCategory', 'package_categories', id, audit); }
  async createPackage(data: PackageDto, audit: AuditContext) { const row = await this.prisma.package.create({ data: this.clean(data) as any }); await this.audit('CREATE', 'packages', row.id, undefined, row, audit); return row; }
  async updatePackage(id: string, data: PackageDto, audit: AuditContext) { return this.updateSimple('package', 'packages', id, data, audit); }
  async deletePackage(id: string, audit: AuditContext) { const count = await this.prisma.appointment.count({ where: { packageId: id } }); if (count) return this.updateSimple('package', 'packages', id, { status: ContentStatus.DISABLED }, audit); return this.deleteSimple('package', 'packages', id, audit); }

  /** 套餐详情图采用整组事务替换，确保排序和删除原子生效。 */
  async replacePackageImages(packageId: string, images: PackageImageItemDto[], audit: AuditContext) {
    const before = await this.prisma.packageImage.findMany({ where: { packageId }, orderBy: { sort: 'asc' } });
    await this.prisma.$transaction(async (transaction) => {
      await transaction.packageImage.deleteMany({ where: { packageId } });
      if (images.length) await transaction.packageImage.createMany({ data: images.map((item, index) => ({ packageId, imageUrl: item.imageUrl, sort: item.sort ?? index })) });
    });
    const after = await this.prisma.packageImage.findMany({ where: { packageId }, orderBy: { sort: 'asc' } });
    await this.audit('REPLACE_IMAGES', 'packages', packageId, before, after, audit);
    return after;
  }

  async updateEnterpriseHomeConfig(data: EnterpriseHomeConfigDto, audit: AuditContext) {
    const before = await this.enterpriseHomeConfig();
    const valueJson = { ...before, ...this.clean(data) } as Prisma.InputJsonValue;
    const row = await this.prisma.systemConfig.upsert({
      where: { key: 'enterpriseHome' },
      create: { key: 'enterpriseHome', description: '企业官方小程序首页配置', valueJson },
      update: { valueJson }
    });
    await this.audit('UPDATE', 'system_configs', 'enterpriseHome', before, valueJson, audit);
    return row.valueJson;
  }

  private async updateSimple(clientName: string, resourceType: string, id: string, data: any, audit: AuditContext) {
    const client = (this.prisma as any)[clientName];
    const before = await client.findUnique({ where: { id } });
    if (!before) throw new BusinessException(404410, '管理内容不存在');
    const row = await client.update({ where: { id }, data: this.clean(data) });
    await this.audit('UPDATE', resourceType, id, before, row, audit);
    return row;
  }

  private async deleteSimple(clientName: string, resourceType: string, id: string, audit: AuditContext) {
    const client = (this.prisma as any)[clientName];
    const before = await client.findUnique({ where: { id } });
    if (!before) throw new BusinessException(404410, '管理内容不存在');
    await client.delete({ where: { id } });
    await this.audit('DELETE', resourceType, id, before, undefined, audit);
    return { id, deleted: true };
  }

  private async audit(action: string, resourceType: string, resourceId: string, before: unknown, after: unknown, context: AuditContext) {
    await this.auditLogs.create({
      adminUserId: context.user.adminUserId,
      action: `${action}_${resourceType.toUpperCase()}`,
      resourceType,
      resourceId,
      beforeJson: before === undefined ? undefined : this.json(before),
      afterJson: after === undefined ? undefined : this.json(after),
      ip: context.ip,
      userAgent: context.userAgent
    });
  }

  private clean<T extends Record<string, any>>(data: T): T {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;
  }

  private json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }

  private async requireUserWithPhone(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BusinessException(404301, '用户不存在');
    if (!user.phoneEncrypted || !user.phoneHash || !user.phoneMasked) throw new BusinessException(400302, '请先授权手机号后再提交');
    return user;
  }

  private assertPrivacy(accepted: boolean) { if (!accepted) throw new BusinessException(400301, '请先阅读并勾选隐私协议'); }

  private async acquireLock(key: string) {
    const locked = await this.redis.set(key, '1', 'EX', 30, 'NX');
    if (locked !== 'OK') throw new BusinessException(409301, '您刚刚已经提交过申请，请勿重复点击', 409);
  }

  private patientName(input?: string, existing?: string | null) { return input?.trim() || existing?.trim() || '未填写'; }

  private async createAppointmentNo(prefix: 'YY' | 'TC') {
    for (let index = 0; index < 5; index += 1) {
      const no = `${prefix}${dayjs().format('YYYYMMDD')}${Math.floor(100000 + Math.random() * 900000)}`;
      if (!(await this.prisma.appointment.findUnique({ where: { appointmentNo: no } }))) return no;
    }
    return `${prefix}${dayjs().format('YYYYMMDDHHmmss')}${Math.floor(1000 + Math.random() * 9000)}`;
  }

  private async afterAppointmentCreated(id: string) {
    void this.followupForwarder.forwardAppointment(id).catch(() => undefined);
    await Promise.all([
      this.notifications.sendAppointmentSuccess(id).catch(() => undefined),
      this.notifications.sendStaffAppointmentNotice(id).catch(() => undefined)
    ]);
  }

  private doctorView(row: any) {
    return { ...row, images: Array.isArray(row.images) ? row.images : [], hospital: row.clinic?.name || '' };
  }

  private packageView(row: any) {
    return { ...row, originalPrice: String(row.originalPrice), salePrice: String(row.salePrice) };
  }

  private appointmentView(row: any) {
    return {
      id: row.id,
      appointmentNo: row.appointmentNo,
      type: row.type,
      typeText: this.typeText(row.type),
      name: row.name,
      phoneMasked: row.phoneMasked,
      status: row.status,
      statusText: this.statusText(row.status),
      clinic: row.clinic,
      doctor: row.doctor,
      dentalCategory: row.dentalCategory,
      dentalProject: row.dentalProject,
      package: row.package ? this.packageView(row.package) : null,
      appointmentDate: row.appointmentDate,
      appointmentTime: row.appointmentTime,
      symptomDescription: row.symptomDescription,
      gender: row.gender,
      createdAt: row.createdAt,
      expectedContactTime: '24 小时内'
    };
  }

  private typeText(type: AppointmentType) {
    return { LEGACY_REGISTRATION: '旧挂号', DOCTOR_APPOINTMENT: '医生预约', PACKAGE_APPLICATION: '套餐申请' }[type];
  }

  private statusText(status: AppointmentStatus) {
    return { PENDING_CONTACT: '待联系', CONTACTED: '已联系', CONFIRMED: '已确认', VISITED: '已到诊', CANCELLED: '已取消', INVALID: '无效线索' }[status];
  }
}
