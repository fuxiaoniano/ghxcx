import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminInviteStatus,
  AdminRole,
  AdminStatus,
  AppointmentStatus,
  AppointmentType,
  ClinicStatus,
  ContentStatus,
  FollowupForwardStatus,
  ConsultationStatusCategory,
  NotificationChannel,
  NotificationStatus,
  Prisma
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import Redis from 'ioredis';
import { createHash, randomBytes } from 'crypto';
import { renameSync } from 'fs';
import { extname } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminCurrentUser } from '../../common/decorators/current-user.decorator';
import { BusinessException } from '../../common/utils/business-exception';
import { csvCell } from '../../common/utils/csv-cell';
import { AuthService } from '../auth/auth.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigsService } from '../configs/configs.service';
import {
  AppointmentNotifyConfig,
  FollowupForwardConfig,
  OfficialAccountMenuConfig,
  OfficialAutoReplyConfig
} from '../configs/configs.service';
import { WechatOfficialAccountService } from '../wechat-official-account/wechat-official-account.service';
import { FollowupForwarderService } from '../followup-forwarder/followup-forwarder.service';
import { ADMIN_PERMISSIONS, AdminLoginDto, CreateLandingPageDto } from './dto';
import { DataScopeService } from '../../common/data-scope/data-scope.service';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditLogsService,
    private readonly notifications: NotificationsService,
    private readonly followupForwarder: FollowupForwarderService,
    private readonly configsService: ConfigsService,
    private readonly officialAccount: WechatOfficialAccountService,
    private readonly config: ConfigService,
    @Inject('REDIS') private readonly redis: Redis,
    @Optional() private readonly dataScopes?: DataScopeService
  ) {}

  async login(dto: AdminLoginDto, ip?: string, userAgent?: string | string[]) {
    const failKey = `admin:login:fail:${dto.username}:${ip || 'unknown'}`;
    const fails = Number((await this.redis.get(failKey)) || 0);
    if (fails >= 5) {
      throw new BusinessException(401501, '登录失败次数过多，请 15 分钟后再试', 401);
    }
    const admin = await this.prisma.adminUser.findUnique({ where: { username: dto.username }, include: { customRole: true } });
    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      await this.markLoginFailed(failKey);
      throw new BusinessException(401502, '账号或密码错误', 401);
    }
    const ok = admin.passwordHash ? await bcrypt.compare(dto.password, admin.passwordHash) : false;
    if (!ok) {
      await this.markLoginFailed(failKey);
      throw new BusinessException(401502, '账号或密码错误', 401);
    }
    await this.redis.del(failKey);
    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() }
    });
    const permissions = this.parsePermissions(admin.customRole?.permissionsJson ?? admin.permissionsJson);
    await this.audit.create({
      adminUserId: admin.id,
      action: 'ADMIN_LOGIN',
      resourceType: 'admin_users',
      resourceId: admin.id,
      afterJson: { username: admin.username },
      ip,
      userAgent: this.ua(userAgent)
    });
    const token = this.auth.signAdmin({
      adminUserId: admin.id,
      username: admin.username,
      nickname: admin.nickname || admin.username,
      role: admin.role,
      roleName: admin.customRole?.name,
      permissions
    });
    return {
      token,
      user: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname || admin.username,
        role: admin.role,
        roleName: admin.customRole?.name,
        permissions,
        dataScope: admin.role === AdminRole.SUPER_ADMIN ? 'ALL' : (admin.customRole?.dataScope ?? admin.dataScope),
        dataScopeMemberIds: this.parseStringArray(admin.customRole?.dataScopeMemberIds ?? admin.dataScopeMemberIds),
        teamId: admin.teamId
      }
    };
  }

  async createWechatLoginSession() {
    const sessionId = randomBytes(24).toString('hex');
    await this.redis.set(this.wechatLoginKey(sessionId), JSON.stringify({ status: 'PENDING' }), 'EX', 300);
    const base = (this.config.get<string>('SERVER_BASE_URL') || 'https://wechat.fuxiaonian.net').replace(/\/$/, '');
    return {
      sessionId,
      status: 'PENDING',
      oauthUrl: `${base}/api/admin/auth/wechat/oauth?sessionId=${encodeURIComponent(sessionId)}`,
      expiresIn: 300
    };
  }

  async wechatLoginOauthUrl(sessionId: string) {
    const session = await this.readWechatLoginSession(sessionId);
    if (!session || session.status !== 'PENDING') {
      throw new BusinessException(400520, '登录二维码已失效，请刷新后重试');
    }
    return this.officialAccount.buildAdminOauthUrl('/api/admin/auth/wechat/callback', sessionId);
  }

  async completeWechatLogin(code: string, sessionId: string) {
    const session = await this.readWechatLoginSession(sessionId);
    if (!session || session.status !== 'PENDING') {
      return { success: false, message: '登录二维码已失效，请返回电脑刷新二维码。' };
    }
    const identity = await this.officialAccount.resolveOauthIdentity(code);
    const admin = await this.prisma.adminUser.findUnique({ where: { oaOpenId: identity.oaOpenId } });
    if (!admin) {
      await this.redis.set(
        this.wechatLoginKey(sessionId),
        JSON.stringify({ status: 'ERROR', message: '此微信尚未绑定后台账号，请联系超级管理员。' }),
        'EX',
        90
      );
      return { success: false, message: '此微信尚未绑定后台账号，请联系超级管理员。' };
    }
    if (admin.status !== AdminStatus.ACTIVE) {
      await this.redis.set(
        this.wechatLoginKey(sessionId),
        JSON.stringify({ status: 'ERROR', message: '后台账号已停用。' }),
        'EX',
        90
      );
      return { success: false, message: '后台账号已停用，请联系超级管理员。' };
    }
    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        unionId: admin.unionId || identity.unionId,
        subscribedOfficialAccount: identity.subscribed
      }
    });
    await this.redis.set(
      this.wechatLoginKey(sessionId),
      JSON.stringify({ status: 'CONFIRMED', adminUserId: admin.id }),
      'EX',
      90
    );
    return { success: true, message: '电脑端正在登录，请返回电脑继续操作。' };
  }

  async pollWechatLoginSession(sessionId: string, ip?: string, userAgent?: string | string[]) {
    const session = await this.readWechatLoginSession(sessionId);
    if (!session) {
      return { status: 'EXPIRED' };
    }
    if (session.status !== 'CONFIRMED' || !session.adminUserId) {
      return { status: session.status, message: session.message };
    }
    const admin = await this.prisma.adminUser.findUnique({ where: { id: session.adminUserId }, include: { customRole: true } });
    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      return { status: 'ERROR', message: '后台账号不存在或已停用' };
    }
    const permissions = this.parsePermissions(admin.customRole?.permissionsJson ?? admin.permissionsJson);
    await this.prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    await this.audit.create({
      adminUserId: admin.id,
      action: 'ADMIN_WECHAT_LOGIN',
      resourceType: 'admin_users',
      resourceId: admin.id,
      afterJson: { nickname: admin.nickname || admin.username },
      ip,
      userAgent: this.ua(userAgent)
    });
    await this.redis.del(this.wechatLoginKey(sessionId));
    return {
      status: 'CONFIRMED',
      token: this.auth.signAdmin({
        adminUserId: admin.id,
        username: admin.username,
        nickname: admin.nickname || admin.username,
        role: admin.role,
        roleName: admin.customRole?.name,
        permissions,
        dataScope: admin.role === AdminRole.SUPER_ADMIN ? 'ALL' : (admin.customRole?.dataScope ?? admin.dataScope),
        dataScopeMemberIds: this.parseStringArray(admin.customRole?.dataScopeMemberIds ?? admin.dataScopeMemberIds),
        teamId: admin.teamId
      }),
      user: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname || admin.username,
        role: admin.role,
        roleName: admin.customRole?.name,
        permissions,
        dataScope: admin.role === AdminRole.SUPER_ADMIN ? 'ALL' : (admin.customRole?.dataScope ?? admin.dataScope),
        dataScopeMemberIds: this.parseStringArray(admin.customRole?.dataScopeMemberIds ?? admin.dataScopeMemberIds),
        teamId: admin.teamId
      }
    };
  }

  async dashboard(user: AdminCurrentUser) {
    const todayStart = dayjs().startOf('day').toDate();
    const sevenDaysAgo = dayjs().subtract(6, 'day').startOf('day').toDate();
    const appointmentScope = await this.scopedAppointmentWhere({}, user);
    const notificationScope: Prisma.NotificationLogWhereInput = { appointment: appointmentScope };
    const [
      todayCount,
      totalCount,
      pendingCount,
      confirmedCount,
      notificationTotal,
      notificationSuccess,
      recentAppointments,
      trendRows
    ] = await Promise.all([
      this.prisma.appointment.count({ where: { AND: [appointmentScope, { createdAt: { gte: todayStart } }] } }),
      this.prisma.appointment.count({ where: appointmentScope }),
      this.prisma.appointment.count({ where: { AND: [appointmentScope, { status: AppointmentStatus.PENDING_CONTACT }] } }),
      this.prisma.appointment.count({ where: { AND: [appointmentScope, { status: AppointmentStatus.CONFIRMED }] } }),
      this.prisma.notificationLog.count({ where: notificationScope }),
      this.prisma.notificationLog.count({ where: { AND: [notificationScope, { status: NotificationStatus.SUCCESS }] } }),
      this.prisma.appointment.findMany({
        where: appointmentScope,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { clinic: true }
      }),
      this.prisma.appointment.findMany({
        where: { AND: [appointmentScope, { createdAt: { gte: sevenDaysAgo } }] },
        select: { createdAt: true }
      })
    ]);
    const trend = Array.from({ length: 7 }).map((_, index) => {
      const date = dayjs().subtract(6 - index, 'day').format('YYYY-MM-DD');
      return {
        date,
        count: trendRows.filter((row) => dayjs(row.createdAt).format('YYYY-MM-DD') === date).length
      };
    });
    return {
      todayCount,
      totalCount,
      pendingCount,
      confirmedCount,
      notificationSuccessRate: notificationTotal === 0 ? 0 : Number((notificationSuccess / notificationTotal).toFixed(4)),
      trend,
      recentAppointments: recentAppointments.map((row) => this.appointmentListItem(row))
    };
  }

  async users(query: Record<string, string>, admin: AdminCurrentUser) {
    const page = this.page(query.page);
    const pageSize = this.pageSize(query.pageSize);
    const where: Prisma.UserWhereInput = {};
    const appointmentScope = await this.scopedAppointmentWhere({}, admin);
    if (Object.keys(appointmentScope).length) where.appointments = { some: appointmentScope };
    if (query.keyword) {
      const trimmed = query.keyword.trim();
      where.OR = [
        { name: { contains: trimmed } },
        /^\d{7,}$/.test(trimmed) ? { phoneHash: this.crypto.hashPhone(trimmed) } : { phoneMasked: { contains: trimmed } }
      ];
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        gte: query.dateFrom ? dayjs(query.dateFrom).startOf('day').toDate() : undefined,
        lte: query.dateTo ? dayjs(query.dateTo).endOf('day').toDate() : undefined
      };
    }
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { identities: true }
      })
    ]);
    return {
      total,
      page,
      pageSize,
      list: rows.map((row) => ({
        id: row.id,
        name: row.name,
        phoneMasked: row.phoneMasked,
        ageRange: row.ageRange,
        status: row.status,
        createdAt: row.createdAt,
        lastLoginAt: row.lastLoginAt,
        wechat: {
          hasMiniOpenId: row.identities.some((identity) => Boolean(identity.miniOpenId)),
          hasOfficialAccountOpenId: row.identities.some((identity) => Boolean(identity.oaOpenId)),
          hasUnionId: row.identities.some((identity) => Boolean(identity.unionId))
        }
      }))
    };
  }

  async userDetail(id: string, admin: AdminCurrentUser) {
    const appointmentScope = await this.scopedAppointmentWhere({}, admin);
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        identities: true,
        appointments: { where: appointmentScope, orderBy: { createdAt: 'desc' }, include: { clinic: true } }
      }
    });
    if (!user) {
      throw new BusinessException(404501, '用户不存在');
    }
    if (Object.keys(appointmentScope).length && user.appointments.length === 0) throw new BusinessException(403011, '无权访问该用户数据', 403);
    return {
      id: user.id,
      name: user.name,
      phoneMasked: user.phoneMasked,
      ageRange: user.ageRange,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      wechatIdentities: user.identities.map((identity) => ({
        id: identity.id,
        hasMiniOpenId: Boolean(identity.miniOpenId),
        hasOfficialAccountOpenId: Boolean(identity.oaOpenId),
        hasUnionId: Boolean(identity.unionId),
        subscribedOfficialAccount: identity.subscribedOfficialAccount,
        createdAt: identity.createdAt
      })),
      appointments: user.appointments.map((row) => this.appointmentListItem(row))
    };
  }

  async revealUserPhone(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    if (!this.canViewFullPhone(user)) {
      throw new BusinessException(403503, '当前账号无查看完整手机号权限', 403);
    }
    const row = await this.prisma.user.findUnique({ where: { id } });
    if (!row) {
      throw new BusinessException(404501, '用户不存在');
    }
    if (!row.phoneEncrypted || !row.phoneMasked) {
      throw new BusinessException(400501, '该用户尚未授权手机号');
    }
    const appointmentScope = await this.scopedAppointmentWhere({}, user);
    if (Object.keys(appointmentScope).length) {
      const visible = await this.prisma.appointment.count({ where: { AND: [appointmentScope, { userId: id }] } });
      if (!visible) throw new BusinessException(403011, '无权访问该用户数据', 403);
    }
    const phone = this.crypto.decryptPhone(row.phoneEncrypted);
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'REVEAL_USER_FULL_PHONE',
      resourceType: 'users',
      resourceId: id,
      afterJson: { phoneMasked: row.phoneMasked },
      ip,
      userAgent: this.ua(userAgent)
    });
    return { phone };
  }

  async appointments(query: Record<string, string>, user: AdminCurrentUser) {
    const page = this.page(query.page);
    const pageSize = this.pageSize(query.pageSize);
    const where = await this.scopedAppointmentWhere(query, user);
    const [total, rows] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { clinic: true, assignedTo: true, doctor: true, dentalCategory: true, dentalProject: true, package: true }
      })
    ]);
    return {
      total,
      page,
      pageSize,
      list: rows.map((row) => this.appointmentListItem(row))
    };
  }

  async appointmentDetail(id: string, user: AdminCurrentUser) {
    const row = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        clinic: true,
        assignedTo: true,
        doctor: true,
        dentalCategory: true,
        dentalProject: true,
        package: true,
        notifications: { orderBy: { createdAt: 'desc' } }
      }
    });
    if (!row) {
      throw new BusinessException(404502, '挂号记录不存在');
    }
    await this.assertAppointmentScope(row, user);
    return {
      ...this.appointmentListItem(row),
      remark: row.remark,
      adminRemark: row.adminRemark,
      contactedAt: row.contactedAt,
      confirmedAt: row.confirmedAt,
      cancelledAt: row.cancelledAt,
      notifications: row.notifications
    };
  }

  async revealAppointmentPhone(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    if (!this.canViewFullPhone(user)) {
      throw new BusinessException(403503, '当前账号无查看完整手机号权限', 403);
    }
    const row = await this.prisma.appointment.findUnique({ where: { id } });
    if (!row) {
      throw new BusinessException(404502, '挂号记录不存在');
    }
    await this.assertAppointmentScope(row, user);
    const phone = this.crypto.decryptPhone(row.phoneEncrypted);
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'REVEAL_FULL_PHONE',
      resourceType: 'appointments',
      resourceId: id,
      afterJson: { appointmentNo: row.appointmentNo, phoneMasked: row.phoneMasked },
      ip,
      userAgent: this.ua(userAgent)
    });
    return { phone };
  }

  async updateAppointmentStatus(
    id: string,
    status: AppointmentStatus,
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    const before = await this.prisma.appointment.findUnique({ where: { id } });
    if (!before) {
      throw new BusinessException(404502, '挂号记录不存在');
    }
    await this.assertAppointmentScope(before, user);
    const now = new Date();
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status,
        contactedAt: status === AppointmentStatus.CONTACTED ? now : before.contactedAt,
        confirmedAt: status === AppointmentStatus.CONFIRMED ? now : before.confirmedAt,
        cancelledAt: status === AppointmentStatus.CANCELLED ? now : before.cancelledAt
      },
      include: { clinic: true, assignedTo: true }
    });
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'UPDATE_APPOINTMENT_STATUS',
      resourceType: 'appointments',
      resourceId: id,
      beforeJson: { status: before.status },
      afterJson: { status },
      ip,
      userAgent: this.ua(userAgent)
    });
    return this.appointmentListItem(updated);
  }

  async updateAppointmentRemark(
    id: string,
    adminRemark: string,
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    const before = await this.prisma.appointment.findUnique({ where: { id } });
    if (!before) {
      throw new BusinessException(404502, '挂号记录不存在');
    }
    await this.assertAppointmentScope(before, user);
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { adminRemark },
      include: { clinic: true, assignedTo: true }
    });
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'UPDATE_APPOINTMENT_REMARK',
      resourceType: 'appointments',
      resourceId: id,
      beforeJson: { adminRemark: before.adminRemark },
      afterJson: { adminRemark },
      ip,
      userAgent: this.ua(userAgent)
    });
    return this.appointmentListItem(updated);
  }

  async assignAppointment(
    id: string,
    adminUserId: string | undefined,
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    const before = await this.prisma.appointment.findUnique({ where: { id } });
    if (!before) {
      throw new BusinessException(404502, '挂号记录不存在');
    }
    await this.assertAppointmentScope(before, user);
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { assignedToAdminId: adminUserId || null },
      include: { clinic: true, assignedTo: true }
    });
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'ASSIGN_APPOINTMENT',
      resourceType: 'appointments',
      resourceId: id,
      beforeJson: { assignedToAdminId: before.assignedToAdminId },
      afterJson: { assignedToAdminId: adminUserId || null },
      ip,
      userAgent: this.ua(userAgent)
    });
    return this.appointmentListItem(updated);
  }

  async resendNotification(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const row = await this.prisma.appointment.findUnique({ where: { id } });
    if (!row) {
      throw new BusinessException(404502, '挂号记录不存在');
    }
    await this.assertAppointmentScope(row, user);
    const result = await this.notifications.sendAppointmentSuccess(id);
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'RESEND_NOTIFICATION',
      resourceType: 'appointments',
      resourceId: id,
      afterJson: result,
      ip,
      userAgent: this.ua(userAgent)
    });
    return result;
  }

  async resendFollowupForward(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const row = await this.prisma.appointment.findUnique({ where: { id } });
    if (!row) {
      throw new BusinessException(404502, '挂号记录不存在');
    }
    await this.assertAppointmentScope(row, user);
    const result = await this.followupForwarder.forwardAppointment(id, { force: true });
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'RESEND_FOLLOWUP_FORWARD',
      resourceType: 'appointments',
      resourceId: id,
      afterJson: result as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return result;
  }

  async notificationLogs(query: Record<string, string>, user: AdminCurrentUser) {
    const page = this.page(query.page);
    const pageSize = this.pageSize(query.pageSize);
    const where: Prisma.NotificationLogWhereInput = {};
    const appointmentScope = await this.scopedAppointmentWhere({}, user);
    if (Object.keys(appointmentScope).length) where.appointment = appointmentScope;
    if (query.channel && Object.values(NotificationChannel).includes(query.channel as NotificationChannel)) {
      where.channel = query.channel as NotificationChannel;
    }
    if (query.status && Object.values(NotificationStatus).includes(query.status as NotificationStatus)) {
      where.status = query.status as NotificationStatus;
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        gte: query.dateFrom ? dayjs(query.dateFrom).startOf('day').toDate() : undefined,
        lte: query.dateTo ? dayjs(query.dateTo).endOf('day').toDate() : undefined
      };
    }
    const [total, rows] = await Promise.all([
      this.prisma.notificationLog.count({ where }),
      this.prisma.notificationLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' }
      })
    ]);
    return { total, page, pageSize, list: rows };
  }

  async retryNotification(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const notification = await this.prisma.notificationLog.findUnique({ where: { id }, include: { appointment: true } });
    if (!notification) throw new BusinessException(404503, '通知记录不存在', 404);
    if (notification.appointment) await this.assertAppointmentScope(notification.appointment, user);
    const result = await this.notifications.retryNotification(id);
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'RETRY_NOTIFICATION_LOG',
      resourceType: 'notification_logs',
      resourceId: id,
      afterJson: result,
      ip,
      userAgent: this.ua(userAgent)
    });
    return result;
  }

  async auditLogs(query: Record<string, string>) {
    const page = this.page(query.page);
    const pageSize = this.pageSize(query.pageSize);
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) {
      where.action = query.action;
    }
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { adminUser: { select: { username: true, role: true } } }
      })
    ]);
    return { total, page, pageSize, list: rows };
  }

  configs() {
    // 通用配置接口仅保留旧落地页兼容项；公众号密钥、回访 Token、工资规则等
    // 必须通过各自的专用权限接口读取，不能原样暴露整张 system_configs。
    return this.prisma.systemConfig.findMany({
      where: { key: 'landingPage' },
      orderBy: { key: 'asc' }
    });
  }

  landingPages() {
    return this.configsService.listLandingPages();
  }

  landingPage(id: string) {
    return this.configsService.getLandingPageAdmin(id);
  }

  async createLandingPage(
    dto: CreateLandingPageDto,
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    this.requireConfigPermission(user);
    const page = await this.configsService.createLandingPage(dto.name, dto.cloneFromId);
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'CREATE_LANDING_PAGE',
      resourceType: 'landing_pages',
      resourceId: page.id,
      afterJson: page as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return page;
  }

  async updateLandingPage(
    id: string,
    dto: { name?: string; status?: ContentStatus; config?: Record<string, unknown> },
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    this.requireConfigPermission(user);
    const before = await this.configsService.getLandingPageAdmin(id);
    const page = await this.configsService.updateLandingPage(id, dto);
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'UPDATE_LANDING_PAGE',
      resourceType: 'landing_pages',
      resourceId: id,
      beforeJson: before as unknown as Prisma.InputJsonValue,
      afterJson: page as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return page;
  }

  async setDefaultLandingPage(
    id: string,
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    this.requireConfigPermission(user);
    const page = await this.configsService.setDefaultLandingPage(id);
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'SET_DEFAULT_LANDING_PAGE',
      resourceType: 'landing_pages',
      resourceId: id,
      afterJson: page as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return page;
  }

  async deleteLandingPage(
    id: string,
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    this.requireConfigPermission(user);
    const result = await this.configsService.deleteLandingPage(id);
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'DELETE_LANDING_PAGE',
      resourceType: 'landing_pages',
      resourceId: id,
      afterJson: result as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return result;
  }

  async updateConfigs(
    configs: Array<{ key: string; valueJson: Record<string, unknown>; description?: string }>,
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    this.requireConfigPermission(user);
    const allowedKeys = new Set(['landingPage']);
    const invalidKeys = configs.map((item) => item.key).filter((key) => !allowedKeys.has(key));
    if (invalidKeys.length) {
      throw new BusinessException(403509, '该配置必须通过对应的专用设置页面修改', 403);
    }
    const before = await this.prisma.systemConfig.findMany({
      where: { key: { in: configs.map((item) => item.key) } }
    });
    const result = await this.configsService.updateMany(
      configs.map((item) => ({
        key: item.key,
        valueJson: item.valueJson as Prisma.InputJsonValue,
        description: item.description
      }))
    );
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'UPDATE_SYSTEM_CONFIGS',
      resourceType: 'system_configs',
      beforeJson: before as unknown as Prisma.InputJsonValue,
      afterJson: configs as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return result;
  }

  async followupForwardConfig() {
    const config = await this.configsService.getFollowupForwardConfig();
    return this.publicFollowupForwardConfig(config);
  }

  async updateFollowupForwardConfig(
    dto: Partial<FollowupForwardConfig>,
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    this.requireConfigPermission(user);
    const before = await this.configsService.getFollowupForwardConfig();
    const patch = { ...dto };
    if (patch.authToken !== undefined && !String(patch.authToken).trim()) {
      delete patch.authToken;
    }
    const next = await this.configsService.updateFollowupForwardConfig(patch);
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'UPDATE_FOLLOWUP_FORWARD_CONFIG',
      resourceType: 'system_configs',
      resourceId: 'followupForward',
      beforeJson: this.publicFollowupForwardConfig(before) as unknown as Prisma.InputJsonValue,
      afterJson: this.publicFollowupForwardConfig(next) as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return this.publicFollowupForwardConfig(next);
  }

  landingAssetUrl(file: { originalname?: string; filename: string; path: string }) {
    const ext = extname(file.originalname || '').toLowerCase() || '.jpg';
    const filename = `${file.filename}${ext}`;
    renameSync(file.path, `${file.path}${ext}`);
    const base = this.config.get<string>('SERVER_BASE_URL') || 'https://wechat.fuxiaonian.net';
    return { url: `${base.replace(/\/$/, '')}/uploads/landing-assets/${filename}` };
  }

  async officialAccountMenu() {
    return this.configsService.getOfficialAccountMenu();
  }

  async updateOfficialAccountMenu(
    menu: OfficialAccountMenuConfig,
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    const before = await this.configsService.getOfficialAccountMenu();
    const [row] = await this.configsService.updateMany([
      {
        key: 'officialAccountMenu',
        valueJson: menu as unknown as Prisma.InputJsonValue,
        description: '微信公众号自定义菜单配置'
      }
    ]);
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'UPDATE_OFFICIAL_ACCOUNT_MENU',
      resourceType: 'system_configs',
      resourceId: 'officialAccountMenu',
      beforeJson: before as unknown as Prisma.InputJsonValue,
      afterJson: menu as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return row.valueJson;
  }

  async publishOfficialAccountMenu(user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const menu = await this.configsService.getOfficialAccountMenu();
    const result = await this.officialAccount.publishCustomMenu(menu);
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'PUBLISH_OFFICIAL_ACCOUNT_MENU',
      resourceType: 'official_account_menu',
      afterJson: { menu, result } as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return { published: true, result };
  }

  async officialAutoReply() {
    return this.configsService.getOfficialAutoReplyConfig();
  }

  async updateOfficialAutoReply(
    autoReply: OfficialAutoReplyConfig,
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    const before = await this.configsService.getOfficialAutoReplyConfig();
    const normalized = this.normalizeOfficialAutoReply(autoReply);
    const [row] = await this.configsService.updateMany([
      {
        key: 'officialAutoReply',
        valueJson: normalized as unknown as Prisma.InputJsonValue,
        description: '微信公众号自动回复配置'
      }
    ]);
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'UPDATE_OFFICIAL_AUTO_REPLY',
      resourceType: 'system_configs',
      resourceId: 'officialAutoReply',
      beforeJson: before as unknown as Prisma.InputJsonValue,
      afterJson: normalized as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return row.valueJson;
  }

  private normalizeOfficialAutoReply(value: Partial<OfficialAutoReplyConfig>): OfficialAutoReplyConfig {
    const text = (input: unknown, max = 600) => String(input || '').trim().slice(0, max);
    const keywordRules = Array.isArray(value.keywordRules)
      ? value.keywordRules
          .slice(0, 50)
          .map((rule, index) => ({
            id: text(rule.id, 80) || `rule-${Date.now()}-${index}`,
            keyword: text(rule.keyword, 50),
            matchMode: rule.matchMode === 'EXACT' ? 'EXACT' as const : 'CONTAINS' as const,
            replyContent: text(rule.replyContent, 600),
            enabled: Boolean(rule.enabled),
            createdAt: text(rule.createdAt, 40) || new Date().toISOString()
          }))
          .filter((rule) => rule.keyword && rule.replyContent)
      : [];
    const subscribeMiniProgramEnabled = value.subscribeMiniProgramEnabled === true;
    const subscribeMiniProgramType = value.subscribeMiniProgramType === 'CARD' ? 'CARD' as const : 'LINK' as const;
    const subscribeMiniProgramAppId = text(
      value.subscribeMiniProgramAppId || this.config.get<string>('MINI_APP_ID'),
      32
    );
    const subscribeMiniProgramPagePath = text(value.subscribeMiniProgramPagePath, 1024) ||
      'pages/home/home?source=oa_subscribe';
    const subscribeMiniProgramLinkText = text(value.subscribeMiniProgramLinkText, 100) ||
      '点击进入傅小念口腔服务';
    const subscribeMiniProgramCardTitle = text(value.subscribeMiniProgramCardTitle, 100) ||
      '傅小念口腔预约挂号';
    const subscribeMiniProgramCoverUrl = text(value.subscribeMiniProgramCoverUrl, 1000);
    if (subscribeMiniProgramEnabled && !/^wx[a-zA-Z0-9]{16}$/.test(subscribeMiniProgramAppId)) {
      throw new BusinessException(400551, '小程序 AppID 格式不正确');
    }
    if (
      subscribeMiniProgramEnabled &&
      (!/^[a-zA-Z0-9_][a-zA-Z0-9_./?=&%-]*$/.test(subscribeMiniProgramPagePath) ||
        subscribeMiniProgramPagePath.startsWith('/') ||
        subscribeMiniProgramPagePath.includes('..'))
    ) {
      throw new BusinessException(400552, '小程序页面路径格式不正确，请填写 pages/ 开头的 PagePath');
    }
    if (subscribeMiniProgramEnabled && !subscribeMiniProgramPagePath.startsWith('pages/')) {
      throw new BusinessException(400552, '小程序页面路径格式不正确，请填写 pages/ 开头的 PagePath');
    }
    if (subscribeMiniProgramEnabled && subscribeMiniProgramType === 'CARD' && !subscribeMiniProgramCoverUrl) {
      throw new BusinessException(400553, '发送小程序卡片时必须选择卡片封面图片');
    }
    if (subscribeMiniProgramEnabled && subscribeMiniProgramType === 'CARD') {
      const publicBase = this.config.get<string>('SERVER_BASE_URL') || 'https://wechat.fuxiaonian.net';
      let coverUrl: URL;
      try {
        coverUrl = new URL(subscribeMiniProgramCoverUrl, publicBase);
      } catch {
        throw new BusinessException(400554, '小程序卡片封面图片地址无效');
      }
      const allowedPath =
        coverUrl.pathname.startsWith('/uploads/enterprise-assets/') ||
        coverUrl.pathname.startsWith('/uploads/landing-assets/');
      const validExtension = /\.(?:jpe?g|png)$/i.test(coverUrl.pathname);
      if (coverUrl.origin !== new URL(publicBase).origin || !allowedPath || !validExtension) {
        throw new BusinessException(400554, '小程序卡片封面必须选择本系统图片库中的 JPG 或 PNG 图片');
      }
    }
    return {
      enabled: value.enabled !== false,
      subscribeReplyEnabled: value.subscribeReplyEnabled !== false,
      subscribeReply:
        text(value.subscribeReply) ||
        '欢迎关注！如需种植牙咨询或预约挂号，请点击公众号菜单“立即挂号”提交信息，工作人员会尽快联系您。',
      subscribeMiniProgramEnabled,
      subscribeMiniProgramType,
      subscribeMiniProgramAppId,
      subscribeMiniProgramPagePath,
      subscribeMiniProgramLinkText,
      subscribeMiniProgramCardTitle,
      subscribeMiniProgramCoverUrl,
      messageReplyEnabled: value.messageReplyEnabled !== false,
      messageReply:
        text(value.messageReply) ||
        '您好，已收到您的消息。如需预约挂号，请点击公众号菜单“立即挂号”；如需人工协助，工作人员会尽快查看并联系您。',
      keywordReplyEnabled: value.keywordReplyEnabled !== false,
      keywordRules
    };
  }

  officialAccountBinding() { return this.officialAccount.bindingStatus(); }

  async updateOfficialAccountBinding(dto: { enabled: boolean; appId: string; appSecret?: string; token?: string; encodingAesKey?: string }, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.officialAccount.bindingStatus();
    const result = await this.officialAccount.updateBinding(dto);
    await this.audit.create({ adminUserId: user.adminUserId, action: 'UPDATE_OFFICIAL_ACCOUNT_BINDING', resourceType: 'official_account_binding', resourceId: 'officialAccountBinding', beforeJson: before as Prisma.InputJsonValue, afterJson: result as Prisma.InputJsonValue, ip, userAgent: this.ua(userAgent) });
    return result;
  }

  async adminRoles() {
    const rows = await this.prisma.adminRoleDefinition.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.adminRoleItem(row));
  }

  async createAdminRole(dto: { name: string; description?: string; permissions: string[]; dataScope?: 'SELF' | 'ASSIGNED_MEMBERS' | 'TEAM' | 'ALL'; dataScopeMemberIds?: string[] }, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const name = dto.name.trim();
    const exists = await this.prisma.adminRoleDefinition.findUnique({ where: { name } });
    if (exists) throw new BusinessException(400516, '角色名称已存在，请更换名称');
    const dataScope = dto.dataScope || 'SELF';
    this.assertCanGrantDataScope(user, dataScope);
    this.assertCanGrantPermissions(user, dto.permissions);
    const dataScopeMemberIds = await this.validateDataScopeMemberIds(dto.dataScopeMemberIds || []);
    const created = await this.prisma.adminRoleDefinition.create({
      data: {
        name,
        description: dto.description?.trim() || null,
        permissionsJson: this.normalizePermissions(dto.permissions),
        dataScope,
        dataScopeMemberIds,
      },
      include: { _count: { select: { users: true } } },
    });
    const item = this.adminRoleItem(created);
    await this.audit.create({ adminUserId: user.adminUserId, action: 'CREATE_ADMIN_ROLE', resourceType: 'admin_role_definitions', resourceId: created.id, afterJson: item as unknown as Prisma.InputJsonValue, ip, userAgent: this.ua(userAgent) });
    return item;
  }

  async updateAdminRole(id: string, dto: { name?: string; description?: string; permissions?: string[]; dataScope?: 'SELF' | 'ASSIGNED_MEMBERS' | 'TEAM' | 'ALL'; dataScopeMemberIds?: string[] }, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.prisma.adminRoleDefinition.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!before) throw new BusinessException(404516, '角色不存在', 404);
    const name = dto.name?.trim();
    if (name && name !== before.name) {
      const exists = await this.prisma.adminRoleDefinition.findFirst({ where: { name, id: { not: id } } });
      if (exists) throw new BusinessException(400516, '角色名称已存在，请更换名称');
    }
    const permissions = dto.permissions === undefined ? this.parsePermissions(before.permissionsJson) : this.normalizePermissions(dto.permissions);
    this.assertCanGrantPermissions(user, permissions);
    const dataScope = dto.dataScope ?? before.dataScope;
    this.assertCanGrantDataScope(user, dataScope);
    const dataScopeMemberIds = dto.dataScopeMemberIds === undefined
      ? this.parseStringArray(before.dataScopeMemberIds)
      : await this.validateDataScopeMemberIds(dto.dataScopeMemberIds);
    const updated = await this.prisma.$transaction(async (tx) => {
      const role = await tx.adminRoleDefinition.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
          ...(dto.permissions !== undefined ? { permissionsJson: permissions } : {}),
          ...(dto.dataScope !== undefined ? { dataScope } : {}),
          ...(dto.dataScopeMemberIds !== undefined ? { dataScopeMemberIds } : {}),
        },
        include: { _count: { select: { users: true } } },
      });
      if (dto.permissions !== undefined || dto.dataScope !== undefined || dto.dataScopeMemberIds !== undefined) {
        await tx.adminUser.updateMany({
          where: { customRoleId: id },
          data: {
            ...(dto.permissions !== undefined ? { permissionsJson: permissions } : {}),
            ...(dto.dataScope !== undefined ? { dataScope } : {}),
            ...(dto.dataScopeMemberIds !== undefined ? { dataScopeMemberIds } : {})
          }
        });
      }
      return role;
    });
    const item = this.adminRoleItem(updated);
    await this.audit.create({ adminUserId: user.adminUserId, action: 'UPDATE_ADMIN_ROLE', resourceType: 'admin_role_definitions', resourceId: id, beforeJson: this.adminRoleItem(before) as unknown as Prisma.InputJsonValue, afterJson: item as unknown as Prisma.InputJsonValue, ip, userAgent: this.ua(userAgent) });
    return item;
  }

  async deleteAdminRole(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.prisma.adminRoleDefinition.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!before) throw new BusinessException(404516, '角色不存在', 404);
    this.assertCanGrantPermissions(user, this.parsePermissions(before.permissionsJson));
    await this.prisma.$transaction(async (tx) => {
      await tx.adminUser.updateMany({ where: { customRoleId: id }, data: { customRoleId: null } });
      await tx.adminRoleDefinition.delete({ where: { id } });
    });
    await this.audit.create({ adminUserId: user.adminUserId, action: 'DELETE_ADMIN_ROLE', resourceType: 'admin_role_definitions', resourceId: id, beforeJson: this.adminRoleItem(before) as unknown as Prisma.InputJsonValue, afterJson: { deleted: true, affectedMembers: before._count.users }, ip, userAgent: this.ua(userAgent) });
    return { id, deleted: true, affectedMembers: before._count.users };
  }

  async adminUsers(query: Record<string, string>) {
    const page = this.page(query.page);
    const pageSize = this.pageSize(query.pageSize);
    const where: Prisma.AdminUserWhereInput = { deletedAt: null };
    if (query.keyword) {
      const keyword = query.keyword.trim();
      where.OR = [{ nickname: { contains: keyword } }, { username: { contains: keyword } }];
    }
    const [total, rows] = await Promise.all([
      this.prisma.adminUser.count({ where }),
      this.prisma.adminUser.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customRole: true, team: true },
        orderBy: { createdAt: 'desc' }
      })
    ]);
    return {
      total,
      page,
      pageSize,
      list: rows.map((row) => this.adminUserItem(row))
    };
  }

  async createAdminUser(
    dto: { username: string; password: string; role: AdminRole; customRoleId?: string; permissions: string[]; notifyEnabled?: boolean; dataScope?: 'SELF' | 'ASSIGNED_MEMBERS' | 'TEAM' | 'ALL'; dataScopeMemberIds?: string[]; teamId?: string; consultationReceivable?: boolean },
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    this.assertCanManageAdminTarget(user, dto.role);
    const customRole = dto.customRoleId ? await this.prisma.adminRoleDefinition.findUnique({ where: { id: dto.customRoleId } }) : null;
    if (dto.customRoleId && !customRole) throw new BusinessException(404516, '所选角色不存在', 404);
    if (dto.role === AdminRole.SUPER_ADMIN && customRole) throw new BusinessException(400517, '超级管理员不能同时绑定自定义角色');
    const dataScope = dto.role === AdminRole.SUPER_ADMIN ? 'ALL' : (customRole?.dataScope ?? dto.dataScope ?? 'SELF');
    this.assertCanGrantDataScope(user, dataScope);
    this.assertCanGrantPermissions(user, customRole ? this.parsePermissions(customRole.permissionsJson) : dto.permissions);
    const dataScopeMemberIds = customRole
      ? this.parseStringArray(customRole.dataScopeMemberIds)
      : await this.validateDataScopeMemberIds(dto.dataScopeMemberIds || []);
    if (dto.teamId) await this.assertTeamExists(dto.teamId);
    const username = dto.username.trim();
    const sameUsername = await this.prisma.adminUser.findUnique({ where: { username } });
    if (sameUsername) throw new BusinessException(400506, '登录账号已存在，请更换账号');
    const created = await this.prisma.adminUser.create({
      data: {
        username,
        nickname: username,
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: dto.role,
        customRoleId: customRole?.id || null,
        permissionsJson: customRole ? this.normalizePermissions(this.parsePermissions(customRole.permissionsJson)) : this.normalizePermissions(dto.permissions),
        dataScope,
        dataScopeMemberIds,
        teamId: dto.teamId || null,
        consultationReceivable: dto.consultationReceivable === true,
        status: AdminStatus.ACTIVE,
        notifyEnabled: dto.notifyEnabled !== false
      },
      include: { customRole: true, team: true },
    });
    const item = this.adminUserItem(created);
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'CREATE_ADMIN_USER',
      resourceType: 'admin_users',
      resourceId: created.id,
      afterJson: item as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return item;
  }

  async adminWechatInvitations() {
    await this.prisma.adminWechatInvite.updateMany({
      where: { status: AdminInviteStatus.PENDING, expiresAt: { lt: new Date() } },
      data: { status: AdminInviteStatus.EXPIRED }
    });
    const rows = await this.prisma.adminWechatInvite.findMany({
      where: { status: AdminInviteStatus.PENDING },
      orderBy: { createdAt: 'desc' }
    });
    return rows.map((row) => this.adminWechatInviteItem(row));
  }

  async createAdminWechatInvitation(
    dto: { nickname: string; role: AdminRole; permissions: string[]; notifyEnabled?: boolean },
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    this.assertCanManageAdminTarget(user, dto.role);
    this.assertCanGrantPermissions(user, dto.permissions);
    const nickname = dto.nickname.trim();
    const existing = await this.prisma.adminUser.findFirst({ where: { nickname } });
    if (existing) {
      throw new BusinessException(400509, '该昵称已存在，请直接编辑现有成员');
    }
    const pending = await this.prisma.adminWechatInvite.findFirst({
      where: { nickname, status: AdminInviteStatus.PENDING, expiresAt: { gt: new Date() } }
    });
    if (pending) {
      throw new BusinessException(400510, '该昵称已有待绑定邀请，请使用现有绑定链接');
    }
    const token = randomBytes(32).toString('hex');
    const row = await this.prisma.adminWechatInvite.create({
      data: {
        tokenHash: this.hashWechatToken(token),
        nickname,
        role: dto.role,
        permissionsJson: this.normalizePermissions(dto.permissions),
        notifyEnabled: dto.notifyEnabled !== false,
        createdByAdminId: user.adminUserId,
        expiresAt: dayjs().add(7, 'day').toDate()
      }
    });
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'CREATE_ADMIN_WECHAT_INVITE',
      resourceType: 'admin_wechat_invites',
      resourceId: row.id,
      afterJson: this.adminWechatInviteItem(row) as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return { ...this.adminWechatInviteItem(row), bindUrl: this.wechatInviteBindUrl(token) };
  }

  async cancelAdminWechatInvitation(
    id: string,
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    const before = await this.prisma.adminWechatInvite.findUnique({ where: { id } });
    if (!before || before.status !== AdminInviteStatus.PENDING) {
      throw new BusinessException(404509, '待绑定邀请不存在');
    }
    const updated = await this.prisma.adminWechatInvite.update({
      where: { id },
      data: { status: AdminInviteStatus.CANCELLED }
    });
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'CANCEL_ADMIN_WECHAT_INVITE',
      resourceType: 'admin_wechat_invites',
      resourceId: id,
      beforeJson: this.adminWechatInviteItem(before) as unknown as Prisma.InputJsonValue,
      afterJson: this.adminWechatInviteItem(updated) as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return this.adminWechatInviteItem(updated);
  }

  async createExistingAdminWechatInvitation(
    adminUserId: string,
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminUserId } });
    if (!admin) {
      throw new BusinessException(404506, '管理员账号不存在');
    }
    this.assertCanManageAdminTarget(user, admin.role);
    if (admin.oaOpenId) {
      throw new BusinessException(400514, '该成员已绑定微信，无需重新生成二维码');
    }
    await this.prisma.adminWechatInvite.updateMany({
      where: { adminUserId, status: AdminInviteStatus.PENDING },
      data: { status: AdminInviteStatus.CANCELLED }
    });
    const token = randomBytes(32).toString('hex');
    const invite = await this.prisma.adminWechatInvite.create({
      data: {
        tokenHash: this.hashWechatToken(token),
        nickname: admin.nickname || admin.username,
        role: admin.role,
        permissionsJson: admin.permissionsJson as Prisma.InputJsonValue,
        notifyEnabled: admin.notifyEnabled,
        adminUserId: admin.id,
        createdByAdminId: user.adminUserId,
        expiresAt: dayjs().add(7, 'day').toDate()
      }
    });
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'REISSUE_ADMIN_WECHAT_INVITE',
      resourceType: 'admin_users',
      resourceId: admin.id,
      afterJson: this.adminWechatInviteItem(invite) as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return { ...this.adminWechatInviteItem(invite), bindUrl: this.wechatInviteBindUrl(token) };
  }

  async wechatInviteOauthUrl(token: string) {
    const invite = await this.findActiveWechatInvite(token);
    if (!invite) {
      throw new BusinessException(400511, '微信绑定链接无效或已过期');
    }
    return this.officialAccount.buildAdminOauthUrl('/api/admin/auth/wechat/bind/callback', token);
  }

  async completeWechatInvite(code: string, token: string) {
    const invite = await this.findActiveWechatInvite(token);
    if (!invite) {
      throw new BusinessException(400511, '微信绑定链接无效或已过期');
    }
    const identity = await this.officialAccount.resolveOauthIdentity(code);
    const boundAdmin = await this.prisma.adminUser.findUnique({ where: { oaOpenId: identity.oaOpenId } });
    if (boundAdmin) {
      throw new BusinessException(400512, '该微信已绑定其他后台账号');
    }
    const admin = await this.prisma.$transaction(async (tx) => {
      const current = await tx.adminWechatInvite.findUnique({ where: { id: invite.id } });
      if (!current || current.status !== AdminInviteStatus.PENDING || current.expiresAt < new Date()) {
        throw new BusinessException(400511, '微信绑定链接无效或已过期');
      }
      let resolvedAdmin;
      if (current.adminUserId) {
        const target = await tx.adminUser.findUnique({ where: { id: current.adminUserId } });
        if (!target) {
          throw new BusinessException(404506, '管理员账号不存在');
        }
        if (target.oaOpenId) {
          throw new BusinessException(400514, '该成员已绑定微信，无需重复绑定');
        }
        resolvedAdmin = await tx.adminUser.update({
          where: { id: target.id },
          data: {
            oaOpenId: identity.oaOpenId,
            unionId: identity.unionId,
            subscribedOfficialAccount: identity.subscribed,
            wechatBoundAt: new Date()
          }
        });
      } else {
        const username = `wx_${createHash('sha256').update(identity.oaOpenId).digest('hex').slice(0, 20)}`;
        resolvedAdmin = await tx.adminUser.create({
          data: {
            username,
            nickname: invite.nickname,
            passwordHash: null,
            role: invite.role,
            permissionsJson: invite.permissionsJson as Prisma.InputJsonValue,
            // 历史账号由迁移保持 ALL；绑定邀请产生的是新账号，必须采用最小数据范围。
            dataScope: 'SELF',
            dataScopeMemberIds: [],
            status: AdminStatus.ACTIVE,
            oaOpenId: identity.oaOpenId,
            unionId: identity.unionId,
            subscribedOfficialAccount: identity.subscribed,
            notifyEnabled: invite.notifyEnabled,
            wechatBoundAt: new Date()
          }
        });
      }
      await tx.adminWechatInvite.update({
        where: { id: invite.id },
        data: {
          status: AdminInviteStatus.BOUND,
          adminUserId: resolvedAdmin.id,
          boundAt: new Date()
        }
      });
      return resolvedAdmin;
    });
    await this.audit.create({
      adminUserId: invite.createdByAdminId,
      action: 'BIND_ADMIN_WECHAT',
      resourceType: 'admin_users',
      resourceId: admin.id,
      afterJson: this.adminUserItem(admin) as unknown as Prisma.InputJsonValue
    });
    return this.adminUserItem(admin);
  }

  async updateAdminUser(
    id: string,
    dto: {
      username?: string;
      password?: string;
      role?: AdminRole;
      customRoleId?: string | null;
      permissions?: string[];
      status?: AdminStatus;
      notifyEnabled?: boolean;
      dataScope?: 'SELF' | 'ASSIGNED_MEMBERS' | 'TEAM' | 'ALL';
      dataScopeMemberIds?: string[];
      teamId?: string | null;
      consultationReceivable?: boolean;
    },
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    const before = await this.prisma.adminUser.findUnique({ where: { id }, include: { customRole: true, team: true } });
    if (!before) {
      throw new BusinessException(404506, '管理员账号不存在');
    }
    const targetRole = dto.role || before.role;
    const customRole = dto.customRoleId !== undefined
      ? (dto.customRoleId ? await this.prisma.adminRoleDefinition.findUnique({ where: { id: dto.customRoleId } }) : null)
      : before.customRole;
    if (dto.customRoleId && !customRole) throw new BusinessException(404516, '所选角色不存在', 404);
    if (targetRole === AdminRole.SUPER_ADMIN && customRole) throw new BusinessException(400517, '超级管理员不能同时绑定自定义角色');
    const effectiveScope = targetRole === AdminRole.SUPER_ADMIN ? 'ALL' : (customRole?.dataScope ?? dto.dataScope ?? before.dataScope);
    this.assertCanGrantDataScope(user, effectiveScope);
    if (dto.customRoleId !== undefined || dto.permissions !== undefined) {
      this.assertCanGrantPermissions(
        user,
        customRole ? this.parsePermissions(customRole.permissionsJson) : (dto.permissions ?? this.parsePermissions(before.permissionsJson))
      );
    }
    const effectiveScopeMemberIds = customRole
      ? this.parseStringArray(customRole.dataScopeMemberIds)
      : (dto.dataScopeMemberIds === undefined
        ? this.parseStringArray(before.dataScopeMemberIds)
        : await this.validateDataScopeMemberIds(dto.dataScopeMemberIds));
    if (dto.teamId) await this.assertTeamExists(dto.teamId);
    this.assertCanManageAdminTarget(user, targetRole);
    if (id === user.adminUserId && dto.status === AdminStatus.DISABLED) {
      throw new BusinessException(400507, '不能停用当前登录账号');
    }
    if (id === user.adminUserId && before.role === AdminRole.SUPER_ADMIN && dto.role && dto.role !== AdminRole.SUPER_ADMIN) {
      throw new BusinessException(400513, '不能降低当前超级管理员自己的角色');
    }
    const data: Prisma.AdminUserUpdateInput = {};
    if (dto.username) {
      const username = dto.username.trim();
      const sameUsername = await this.prisma.adminUser.findFirst({ where: { username, id: { not: id } } });
      if (sameUsername) throw new BusinessException(400506, '登录账号已存在，请更换账号');
      data.username = username;
      data.nickname = username;
    }
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    if (dto.role) {
      data.role = dto.role;
    }
    if (dto.customRoleId !== undefined) {
      data.customRole = dto.customRoleId ? { connect: { id: dto.customRoleId } } : { disconnect: true };
    }
    if (customRole) {
      data.permissionsJson = this.normalizePermissions(this.parsePermissions(customRole.permissionsJson));
      data.dataScope = customRole.dataScope;
      data.dataScopeMemberIds = this.parseStringArray(customRole.dataScopeMemberIds);
    } else if (dto.permissions) {
      data.permissionsJson = this.normalizePermissions(dto.permissions);
    }
    if (!customRole) {
      if (targetRole === AdminRole.SUPER_ADMIN) {
        data.dataScope = 'ALL';
        data.dataScopeMemberIds = [];
      } else {
        if (dto.dataScope !== undefined) data.dataScope = effectiveScope;
        if (dto.dataScopeMemberIds !== undefined) data.dataScopeMemberIds = effectiveScopeMemberIds;
      }
    }
    if (dto.teamId !== undefined) data.team = dto.teamId ? { connect: { id: dto.teamId } } : { disconnect: true };
    if (dto.consultationReceivable !== undefined) data.consultationReceivable = dto.consultationReceivable;
    if (dto.status) {
      data.status = dto.status;
    }
    if (dto.notifyEnabled !== undefined) {
      data.notifyEnabled = dto.notifyEnabled;
    }
    const updated = await this.prisma.adminUser.update({ where: { id }, data, include: { customRole: true, team: true } });
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'UPDATE_ADMIN_USER',
      resourceType: 'admin_users',
      resourceId: id,
      beforeJson: this.adminUserItem(before) as unknown as Prisma.InputJsonValue,
      afterJson: this.adminUserItem(updated) as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return this.adminUserItem(updated);
  }

  async adminUserHandoverSummary(id: string) {
    const target = await this.prisma.adminUser.findFirst({ where: { id, deletedAt: null } });
    if (!target) throw new BusinessException(404506, '管理员账号不存在');
    const now = new Date();
    const businessNow = dayjs().tz('Asia/Shanghai');
    const dayStart = businessNow.startOf('day').toDate();
    const dayEnd = businessNow.endOf('day').toDate();
    const activeStatusFilter = { category: { notIn: [ConsultationStatusCategory.COMPLETED, ConsultationStatusCategory.INVALID] } };
    const [consultations, todayCallbacks, overdueCallbacks, appointments, promotionAccounts, tencentLeads] = await Promise.all([
      this.prisma.consultationForm.count({ where: { ownerAdminId: id } }),
      this.prisma.consultationForm.count({ where: { ownerAdminId: id, nextFollowUpAt: { gte: dayStart, lte: dayEnd }, status: activeStatusFilter } }),
      this.prisma.consultationForm.count({ where: { ownerAdminId: id, nextFollowUpAt: { lt: now }, status: activeStatusFilter } }),
      this.prisma.appointment.count({ where: { assignedToAdminId: id } }),
      this.prisma.promotionAccount.count({ where: { ownerAdminId: id } }),
      this.prisma.tencentAdLead.count({ where: { assignedToAdminId: id } })
    ]);
    return {
      adminUserId: id,
      consultations,
      todayCallbacks,
      overdueCallbacks,
      appointments,
      promotionAccounts,
      tencentLeads,
      total: consultations + appointments + promotionAccounts + tencentLeads
    };
  }

  async deleteAdminUser(id: string, successorAdminId: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const target = await this.prisma.adminUser.findUnique({ where: { id }, include: { customRole: true } });
    if (!target || target.deletedAt) throw new BusinessException(404506, '管理员账号不存在');
    this.assertCanManageAdminTarget(user, target.role);
    if (id === user.adminUserId) throw new BusinessException(400514, '不能删除当前登录账号');
    if (!successorAdminId) throw new BusinessException(400518, '删除成员前必须选择新归属成员');
    if (successorAdminId === id) throw new BusinessException(400519, '新归属成员不能是待删除成员本人');
    const successor = await this.prisma.adminUser.findFirst({
      where: { id: successorAdminId, status: AdminStatus.ACTIVE, deletedAt: null },
      include: { customRole: true }
    });
    if (!successor) throw new BusinessException(400520, '新归属成员不存在或已停用');
    if (target.role === AdminRole.SUPER_ADMIN) {
      const count = await this.prisma.adminUser.count({ where: { role: AdminRole.SUPER_ADMIN, status: AdminStatus.ACTIVE, deletedAt: null } });
      if (count <= 1) throw new BusinessException(400515, '至少需要保留一名启用的超级管理员');
    }
    const summary = await this.adminUserHandoverSummary(id);
    const successorPermissions = this.parsePermissions(successor.customRole?.permissionsJson ?? successor.permissionsJson);
    if (summary.consultations > 0 && successor.role !== AdminRole.SUPER_ADMIN && !successorPermissions.includes('CONSULTATION_VIEW')) {
      throw new BusinessException(400521, '新归属成员缺少网咨数据查看权限，不能接收网咨表单');
    }
    const deletedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.consultationForm.updateMany({ where: { ownerAdminId: id }, data: { ownerAdminId: successorAdminId, lastOperatedByAdminId: user.adminUserId } });
      await tx.appointment.updateMany({ where: { assignedToAdminId: id }, data: { assignedToAdminId: successorAdminId } });
      await tx.promotionAccount.updateMany({ where: { ownerAdminId: id }, data: { ownerAdminId: successorAdminId } });
      await tx.tencentAdLead.updateMany({ where: { assignedToAdminId: id }, data: { assignedToAdminId: successorAdminId } });
      await tx.adminTeam.updateMany({ where: { leaderAdminId: id }, data: { leaderAdminId: null } });
      await tx.adminWechatInvite.updateMany({ where: { adminUserId: id, status: AdminInviteStatus.PENDING }, data: { status: AdminInviteStatus.CANCELLED } });
      await tx.adminUser.update({
        where: { id },
        data: {
          username: `deleted_${id}`.slice(0, 64),
          passwordHash: null,
          status: AdminStatus.DISABLED,
          oaOpenId: null,
          unionId: null,
          subscribedOfficialAccount: false,
          notifyEnabled: false,
          consultationReceivable: false,
          teamId: null,
          deletedAt
        }
      });
      await tx.auditLog.create({
        data: {
          adminUserId: user.adminUserId,
          action: 'DELETE_ADMIN_USER_WITH_HANDOVER',
          resourceType: 'admin_users',
          resourceId: id,
          beforeJson: this.adminUserItem(target) as unknown as Prisma.InputJsonValue,
          afterJson: { deleted: true, successorAdminId, summary } as unknown as Prisma.InputJsonValue,
          ip,
          userAgent: this.ua(userAgent)
        }
      });
    });
    return { id, deleted: true, successorAdminId, summary };
  }

  async adminTeams() {
    const rows = await this.prisma.adminTeam.findMany({
      include: {
        leader: { select: { id: true, username: true, nickname: true } },
        _count: { select: { members: true, children: true } }
      },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }]
    });
    return rows;
  }

  async createAdminTeam(
    dto: { name: string; parentId?: string | null; leaderAdminId?: string | null; status?: AdminStatus },
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    if (dto.parentId) await this.assertTeamExists(dto.parentId);
    if (dto.leaderAdminId) await this.assertActiveAdmin(dto.leaderAdminId);
    const created = await this.prisma.adminTeam.create({ data: {
      name: dto.name.trim(), parentId: dto.parentId || null, leaderAdminId: dto.leaderAdminId || null,
      status: dto.status || AdminStatus.ACTIVE
    } });
    await this.audit.create({ adminUserId: user.adminUserId, action: 'CREATE_ADMIN_TEAM', resourceType: 'admin_teams', resourceId: created.id, afterJson: created as unknown as Prisma.InputJsonValue, ip, userAgent: this.ua(userAgent) });
    return created;
  }

  async updateAdminTeam(
    id: string,
    dto: { name?: string; parentId?: string | null; leaderAdminId?: string | null; status?: AdminStatus },
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    const before = await this.prisma.adminTeam.findUnique({ where: { id } });
    if (!before) throw new BusinessException(404522, '团队不存在', 404);
    if (dto.parentId === id) throw new BusinessException(400522, '团队不能设置自己为上级团队');
    if (dto.parentId) {
      await this.assertTeamExists(dto.parentId);
      const descendants = await this.teamDescendantIds(id);
      if (descendants.includes(dto.parentId)) throw new BusinessException(400523, '不能将下级团队设置为上级团队');
    }
    if (dto.leaderAdminId) await this.assertActiveAdmin(dto.leaderAdminId);
    const updated = await this.prisma.adminTeam.update({ where: { id }, data: {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.parentId !== undefined ? { parentId: dto.parentId || null } : {}),
      ...(dto.leaderAdminId !== undefined ? { leaderAdminId: dto.leaderAdminId || null } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {})
    } });
    await this.audit.create({ adminUserId: user.adminUserId, action: 'UPDATE_ADMIN_TEAM', resourceType: 'admin_teams', resourceId: id, beforeJson: before as unknown as Prisma.InputJsonValue, afterJson: updated as unknown as Prisma.InputJsonValue, ip, userAgent: this.ua(userAgent) });
    return updated;
  }

  async deleteAdminTeam(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.prisma.adminTeam.findUnique({ where: { id }, include: { _count: { select: { members: true, children: true } } } });
    if (!before) throw new BusinessException(404522, '团队不存在', 404);
    if (before._count.members || before._count.children) throw new BusinessException(400524, '团队仍有成员或下级团队，只能先转移后删除');
    await this.prisma.adminTeam.delete({ where: { id } });
    await this.audit.create({ adminUserId: user.adminUserId, action: 'DELETE_ADMIN_TEAM', resourceType: 'admin_teams', resourceId: id, beforeJson: before as unknown as Prisma.InputJsonValue, afterJson: { deleted: true }, ip, userAgent: this.ua(userAgent) });
    return { id, deleted: true };
  }

  async clinics() {
    const rows = await this.prisma.clinic.findMany({ orderBy: { createdAt: 'desc' } });
    return rows;
  }

  async createClinic(
    dto: { name: string; address?: string; phone?: string; status?: ClinicStatus },
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    const row = await this.prisma.clinic.create({
      data: {
        name: dto.name,
        address: dto.address || null,
        phone: dto.phone || null,
        status: dto.status || ClinicStatus.ACTIVE
      }
    });
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'CREATE_CLINIC',
      resourceType: 'clinics',
      resourceId: row.id,
      afterJson: row as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return row;
  }

  async updateClinic(
    id: string,
    dto: { name?: string; address?: string; phone?: string; status?: ClinicStatus },
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    const before = await this.prisma.clinic.findUnique({ where: { id } });
    if (!before) {
      throw new BusinessException(404507, '门店不存在');
    }
    const updated = await this.prisma.clinic.update({
      where: { id },
      data: {
        name: dto.name,
        address: dto.address === undefined ? undefined : dto.address || null,
        phone: dto.phone === undefined ? undefined : dto.phone || null,
        status: dto.status
      }
    });
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'UPDATE_CLINIC',
      resourceType: 'clinics',
      resourceId: id,
      beforeJson: before as unknown as Prisma.InputJsonValue,
      afterJson: updated as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return updated;
  }

  async appointmentNotifyConfig() {
    const config = await this.configsService.getAppointmentNotifyConfig();
    const recipients = await this.prisma.adminUser.findMany({
      where: { oaOpenId: { not: null } },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }]
    });
    return {
      enabled: config.enabled,
      templateId: config.templateId,
      recipients: recipients.map((item) => ({
        id: item.id,
        name: item.nickname || item.username,
        enabled: item.notifyEnabled,
        bound: true,
        oaOpenIdMasked: item.oaOpenId ? `${item.oaOpenId.slice(0, 8)}...${item.oaOpenId.slice(-6)}` : '',
        boundAt: item.wechatBoundAt,
        createdAt: item.createdAt,
        role: item.role,
        status: item.status
      }))
    };
  }

  async updateAppointmentNotifyConfig(
    dto: { enabled?: boolean; templateId?: string },
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    const before = await this.configsService.getAppointmentNotifyConfig();
    const next: AppointmentNotifyConfig = {
      ...before,
      enabled: dto.enabled ?? before.enabled,
      templateId: dto.templateId === undefined ? before.templateId : dto.templateId
    };
    await this.saveAppointmentNotifyConfig(next);
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'UPDATE_APPOINTMENT_NOTIFY_CONFIG',
      resourceType: 'system_configs',
      resourceId: 'appointmentNotify',
      beforeJson: before as unknown as Prisma.InputJsonValue,
      afterJson: next as unknown as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent)
    });
    return this.appointmentNotifyConfig();
  }

  async exportAppointments(
    query: Record<string, string>,
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    const includeFullPhone = query.fullPhone === 'true';
    if (includeFullPhone && user.role !== AdminRole.SUPER_ADMIN && !user.permissions.includes('EXPORT_FULL_PHONE')) {
      throw new BusinessException(403505, '当前账号无导出完整手机号权限', 403);
    }
    const rows = await this.prisma.appointment.findMany({
      where: await this.scopedAppointmentWhere(query, user),
      include: { clinic: true, doctor: true, dentalCategory: true, dentalProject: true, package: true },
      orderBy: { createdAt: 'desc' },
      take: 5001
    });
    if (rows.length > 5000) {
      throw new BusinessException(400521, '单次最多导出 5000 条，请缩小筛选范围');
    }
    await this.audit.create({
      adminUserId: user.adminUserId,
      action: includeFullPhone ? 'EXPORT_FULL_PHONE' : 'EXPORT_APPOINTMENTS',
      resourceType: 'appointments',
      afterJson: { count: rows.length, fullPhone: includeFullPhone },
      ip,
      userAgent: this.ua(userAgent)
    });
    const header = [
      '挂号编号',
      '业务类型',
      '姓名',
      includeFullPhone ? '完整手机号' : '手机号',
      '年龄段',
      '缺牙情况',
      '门店',
      '预约医生',
      '科室',
      '项目/套餐',
      '预约日期',
      '预约时间',
      '性别',
      '症状描述',
      '来源',
      '状态',
      '回访转发状态',
      '回访转发成功时间',
      '回访转发错误',
      '提交时间'
    ];
    const lines = rows.map((row) =>
      [
        row.appointmentNo,
        this.appointmentTypeText(row.type),
        row.name,
        includeFullPhone ? this.crypto.decryptPhone(row.phoneEncrypted) : row.phoneMasked,
        row.ageRange,
        row.missingTeethType,
        row.clinic?.name || '',
        row.doctor?.name || '',
        row.dentalCategory?.name || '',
        row.dentalProject?.name || row.package?.title || '',
        row.appointmentDate ? dayjs(row.appointmentDate).format('YYYY-MM-DD') : '',
        row.appointmentTime || '',
        row.gender || '',
        row.symptomDescription || '',
        row.source || '',
        row.status,
        this.followupForwardStatusText(row.followupForwardStatus),
        row.followupForwardedAt ? dayjs(row.followupForwardedAt).format('YYYY-MM-DD HH:mm:ss') : '',
        row.followupForwardErrorMessage || '',
        dayjs(row.createdAt).format('YYYY-MM-DD HH:mm:ss')
      ]
        .map((item) => this.csvCell(item))
        .join(',')
    );
    return [header.map((item) => this.csvCell(item)).join(','), ...lines].join('\n');
  }

  private appointmentWhere(query: Record<string, string>): Prisma.AppointmentWhereInput {
    const where: Prisma.AppointmentWhereInput = {};
    if (query.status && Object.values(AppointmentStatus).includes(query.status as AppointmentStatus)) {
      where.status = query.status as AppointmentStatus;
    }
    if (query.type && Object.values(AppointmentType).includes(query.type as AppointmentType)) {
      where.type = query.type as AppointmentType;
    }
    if (query.doctorId) where.doctorId = query.doctorId;
    if (
      query.followupForwardStatus &&
      Object.values(FollowupForwardStatus).includes(query.followupForwardStatus as FollowupForwardStatus)
    ) {
      where.followupForwardStatus = query.followupForwardStatus as FollowupForwardStatus;
    }
    if (query.clinicId) {
      where.clinicId = query.clinicId;
    }
    if (query.keyword) {
      const keyword = query.keyword.trim();
      where.OR = [
        { appointmentNo: { contains: keyword } },
        { name: { contains: keyword } },
        /^\d{7,}$/.test(keyword) ? { phoneHash: this.crypto.hashPhone(keyword) } : { phoneMasked: { contains: keyword } }
      ];
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        gte: query.dateFrom ? dayjs(query.dateFrom).startOf('day').toDate() : undefined,
        lte: query.dateTo ? dayjs(query.dateTo).endOf('day').toDate() : undefined
      };
    }
    return where;
  }

  private async scopedAppointmentWhere(query: Record<string, string>, user: AdminCurrentUser): Promise<Prisma.AppointmentWhereInput> {
    const base = this.appointmentWhere(query);
    if (!this.dataScopes) return base;
    const scope = await this.dataScopes.ownershipWhere(user, 'assignedToAdminId', 'createdByAdminId');
    return Object.keys(scope).length ? { AND: [base, scope as Prisma.AppointmentWhereInput] } : base;
  }

  private async assertAppointmentScope(row: { assignedToAdminId?: string | null; createdByAdminId?: string | null }, user: AdminCurrentUser) {
    if (this.dataScopes) await this.dataScopes.assertOwned(user, row, 'assignedToAdminId', 'createdByAdminId', '无权访问该业务数据');
  }

  private appointmentListItem(row: {
    id: string;
    appointmentNo: string;
    name: string;
    phoneMasked: string;
    ageRange: string;
    missingTeethType: string;
    type: AppointmentType;
    doctorId?: string | null;
    dentalCategoryId?: string | null;
    dentalProjectId?: string | null;
    packageId?: string | null;
    appointmentDate?: Date | null;
    appointmentTime?: string | null;
    symptomDescription?: string | null;
    gender?: string | null;
    source?: string | null;
    status: AppointmentStatus;
    followupForwardStatus: FollowupForwardStatus;
    followupForwardedAt?: Date | null;
    followupForwardLastTriedAt?: Date | null;
    followupForwardErrorCode?: string | null;
    followupForwardErrorMessage?: string | null;
    followupForwardRetryCount?: number;
    createdAt: Date;
    updatedAt: Date;
    clinic?: { id: string; name: string } | null;
    doctor?: { id: string; name: string; title: string } | null;
    dentalCategory?: { id: string; name: string } | null;
    dentalProject?: { id: string; name: string } | null;
    package?: { id: string; title: string } | null;
    assignedTo?: { id: string; username: string } | null;
  }) {
    return {
      id: row.id,
      appointmentNo: row.appointmentNo,
      name: row.name,
      phoneMasked: row.phoneMasked,
      ageRange: row.ageRange,
      missingTeethType: row.missingTeethType,
      type: row.type,
      typeText: this.appointmentTypeText(row.type),
      appointmentDate: row.appointmentDate,
      appointmentTime: row.appointmentTime,
      symptomDescription: row.symptomDescription,
      gender: row.gender,
      source: row.source,
      status: row.status,
      statusText: this.statusText(row.status),
      followupForwardStatus: row.followupForwardStatus,
      followupForwardStatusText: this.followupForwardStatusText(row.followupForwardStatus),
      followupForwardedAt: row.followupForwardedAt,
      followupForwardLastTriedAt: row.followupForwardLastTriedAt,
      followupForwardErrorCode: row.followupForwardErrorCode,
      followupForwardErrorMessage: row.followupForwardErrorMessage,
      followupForwardRetryCount: row.followupForwardRetryCount || 0,
      clinic: row.clinic ? { id: row.clinic.id, name: row.clinic.name } : null,
      doctor: row.doctor ? { id: row.doctor.id, name: row.doctor.name, title: row.doctor.title } : null,
      dentalCategory: row.dentalCategory ? { id: row.dentalCategory.id, name: row.dentalCategory.name } : null,
      dentalProject: row.dentalProject ? { id: row.dentalProject.id, name: row.dentalProject.name } : null,
      package: row.package ? { id: row.package.id, title: row.package.title } : null,
      assignedTo: row.assignedTo ? { id: row.assignedTo.id, username: row.assignedTo.username } : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  private appointmentTypeText(type: AppointmentType) {
    const labels: Record<AppointmentType, string> = {
      LEGACY_REGISTRATION: '旧挂号',
      DOCTOR_APPOINTMENT: '医生预约',
      PACKAGE_APPLICATION: '套餐申请'
    };
    return labels[type];
  }

  private adminRoleItem(row: {
    id: string;
    name: string;
    description: string | null;
    permissionsJson: Prisma.JsonValue;
    dataScope: 'SELF' | 'ASSIGNED_MEMBERS' | 'TEAM' | 'ALL';
    dataScopeMemberIds: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { users: number };
  }) {
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      permissions: this.parsePermissions(row.permissionsJson),
      dataScope: row.dataScope,
      dataScopeMemberIds: this.parseStringArray(row.dataScopeMemberIds),
      memberCount: row._count?.users || 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private adminUserItem(row: {
    id: string;
    username: string;
    nickname: string;
    role: AdminRole;
    customRoleId?: string | null;
    customRole?: { id: string; name: string; permissionsJson: Prisma.JsonValue } | null;
    permissionsJson: Prisma.JsonValue;
    status: AdminStatus;
    oaOpenId?: string | null;
    unionId?: string | null;
    subscribedOfficialAccount?: boolean;
    notifyEnabled?: boolean;
    wechatBoundAt?: Date | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    dataScope?: 'SELF' | 'ASSIGNED_MEMBERS' | 'TEAM' | 'ALL';
    dataScopeMemberIds?: Prisma.JsonValue | null;
    teamId?: string | null;
    team?: { id: string; name: string } | null;
    consultationReceivable?: boolean;
    deletedAt?: Date | null;
  }) {
    return {
      id: row.id,
      username: row.username,
      nickname: row.nickname || row.username,
      role: row.role,
      roleName: row.customRole?.name || '',
      customRoleId: row.customRoleId || null,
      customRole: row.customRole ? { id: row.customRole.id, name: row.customRole.name } : null,
      permissions: this.parsePermissions(row.customRole?.permissionsJson ?? row.permissionsJson),
      dataScope: row.role === AdminRole.SUPER_ADMIN ? 'ALL' : (row.dataScope || 'ALL'),
      dataScopeMemberIds: this.parseStringArray(row.dataScopeMemberIds),
      teamId: row.teamId || null,
      team: row.team || null,
      consultationReceivable: Boolean(row.consultationReceivable),
      status: row.status,
      wechatBound: Boolean(row.oaOpenId),
      oaOpenIdMasked: row.oaOpenId ? `${row.oaOpenId.slice(0, 8)}...${row.oaOpenId.slice(-6)}` : '',
      subscribedOfficialAccount: Boolean(row.subscribedOfficialAccount),
      notifyEnabled: row.notifyEnabled !== false,
      wechatBoundAt: row.wechatBoundAt,
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  private adminWechatInviteItem(row: {
    id: string;
    nickname: string;
    role: AdminRole;
    permissionsJson: Prisma.JsonValue;
    notifyEnabled: boolean;
    status: AdminInviteStatus;
    expiresAt: Date;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      nickname: row.nickname,
      role: row.role,
      permissions: this.parsePermissions(row.permissionsJson),
      notifyEnabled: row.notifyEnabled,
      status: row.status,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt
    };
  }

  private hashWechatToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private wechatInviteBindUrl(token: string) {
    const base = (this.config.get<string>('SERVER_BASE_URL') || 'https://wechat.fuxiaonian.net').replace(/\/$/, '');
    return `${base}/api/admin/auth/wechat/bind?token=${encodeURIComponent(token)}`;
  }

  private async findActiveWechatInvite(token: string) {
    if (!/^[a-f0-9]{64}$/i.test(token || '')) {
      return null;
    }
    const invite = await this.prisma.adminWechatInvite.findUnique({
      where: { tokenHash: this.hashWechatToken(token) }
    });
    if (!invite || invite.status !== AdminInviteStatus.PENDING) {
      return null;
    }
    if (invite.expiresAt < new Date()) {
      await this.prisma.adminWechatInvite.update({
        where: { id: invite.id },
        data: { status: AdminInviteStatus.EXPIRED }
      });
      return null;
    }
    return invite;
  }

  private wechatLoginKey(sessionId: string) {
    return `admin:wechat-login:${sessionId}`;
  }

  private async readWechatLoginSession(sessionId: string): Promise<{
    status: 'PENDING' | 'CONFIRMED' | 'ERROR';
    adminUserId?: string;
    message?: string;
  } | null> {
    if (!/^[a-f0-9]{48}$/i.test(sessionId || '')) {
      return null;
    }
    const raw = await this.redis.get(this.wechatLoginKey(sessionId));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as { status: 'PENDING' | 'CONFIRMED' | 'ERROR'; adminUserId?: string; message?: string };
    } catch {
      return null;
    }
  }

  private normalizePermissions(permissions: string[]) {
    const allowed = new Set<string>(ADMIN_PERMISSIONS);
    return Array.from(new Set((permissions || []).filter((permission) => allowed.has(permission))));
  }

  private saveAppointmentNotifyConfig(config: AppointmentNotifyConfig) {
    return this.prisma.systemConfig.upsert({
      where: { key: 'appointmentNotify' },
      create: {
        key: 'appointmentNotify',
        valueJson: config as unknown as Prisma.InputJsonValue,
        description: '新预约公众号通知接收人配置'
      },
      update: {
        valueJson: config as unknown as Prisma.InputJsonValue,
        description: '新预约公众号通知接收人配置'
      }
    });
  }

  private publicFollowupForwardConfig(config: FollowupForwardConfig) {
    return {
      ...config,
      authToken: '',
      hasAuthToken: Boolean(config.authToken),
      authTokenMasked: this.maskSecret(config.authToken)
    };
  }

  private maskSecret(value?: string) {
    if (!value) {
      return '';
    }
    if (value.length <= 8) {
      return '********';
    }
    return `${value.slice(0, 4)}****${value.slice(-4)}`;
  }

  private requireConfigPermission(user: AdminCurrentUser) {
    if (
      user.role !== AdminRole.SUPER_ADMIN &&
      !user.permissions.includes('SYSTEM_MANAGE') &&
      !user.permissions.includes('SYSTEM_CONFIGS')
    ) {
      throw new BusinessException(403504, '当前账号无修改系统配置权限', 403);
    }
  }

  private assertCanManageAdminTarget(user: AdminCurrentUser, targetRole: AdminRole) {
    if (user.role === AdminRole.SUPER_ADMIN) {
      return;
    }
    if (targetRole === AdminRole.SUPER_ADMIN) {
      throw new BusinessException(403506, '只有 SUPER_ADMIN 可以创建或修改超级管理员', 403);
    }
    // PermissionsGuard 对旧聚合权限到新细分权限做单向兼容；服务层保持同一语义，
    // 否则会出现路由已放行、业务方法再次拒绝的问题。
    if (!user.permissions.includes('MANAGE_ADMINS') && !user.permissions.includes('SYSTEM_MEMBERS')) {
      throw new BusinessException(403507, '当前账号无子账号管理权限', 403);
    }
  }

  private assertCanGrantDataScope(user: AdminCurrentUser, scope: string) {
    if (scope === 'ALL' && user.role !== AdminRole.SUPER_ADMIN) {
      throw new BusinessException(403508, '只有超级管理员可以授予全部数据范围', 403);
    }
  }

  private assertCanGrantPermissions(user: AdminCurrentUser, permissions: string[]) {
    if (user.role === AdminRole.SUPER_ADMIN) return;
    const owned = new Set(user.permissions || []);
    const aliases: Record<string, string[]> = {
      APPOINTMENT_MANAGE: ['MANAGE_APPOINTMENTS'],
      BUSINESS_LEADS: ['MANAGE_APPOINTMENTS', 'APPOINTMENT_MANAGE'],
      BUSINESS_APPOINTMENTS: ['MANAGE_APPOINTMENTS', 'APPOINTMENT_MANAGE'],
      BUSINESS_USERS: ['MANAGE_APPOINTMENTS', 'APPOINTMENT_MANAGE'],
      BUSINESS_NOTIFICATIONS: ['MANAGE_APPOINTMENTS', 'APPOINTMENT_MANAGE'],
      CONTENT_HOME: ['HOME_MANAGE'], CONTENT_DEPARTMENTS: ['DOCTOR_MANAGE'], CONTENT_DOCTORS: ['DOCTOR_MANAGE'],
      CONTENT_PACKAGES: ['PACKAGE_MANAGE'], CONTENT_MEDIA: ['HOME_MANAGE', 'DOCTOR_MANAGE', 'PACKAGE_MANAGE'],
      CONTENT_LINKS: ['HOME_MANAGE', 'DOCTOR_MANAGE', 'PACKAGE_MANAGE'],
      WEBSITE_SETTINGS: ['WEBSITE_MANAGE'], WEBSITE_CATEGORIES: ['WEBSITE_MANAGE'], WEBSITE_ARTICLES: ['WEBSITE_MANAGE'],
      WECHAT_MENU: ['WECHAT_MANAGE'], WECHAT_AUTO_REPLY: ['WECHAT_MANAGE'],
      PROMOTION_OPERATIONS: ['PROMOTION_MANAGE'],
      PROMOTION_CREATIVE_BATCH_VIEW: ['PROMOTION_MANAGE'], PROMOTION_CREATIVE_BATCH_CREATE: ['PROMOTION_MANAGE'],
      PROMOTION_CREATIVE_BATCH_RETRY: ['PROMOTION_MANAGE'], PROMOTION_CREATIVE_BATCH_CANCEL: ['PROMOTION_MANAGE'],
      PROMOTION_CREATIVE_TEMPLATE_VIEW: ['PROMOTION_MANAGE'], PROMOTION_CREATIVE_ASSET_VIEW: ['PROMOTION_MANAGE'],
      PROMOTION_CREATIVE_RESULT_EXPORT: ['PROMOTION_MANAGE'],
      PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW: ['PROMOTION_MANAGE'], PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CREATE: ['PROMOTION_MANAGE'],
      PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_RETRY: ['PROMOTION_MANAGE'], PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CANCEL: ['PROMOTION_MANAGE'],
      PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_RESULT_EXPORT: ['PROMOTION_MANAGE'], PROMOTION_CREATIVE_DEFAULT_COMPONENT_VIEW: ['PROMOTION_MANAGE'],
      PROMOTION_CREATIVE_DEFAULT_COMPONENT_MANAGE: ['PROMOTION_MANAGE'], PROMOTION_CREATIVE_ASSET_CROSS_ACCOUNT_USE: ['PROMOTION_MANAGE'],
      PROMOTION_CREATIVE_ASSET_DISTRIBUTION: ['PROMOTION_MANAGE'],
      SYSTEM_MEMBERS: ['MANAGE_ADMINS'], SYSTEM_ROLES: ['MANAGE_ADMINS'], SYSTEM_OFFICIAL_BINDING: ['SYSTEM_MANAGE'],
      SYSTEM_CONFIGS: ['SYSTEM_MANAGE'], SYSTEM_FOLLOWUP: ['SYSTEM_MANAGE'],
      SYSTEM_WEBSITE_ANALYTICS: ['SYSTEM_MANAGE'], SYSTEM_AUDIT: ['SYSTEM_MANAGE']
    };
    const unauthorized = this.normalizePermissions(permissions).filter((permission) =>
      !owned.has(permission) && !(aliases[permission] || []).some((alias) => owned.has(alias))
    );
    if (unauthorized.length) {
      throw new BusinessException(403510, `不能授予当前账号不具备的权限：${unauthorized.join(', ')}`, 403);
    }
  }

  private parseStringArray(value: Prisma.JsonValue | null | undefined): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private async validateDataScopeMemberIds(memberIds: string[]) {
    if (this.dataScopes) return this.dataScopes.validateAssignedMembers(memberIds);
    return [...new Set(memberIds.filter(Boolean))];
  }

  private async assertTeamExists(id: string) {
    const team = await this.prisma.adminTeam.findUnique({ where: { id } });
    if (!team) throw new BusinessException(404522, '团队不存在', 404);
    return team;
  }

  private async assertActiveAdmin(id: string) {
    const admin = await this.prisma.adminUser.findFirst({ where: { id, status: AdminStatus.ACTIVE, deletedAt: null } });
    if (!admin) throw new BusinessException(404506, '成员不存在或已停用', 404);
    return admin;
  }

  private async teamDescendantIds(id: string) {
    const teams = await this.prisma.adminTeam.findMany({ select: { id: true, parentId: true } });
    const result = new Set<string>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const team of teams) {
        if (team.parentId === id || (team.parentId && result.has(team.parentId))) {
          if (!result.has(team.id)) {
            result.add(team.id);
            changed = true;
          }
        }
      }
    }
    return [...result];
  }

  private statusText(status: AppointmentStatus) {
    const map: Record<AppointmentStatus, string> = {
      PENDING_CONTACT: '待联系',
      CONTACTED: '已联系',
      CONFIRMED: '已确认',
      VISITED: '已到诊',
      CANCELLED: '已取消',
      INVALID: '无效线索'
    };
    return map[status];
  }

  private followupForwardStatusText(status: FollowupForwardStatus) {
    const map: Record<FollowupForwardStatus, string> = {
      PENDING: '待转发',
      SUCCESS: '已转发',
      FAILED: '转发失败',
      SKIPPED: '未启用'
    };
    return map[status] || status;
  }

  private canViewFullPhone(user: AdminCurrentUser) {
    return user.role === AdminRole.SUPER_ADMIN || user.permissions.includes('VIEW_FULL_PHONE');
  }

  private parsePermissions(value: Prisma.JsonValue): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private async markLoginFailed(key: string) {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 900);
    }
  }

  private page(value?: string) {
    return Math.max(1, Number(value || 1));
  }

  private pageSize(value?: string) {
    return Math.min(100, Math.max(1, Number(value || 20)));
  }

  private ua(userAgent?: string | string[]) {
    return Array.isArray(userAgent) ? userAgent.join(';') : userAgent;
  }

  private csvCell(value: unknown) {
    return csvCell(value);
  }
}
