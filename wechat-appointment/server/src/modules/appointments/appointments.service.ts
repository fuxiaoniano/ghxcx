import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
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

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly followupForwarder: FollowupForwarderService,
    private readonly crypto: CryptoService,
    private readonly configs: ConfigsService,
    @Inject('REDIS') private readonly redis: Redis,
    @Optional() private readonly groupNotifications?: WechatGroupNotificationsService
  ) {}

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

    const appointment = await this.prisma.appointment.create({
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
        remark: dto.remark
      },
      include: { clinic: true }
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, ageRange: dto.ageRange }
    });

    await this.enqueueGroupNotice(appointment.id);
    this.dispatchPostCreateTasks(appointment.id);

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
        remark: dto.remark
      },
      include: { clinic: true }
    });

    await this.enqueueGroupNotice(appointment.id);
    this.dispatchPostCreateTasks(appointment.id);
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

  private dispatchPostCreateTasks(appointmentId: string) {
    void this.followupForwarder.forwardAppointment(appointmentId).catch(() => undefined);

    // 微信接口偶发超时不能拖慢或改变已经成功落库的挂号结果。
    void Promise.all([
      this.notifications.sendAppointmentSuccess(appointmentId).catch(() => undefined),
      this.notifications.sendStaffAppointmentNotice(appointmentId).catch(() => undefined)
    ]);
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
