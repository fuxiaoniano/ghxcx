import { Inject, Injectable } from '@nestjs/common';
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
  NotificationChannel,
  NotificationStatus,
  Prisma
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import Redis from 'ioredis';
import { createHash, randomBytes } from 'crypto';
import { renameSync } from 'fs';
import { extname } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminCurrentUser } from '../../common/decorators/current-user.decorator';
import { BusinessException } from '../../common/utils/business-exception';
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
import { AdminLoginDto, CreateLandingPageDto } from './dto';

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
    @Inject('REDIS') private readonly redis: Redis
  ) {}

  async login(dto: AdminLoginDto, ip?: string, userAgent?: string | string[]) {
    const failKey = `admin:login:fail:${dto.username}:${ip || 'unknown'}`;
    const fails = Number((await this.redis.get(failKey)) || 0);
    if (fails >= 5) {
      throw new BusinessException(401501, '登录失败次数过多，请 15 分钟后再试', 401);
    }
    const admin = await this.prisma.adminUser.findUnique({ where: { username: dto.username } });
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
    const permissions = this.parsePermissions(admin.permissionsJson);
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
      permissions
    });
    return {
      token,
      user: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname || admin.username,
        role: admin.role,
        permissions
      }
    };
  }

  async createWechatLoginSession() {
    const sessionId = randomBytes(24).toString('hex');
    await this.redis.set(this.wechatLoginKey(sessionId), JSON.stringify({ status: 'PENDING' }), 'EX', 300);
    const base = (this.config.get<string>('SERVER_BASE_URL') || 'https://zbsfxn.cqzbskq.com').replace(/\/$/, '');
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
    const admin = await this.prisma.adminUser.findUnique({ where: { id: session.adminUserId } });
    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      return { status: 'ERROR', message: '后台账号不存在或已停用' };
    }
    const permissions = this.parsePermissions(admin.permissionsJson);
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
        permissions
      }),
      user: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname || admin.username,
        role: admin.role,
        permissions
      }
    };
  }

  async dashboard() {
    const todayStart = dayjs().startOf('day').toDate();
    const sevenDaysAgo = dayjs().subtract(6, 'day').startOf('day').toDate();
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
      this.prisma.appointment.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.appointment.count(),
      this.prisma.appointment.count({ where: { status: AppointmentStatus.PENDING_CONTACT } }),
      this.prisma.appointment.count({ where: { status: AppointmentStatus.CONFIRMED } }),
      this.prisma.notificationLog.count(),
      this.prisma.notificationLog.count({ where: { status: NotificationStatus.SUCCESS } }),
      this.prisma.appointment.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { clinic: true }
      }),
      this.prisma.appointment.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
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

  async users(query: Record<string, string>) {
    const page = this.page(query.page);
    const pageSize = this.pageSize(query.pageSize);
    const where: Prisma.UserWhereInput = {};
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

  async userDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        identities: true,
        appointments: { orderBy: { createdAt: 'desc' }, include: { clinic: true } }
      }
    });
    if (!user) {
      throw new BusinessException(404501, '用户不存在');
    }
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

  async appointments(query: Record<string, string>) {
    const page = this.page(query.page);
    const pageSize = this.pageSize(query.pageSize);
    const where = this.appointmentWhere(query);
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

  async appointmentDetail(id: string) {
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

  async notificationLogs(query: Record<string, string>) {
    const page = this.page(query.page);
    const pageSize = this.pageSize(query.pageSize);
    const where: Prisma.NotificationLogWhereInput = {};
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
    return this.configsService.getAll();
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

  async updateConfigs(
    configs: Array<{ key: string; valueJson: Record<string, unknown>; description?: string }>,
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    this.requireConfigPermission(user);
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
    const base = this.config.get<string>('SERVER_BASE_URL') || 'https://zbsfxn.cqzbskq.com';
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
    return {
      enabled: value.enabled !== false,
      subscribeReplyEnabled: value.subscribeReplyEnabled !== false,
      subscribeReply:
        text(value.subscribeReply) ||
        '欢迎关注！如需种植牙咨询或预约挂号，请点击公众号菜单“立即挂号”提交信息，工作人员会尽快联系您。',
      messageReplyEnabled: value.messageReplyEnabled !== false,
      messageReply:
        text(value.messageReply) ||
        '您好，已收到您的消息。如需预约挂号，请点击公众号菜单“立即挂号”；如需人工协助，工作人员会尽快查看并联系您。',
      keywordReplyEnabled: value.keywordReplyEnabled !== false,
      keywordRules
    };
  }

  async adminUsers(query: Record<string, string>) {
    const page = this.page(query.page);
    const pageSize = this.pageSize(query.pageSize);
    const where: Prisma.AdminUserWhereInput = {};
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
      nickname?: string;
      password?: string;
      role?: AdminRole;
      permissions?: string[];
      status?: AdminStatus;
      notifyEnabled?: boolean;
    },
    user: AdminCurrentUser,
    ip?: string,
    userAgent?: string | string[]
  ) {
    const before = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!before) {
      throw new BusinessException(404506, '管理员账号不存在');
    }
    const targetRole = dto.role || before.role;
    this.assertCanManageAdminTarget(user, targetRole);
    if (id === user.adminUserId && dto.status === AdminStatus.DISABLED) {
      throw new BusinessException(400507, '不能停用当前登录账号');
    }
    if (id === user.adminUserId && before.role === AdminRole.SUPER_ADMIN && dto.role && dto.role !== AdminRole.SUPER_ADMIN) {
      throw new BusinessException(400513, '不能降低当前超级管理员自己的角色');
    }
    const data: Prisma.AdminUserUpdateInput = {};
    if (dto.nickname) {
      data.nickname = dto.nickname.trim();
    }
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    if (dto.role) {
      data.role = dto.role;
    }
    if (dto.permissions) {
      data.permissionsJson = this.normalizePermissions(dto.permissions);
    }
    if (dto.status) {
      data.status = dto.status;
    }
    if (dto.notifyEnabled !== undefined) {
      data.notifyEnabled = dto.notifyEnabled;
    }
    const updated = await this.prisma.adminUser.update({ where: { id }, data });
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
    if (includeFullPhone && user.role !== AdminRole.SUPER_ADMIN) {
      throw new BusinessException(403505, '只有 SUPER_ADMIN 可以导出完整手机号', 403);
    }
    const rows = await this.prisma.appointment.findMany({
      where: this.appointmentWhere(query),
      include: { clinic: true, doctor: true, dentalCategory: true, dentalProject: true, package: true },
      orderBy: { createdAt: 'desc' },
      take: 5000
    });
    if (includeFullPhone) {
      await this.audit.create({
        adminUserId: user.adminUserId,
        action: 'EXPORT_FULL_PHONE',
        resourceType: 'appointments',
        afterJson: { count: rows.length },
        ip,
        userAgent: this.ua(userAgent)
      });
    }
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

  private adminUserItem(row: {
    id: string;
    username: string;
    nickname: string;
    role: AdminRole;
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
  }) {
    return {
      id: row.id,
      username: row.username,
      nickname: row.nickname || row.username,
      role: row.role,
      permissions: this.parsePermissions(row.permissionsJson),
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
    const base = (this.config.get<string>('SERVER_BASE_URL') || 'https://zbsfxn.cqzbskq.com').replace(/\/$/, '');
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
    return Array.from(new Set(permissions || []));
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
    if (user.role !== AdminRole.SUPER_ADMIN && !user.permissions.includes('MANAGE_CONFIGS')) {
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
    if (!user.permissions.includes('MANAGE_ADMINS')) {
      throw new BusinessException(403507, '当前账号无子账号管理权限', 403);
    }
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
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }
}
