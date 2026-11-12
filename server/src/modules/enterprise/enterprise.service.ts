import { Inject, Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import Redis from 'ioredis';
import { unlink } from 'fs/promises';
import { basename, join, resolve, sep } from 'path';
import {
  AppointmentType,
  ContentStatus,
  DoctorScheduleStatus,
  Prisma
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/utils/business-exception';
import { normalizeUploadFilename } from '../../common/utils/upload-filename';
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
const POST_CREATE_JOB_KINDS = ['FOLLOWUP_FORWARD', 'USER_NOTICE', 'STAFF_NOTICE'] as const;

/** 新企业官网业务服务；所有写入均复用原 Prisma、用户、通知、回访和审计基础设施。 */
@Injectable()
export class EnterpriseService {
  constructor(
    private readonly prisma: PrismaService,
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
        include: { department: true, departments: { include: { department: true } }, clinic: true },
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
        ...(query.departmentId
          ? { OR: [{ departmentId: query.departmentId }, { departments: { some: { departmentId: query.departmentId } } }] }
          : {}),
        ...(keyword
          ? { OR: [{ name: { contains: keyword } }, { title: { contains: keyword } }, { specialty: { contains: keyword } }] }
          : {})
      },
      include: { department: true, departments: { include: { department: true } }, clinic: true },
      orderBy: [{ sort: 'asc' }, { recommend: 'desc' }, { createdAt: 'desc' }]
    });
    return rows.map((row) => this.doctorView(row));
  }

  async doctorDetail(id: string) {
    const row = await this.prisma.doctor.findFirst({
      where: { id, status: ContentStatus.ACTIVE },
      include: {
        department: true,
        departments: { include: { department: true } },
        clinic: true,
      }
    });
    if (!row) throw new BusinessException(404401, '医生不存在');
    await this.ensureDefaultSchedules(row.id, row.clinicId);
    const schedules = await this.prisma.doctorSchedule.findMany({
      where: {
        doctorId: row.id,
        status: { not: DoctorScheduleStatus.DISABLED },
        date: { gte: dayjs().startOf('day').toDate(), lte: dayjs().add(13, 'day').endOf('day').toDate() },
        timeSlot: { in: ['上午', '下午'] }
      },
      include: { clinic: true },
      orderBy: [{ date: 'asc' }, { sort: 'asc' }]
    });
    return {
      ...this.doctorView(row),
      schedules: schedules.map((schedule) => ({
        ...schedule,
        date: dayjs(schedule.date).format('YYYY-MM-DD')
      }))
    };
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
          include: { clinic: true, department: true, departments: true }
        }),
        this.prisma.dentalProject.findFirst({
          where: { id: dto.dentalProjectId, categoryId: dto.dentalCategoryId, status: ContentStatus.ACTIVE }
        })
      ]);
      const doctorDepartmentIds = doctor
        ? new Set([doctor.departmentId, ...(doctor.departments || []).map((item) => item.departmentId)])
        : new Set<string>();
      if (!doctor || !doctorDepartmentIds.has(dto.dentalCategoryId)) throw new BusinessException(400403, '医生与所选科室不匹配');
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
            remark: dto.symptomDescription,
            postCreateJobs: { create: POST_CREATE_JOB_KINDS.map((kind) => ({ kind })) }
          },
          include: { clinic: true, doctor: true, dentalCategory: true, dentalProject: true, package: true }
        });
      });
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
          remark: `套餐申请：${packageItem.title}`,
          postCreateJobs: { create: POST_CREATE_JOB_KINDS.map((kind) => ({ kind })) }
        },
        include: { clinic: true, doctor: true, dentalCategory: true, dentalProject: true, package: true }
      });
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
      hospitalName: String((config as Record<string, unknown>).hospitalName || ''),
      officialAccountName: String((config as Record<string, unknown>).officialAccountName || '')
    };
  }

  async enterpriseHomeConfig() {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'enterpriseHome' } });
    return {
      hospitalName: '傅小念口腔',
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
  adminDoctors() { return this.prisma.doctor.findMany({ include: { department: true, departments: { include: { department: true } }, clinic: true }, orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }] }); }
  adminClinics() { return this.prisma.clinic.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'asc' }] }); }
  async adminSchedules(doctorId?: string) {
    if (doctorId) {
      const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId }, select: { clinicId: true } });
      if (doctor) await this.ensureDefaultSchedules(doctorId, doctor.clinicId);
    }
    return this.prisma.doctorSchedule.findMany({ where: doctorId ? { doctorId } : {}, include: { doctor: true, clinic: true }, orderBy: [{ date: 'asc' }, { sort: 'asc' }] });
  }
  adminPackageCategories() { return this.prisma.packageCategory.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }); }
  adminPackages() { return this.prisma.package.findMany({ include: { category: true, images: { orderBy: { sort: 'asc' } } }, orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }] }); }
  async mediaAssets() {
    const assets = await this.prisma.mediaAsset.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
    return assets.map((asset) => ({ ...asset, name: normalizeUploadFilename(asset.name) }));
  }

  createMediaAsset(data: { name: string; url: string; mimeType: string; size: number; uploaderAdminId?: string }) {
    return this.prisma.mediaAsset.create({ data });
  }

  async deleteMediaAsset(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new BusinessException(404411, '图片素材不存在');

    const filePath = this.resolveMediaAssetPath(asset.url);
    try {
      // 先删除文件，失败时保留数据库记录，管理员可以在修复磁盘权限后再次操作。
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new BusinessException(500411, '删除图片原文件失败，请检查服务器文件权限');
      }
    }
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { id, deleted: true, fileDeleted: true };
  }

  private resolveMediaAssetPath(assetUrl: string) {
    let pathname = '';
    try {
      pathname = new URL(assetUrl, 'http://localhost').pathname;
    } catch {
      throw new BusinessException(400411, '图片文件地址无效，已拒绝删除');
    }

    const prefix = '/uploads/enterprise-assets/';
    if (!pathname.startsWith(prefix)) {
      throw new BusinessException(400411, '图片不属于系统上传目录，已拒绝删除');
    }

    let filename = '';
    try {
      filename = decodeURIComponent(pathname.slice(prefix.length));
    } catch {
      throw new BusinessException(400411, '图片文件名无效，已拒绝删除');
    }
    if (
      filename !== basename(filename) ||
      !/^[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp|gif)$/i.test(filename)
    ) {
      throw new BusinessException(400411, '图片文件名无效，已拒绝删除');
    }

    const directory = resolve(process.env.ENTERPRISE_ASSET_DIR || join(process.cwd(), 'uploads', 'enterprise-assets'));
    const filePath = resolve(directory, filename);
    if (!filePath.startsWith(`${directory}${sep}`)) {
      throw new BusinessException(400411, '图片文件路径越界，已拒绝删除');
    }
    return filePath;
  }

  async createBanner(data: any, audit: AuditContext) { const row = await this.prisma.homeBanner.create({ data: this.clean(data) }); await this.audit('CREATE', 'home_banners', row.id, undefined, row, audit); return row; }
  async updateBanner(id: string, data: any, audit: AuditContext) { return this.updateSimple('homeBanner', 'home_banners', id, data, audit); }
  async deleteBanner(id: string, audit: AuditContext) { return this.deleteSimple('homeBanner', 'home_banners', id, audit); }
  async createAd(data: any, audit: AuditContext) { const row = await this.prisma.homeAd.create({ data: this.clean(data) }); await this.audit('CREATE', 'home_ads', row.id, undefined, row, audit); return row; }
  async updateAd(id: string, data: any, audit: AuditContext) { return this.updateSimple('homeAd', 'home_ads', id, data, audit); }
  async deleteAd(id: string, audit: AuditContext) { return this.deleteSimple('homeAd', 'home_ads', id, audit); }
  async createCategory(data: any, audit: AuditContext) { const row = await this.prisma.dentalCategory.create({ data: this.clean(data) }); await this.audit('CREATE', 'dental_categories', row.id, undefined, row, audit); return row; }
  async updateCategory(id: string, data: any, audit: AuditContext) { return this.updateSimple('dentalCategory', 'dental_categories', id, data, audit); }
  async deleteCategory(id: string, audit: AuditContext) { const used = await this.prisma.dentalCategory.findUnique({ where: { id }, include: { _count: { select: { doctors: true, doctorLinks: true, projects: true, appointments: true } } } }); if (!used) throw new BusinessException(404410, '科室不存在'); if (used._count.doctors + used._count.doctorLinks + used._count.projects + used._count.appointments > 0) return this.updateCategory(id, { status: ContentStatus.DISABLED }, audit); return this.deleteSimple('dentalCategory', 'dental_categories', id, audit); }
  async createProject(data: any, audit: AuditContext) { const row = await this.prisma.dentalProject.create({ data: this.clean(data) }); await this.audit('CREATE', 'dental_projects', row.id, undefined, row, audit); return row; }
  async updateProject(id: string, data: any, audit: AuditContext) { return this.updateSimple('dentalProject', 'dental_projects', id, data, audit); }
  async deleteProject(id: string, audit: AuditContext) { const count = await this.prisma.appointment.count({ where: { dentalProjectId: id } }); if (count) return this.updateProject(id, { status: ContentStatus.DISABLED }, audit); return this.deleteSimple('dentalProject', 'dental_projects', id, audit); }

  async createDoctor(data: DoctorDto, audit: AuditContext) {
    const departmentIds = await this.doctorDepartmentIds(data);
    const { departmentIds: _departmentIds, ...doctorData } = this.clean(data);
    const row = await this.prisma.doctor.create({
      data: {
        ...doctorData,
        departmentId: departmentIds[0],
        images: data.images || [],
        departments: { create: departmentIds.map((departmentId) => ({ departmentId })) }
      } as any,
      include: { department: true, departments: { include: { department: true } }, clinic: true }
    });
    await this.audit('CREATE', 'doctors', row.id, undefined, row, audit);
    return row;
  }

  async updateDoctor(id: string, data: DoctorDto, audit: AuditContext) {
    const before = await this.prisma.doctor.findUnique({ where: { id }, include: { departments: true } });
    if (!before) throw new BusinessException(404410, '管理内容不存在');
    const departmentIds = await this.doctorDepartmentIds(data);
    const { departmentIds: _departmentIds, ...doctorData } = this.clean(data);
    const row = await this.prisma.$transaction(async (transaction) => {
      await transaction.doctorDepartment.deleteMany({ where: { doctorId: id } });
      return transaction.doctor.update({
        where: { id },
        data: {
          ...doctorData,
          departmentId: departmentIds[0],
          images: data.images || [],
          departments: { create: departmentIds.map((departmentId) => ({ departmentId })) }
        } as any,
        include: { department: true, departments: { include: { department: true } }, clinic: true }
      });
    });
    await this.audit('UPDATE', 'doctors', id, before, row, audit);
    return row;
  }
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

  private async doctorDepartmentIds(data: DoctorDto) {
    const ids = [...new Set([...(data.departmentIds || []), data.departmentId].filter(Boolean))];
    if (!ids.length) throw new BusinessException(400406, '请至少选择一个科室');
    const existing = await this.prisma.dentalCategory.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (existing.length !== ids.length) {
      throw new BusinessException(400406, '所选科室已失效，请重新选择后保存');
    }
    return ids;
  }

  private async ensureDefaultSchedules(doctorId: string, clinicId: string | null) {
    const rows = Array.from({ length: 14 }, (_, offset) => dayjs().add(offset, 'day')).flatMap((date) =>
      ['上午', '下午'].map((timeSlot, sort) => ({
        doctorId,
        clinicId,
        date: date.startOf('day').toDate(),
        timeSlot,
        capacity: 20,
        sort,
        status: DoctorScheduleStatus.AVAILABLE
      }))
    );
    await this.prisma.doctorSchedule.createMany({ data: rows, skipDuplicates: true });
  }

  private doctorView(row: any) {
    return {
      ...row,
      displayText: row.displayText || row.title,
      images: Array.isArray(row.images) ? row.images : [],
      departments: Array.isArray(row.departments) ? row.departments.map((item: any) => item.department) : [],
      hospital: row.clinic?.name || ''
    };
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
      clinic: row.clinic,
      doctor: row.doctor,
      dentalCategory: row.dentalCategory,
      dentalProject: row.dentalProject,
      package: row.package ? this.packageView(row.package) : null,
      appointmentDate: row.appointmentDate ? dayjs(row.appointmentDate).format('YYYY-MM-DD') : null,
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

}
