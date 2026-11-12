import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import dayjs from 'dayjs';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/utils/business-exception';
import { CreateAppointmentDto, CreatePublicAppointmentDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';
import { FollowupForwarderService } from '../followup-forwarder/followup-forwarder.service';
import { CryptoService } from '../crypto/crypto.service';
import { ConfigsService, LandingPageConfig } from '../configs/configs.service';
import { WechatGroupNotificationsService } from '../wechat-group-notifications/wechat-group-notifications.service';

const POST_CREATE_JOB_KINDS = ['FOLLOWUP_FORWARD', 'USER_NOTICE', 'STAFF_NOTICE'] as const;

@Injectable()
export class AppointmentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppointmentsService.name);
  private postCreateTimer?: ReturnType<typeof setInterval>;
  private postCreateWorkerBusy = false;
  private lastPostCreateRecoveryScan = 0;
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly followupForwarder: FollowupForwarderService,
    private readonly crypto: CryptoService,
    private readonly configs: ConfigsService,
    @Inject('REDIS') private readonly redis: Redis,
    @Optional() private readonly groupNotifications?: WechatGroupNotificationsService
  ) {}

  onModuleInit() {
    this.postCreateTimer = setInterval(() => void this.runPostCreateWorker(), 5_000);
    this.postCreateTimer.unref?.();
    void this.runPostCreateWorker();
  }

  onModuleDestroy() { if (this.postCreateTimer) clearInterval(this.postCreateTimer); }

  async create(userId: string, dto: CreateAppointmentDto) {
    if (!dto.privacyAccepted) {
      throw new BusinessException(400301, '请先阅读并勾选隐私协议');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BusinessException(404301, '用户不存在');
    }
    if (!user.phoneEncrypted || !user.phoneHash || !user.phoneMasked) {
      throw new BusinessException(400302, '请先授权手机号后再提交挂号');
    }
    const landing = await this.configs.getLandingPage(dto.landingPageKey);
    this.validateLandingSelection(landing, dto);

    const lockKey = `appointment:create:${userId}:${landing.pageId || 'default'}`;
    const locked = await this.redis.set(lockKey, '1', 'EX', 30, 'NX');
    if (locked !== 'OK') {
      throw new BusinessException(409301, '您刚刚已经提交过挂号，请勿重复点击', 409);
    }

    const [appointment] = await this.prisma.$transaction([this.prisma.appointment.create({
      data: {
        appointmentNo: await this.createAppointmentNo(),
        userId,
        name: dto.name,
        phoneEncrypted: user.phoneEncrypted,
        phoneHash: user.phoneHash,
        phoneMasked: user.phoneMasked,
        ageRange: dto.ageRange,
        missingTeethType: dto.missingTeethType,
        clinicId: dto.clinicId || null,
        landingPageId: landing.pageId || null,
        source: dto.source || 'mini_program',
        remark: dto.remark,
        postCreateJobs: { create: POST_CREATE_JOB_KINDS.map((kind) => ({ kind })) }
      },
      include: { clinic: true }
    }), this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, ageRange: dto.ageRange }
    })]);

    await this.enqueueGroupNotice(appointment.id);
    this.dispatchPostCreateTasks();

    return this.toPublicDetail(appointment);
  }

  async createPublic(pageKey: string, dto: CreatePublicAppointmentDto) {
    if (!dto.privacyAccepted) {
      throw new BusinessException(400301, '请先阅读并勾选隐私协议');
    }
    const landing = await this.configs.getLandingPage(pageKey);
    this.validateLandingSelection(landing, dto);

    const phone = dto.phone.trim();
    if (!/^1\d{10}$/.test(phone)) {
      throw new BusinessException(400303, '请输入正确的 11 位手机号');
    }
    const phoneHash = this.crypto.hashPhone(phone);
    const lockKey = `appointment:public:create:${phoneHash}:${landing.pageId || pageKey}`;
    const locked = await this.redis.set(lockKey, '1', 'EX', 30, 'NX');
    if (locked !== 'OK') {
      throw new BusinessException(409301, '您刚刚已经提交过挂号，请勿重复点击', 409);
    }

    const phoneEncrypted = this.crypto.encryptPhone(phone);
    const phoneMasked = this.crypto.maskPhone(phone);
    const user = await this.prisma.user.upsert({
      where: { phoneHash },
      create: {
        name: dto.name.trim(),
        phoneEncrypted,
        phoneHash,
        phoneMasked,
        ageRange: dto.ageRange
      },
      update: {
        name: dto.name.trim(),
        phoneEncrypted,
        phoneMasked,
        ageRange: dto.ageRange
      }
    });

    const appointment = await this.prisma.appointment.create({
      data: {
        appointmentNo: await this.createAppointmentNo(),
        userId: user.id,
        name: dto.name.trim(),
        phoneEncrypted,
        phoneHash,
        phoneMasked,
        ageRange: dto.ageRange,
        missingTeethType: dto.missingTeethType,
        clinicId: dto.clinicId || null,
        landingPageId: landing.pageId || null,
        source: dto.source || `h5_${pageKey}`,
        remark: dto.remark,
        postCreateJobs: { create: POST_CREATE_JOB_KINDS.map((kind) => ({ kind })) }
      },
      include: { clinic: true }
    });

    await this.enqueueGroupNotice(appointment.id);
    this.dispatchPostCreateTasks();
    return this.toPublicDetail(appointment);
  }

  async findMine(userId: string) {
    const rows = await this.prisma.appointment.findMany({
      where: { userId },
      include: { clinic: true },
      orderBy: { createdAt: 'desc' }
    });
    return rows.map((row) => this.toPublicDetail(row));
  }

  async findMineDetail(userId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, userId },
      include: { clinic: true }
    });
    if (!appointment) {
      throw new BusinessException(404302, '挂号记录不存在');
    }
    return this.toPublicDetail(appointment);
  }

  private async createAppointmentNo(): Promise<string> {
    for (let index = 0; index < 5; index += 1) {
      const no = `GH${dayjs().format('YYYYMMDD')}${Math.floor(100000 + Math.random() * 900000)}`;
      const existed = await this.prisma.appointment.findUnique({ where: { appointmentNo: no } });
      if (!existed) {
        return no;
      }
    }
    return `GH${dayjs().format('YYYYMMDDHHmmss')}${Math.floor(1000 + Math.random() * 9000)}`;
  }

  private validateLandingSelection(
    landing: LandingPageConfig & { clinics?: Array<{ id: string }> },
    dto: Pick<CreateAppointmentDto, 'ageRange' | 'missingTeethType' | 'clinicId'>
  ) {
    if (!landing.formOptions.ageRanges.includes(dto.ageRange)) {
      throw new BusinessException(400304, '年龄段选项无效，请刷新页面后重试');
    }
    if (!landing.formOptions.missingTeethTypes.includes(dto.missingTeethType)) {
      throw new BusinessException(400305, '缺牙情况选项无效，请刷新页面后重试');
    }
    if (dto.clinicId && !landing.clinics?.some((clinic) => clinic.id === dto.clinicId)) {
      throw new BusinessException(400306, '门店选项无效，请刷新页面后重试');
    }
  }

  private dispatchPostCreateTasks() {
    void this.runPostCreateWorker();
  }

  private async runPostCreateWorker() {
    if (this.postCreateWorkerBusy) return;
    this.postCreateWorkerBusy = true;
    try {
      if (Date.now() - this.lastPostCreateRecoveryScan >= 60_000) {
        const staleAt = new Date(Date.now() - 5 * 60_000);
        await this.prisma.appointmentPostCreateJob.updateMany({ where: { status: 'PROCESSING', updatedAt: { lt: staleAt } }, data: { status: 'UNKNOWN', lastErrorCode: 'INTERRUPTED_NEEDS_REVIEW' } });
        this.lastPostCreateRecoveryScan = Date.now();
      }
      const job = await this.prisma.appointmentPostCreateJob.findFirst({
        where: { status: 'PENDING', attemptCount: { lt: 5 }, availableAt: { lte: new Date() } },
        orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }]
      });
      if (!job) return;
      const claimed = await this.prisma.appointmentPostCreateJob.updateMany({ where: { id: job.id, status: job.status, updatedAt: job.updatedAt }, data: { status: 'PROCESSING', attemptCount: { increment: 1 }, lastErrorCode: null } });
      if (!claimed.count) return;
      try {
        if (job.kind === 'FOLLOWUP_FORWARD') await this.followupForwarder.forwardAppointment(job.appointmentId);
        else if (job.kind === 'USER_NOTICE') await this.notifications.sendAppointmentSuccess(job.appointmentId);
        else if (job.kind === 'STAFF_NOTICE') await this.notifications.sendStaffAppointmentNotice(job.appointmentId);
        else throw new Error('UNSUPPORTED_JOB_KIND');
        await this.prisma.appointmentPostCreateJob.updateMany({ where: { id: job.id, status: 'PROCESSING' }, data: { status: 'SUCCEEDED', completedAt: new Date() } });
      } catch (error) {
        await this.prisma.appointmentPostCreateJob.updateMany({ where: { id: job.id, status: 'PROCESSING' }, data: { status: 'UNKNOWN', lastErrorCode: error instanceof Error ? error.name.slice(0, 100) : 'UNKNOWN' } });
      }
    } catch (error) {
      this.logger.error(`挂号后任务工作器异常：${error instanceof Error ? error.name : 'unknown'}`);
    } finally { this.postCreateWorkerBusy = false; }
  }

  private async enqueueGroupNotice(appointmentId: string) {
    try {
      await this.groupNotifications?.enqueueForAppointment(appointmentId);
    } catch (error) {
      // The appointment has already committed. The outbox scanner repairs missed jobs.
      this.logger.error(`群通知入队失败，等待补偿扫描: ${error instanceof Error ? error.name : 'unknown'}`);
    }
  }

  private toPublicDetail(appointment: {
    id: string;
    appointmentNo: string;
    name: string;
    phoneMasked: string;
    ageRange: string;
    missingTeethType: string;
    remark?: string | null;
    source?: string | null;
    createdAt: Date;
    clinic?: { id: string; name: string; address?: string | null; phone?: string | null } | null;
  }) {
    return {
      id: appointment.id,
      appointmentNo: appointment.appointmentNo,
      name: appointment.name,
      phoneMasked: appointment.phoneMasked,
      phoneTail: appointment.phoneMasked.slice(-4),
      ageRange: appointment.ageRange,
      missingTeethType: appointment.missingTeethType,
      clinic: appointment.clinic
        ? {
            id: appointment.clinic.id,
            name: appointment.clinic.name,
            address: appointment.clinic.address,
            phone: appointment.clinic.phone
          }
        : null,
      remark: appointment.remark,
      source: appointment.source,
      createdAt: appointment.createdAt,
      expectedContactTime: '24 小时内'
    };
  }

}
