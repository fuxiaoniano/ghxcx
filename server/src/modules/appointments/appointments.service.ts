import { Inject, Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/utils/business-exception';
import { CreateAppointmentDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';
import { FollowupForwarderService } from '../followup-forwarder/followup-forwarder.service';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly followupForwarder: FollowupForwarderService,
    @Inject('REDIS') private readonly redis: Redis
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

    const lockKey = `appointment:create:${userId}`;
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
        source: dto.source || 'mini_program',
        remark: dto.remark
      },
      include: { clinic: true }
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, ageRange: dto.ageRange }
    });

    void this.followupForwarder.forwardAppointment(appointment.id).catch(() => undefined);

    // 微信接口偶发超时不能拖慢或改变已经成功落库的挂号结果。
    void Promise.all([
      this.notifications.sendAppointmentSuccess(appointment.id).catch(() => undefined),
      this.notifications.sendStaffAppointmentNotice(appointment.id).catch(() => undefined)
    ]);

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
