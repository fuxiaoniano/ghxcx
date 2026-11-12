import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ContentStatus, Prisma, WechatGroupDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/utils/business-exception';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AdminCurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Durable, fail-closed outbox. No personal-WeChat transport is enabled here:
 * an adapter must first prove stable group IDs and client-side verification.
 */
@Injectable()
export class WechatGroupNotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WechatGroupNotificationsService.name);
  private timer?: ReturnType<typeof setInterval>;
  private scanning = false;

  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogsService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.compensate(), 30_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueueForAppointment(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId }, select: { id: true, landingPageId: true, createdAt: true }
    });
    if (!appointment?.landingPageId) return 0;
    const routes = await this.prisma.wechatGroupRoute.findMany({
      where: {
        landingPageId: appointment.landingPageId,
        enabled: true,
        activatedAt: { lte: appointment.createdAt },
        landingPage: { status: ContentStatus.ACTIVE },
        group: { verified: true }
      },
      select: { id: true, groupId: true }
    });
    if (!routes.length) return 0;
    const result = await this.prisma.wechatGroupDelivery.createMany({
      data: routes.map((route) => ({
        appointmentId, routeId: route.id, groupId: route.groupId,
        notificationType: 'NEW_APPOINTMENT', status: WechatGroupDeliveryStatus.PENDING
      })),
      skipDuplicates: true
    });
    return result.count;
  }

  /** Re-scan unsent appointments, including any insert that crashed before enqueue. */
  async compensate() {
    if (this.scanning) return;
    this.scanning = true;
    try {
      const routes = await this.prisma.wechatGroupRoute.findMany({
        where: { enabled: true, landingPage: { status: ContentStatus.ACTIVE }, group: { verified: true } },
        select: { id: true, groupId: true, landingPageId: true, activatedAt: true }
      });
      for (const route of routes) {
        if (!route.activatedAt) continue;
        const rows = await this.prisma.appointment.findMany({
          where: {
            landingPageId: route.landingPageId, createdAt: { gte: route.activatedAt },
            wechatGroupDeliveries: { none: { groupId: route.groupId, notificationType: 'NEW_APPOINTMENT' } }
          },
          select: { id: true }, orderBy: { createdAt: 'asc' }, take: 100
        });
        if (rows.length) await this.prisma.wechatGroupDelivery.createMany({
          data: rows.map((row) => ({
            appointmentId: row.id, groupId: route.groupId, routeId: route.id,
            notificationType: 'NEW_APPOINTMENT', status: WechatGroupDeliveryStatus.PENDING
          })),
          skipDuplicates: true
        });
      }
    } catch (error) {
      // Never include patient data or connector credentials in ordinary logs.
      this.logger.error(`群通知补偿扫描失败: ${error instanceof Error ? error.name : 'unknown'}`);
    } finally {
      this.scanning = false;
    }
  }

  async overview() {
    const [senders, groups, pages, routes] = await Promise.all([
      this.prisma.wechatGroupSender.findMany({ select: {
        id: true, status: true, nickname: true, clientVersion: true,
        adapterVersion: true, lastHeartbeatAt: true, lastError: true
      } }),
      this.prisma.wechatTargetGroup.findMany({ select: {
        id: true, senderId: true, nameSnapshot: true, verified: true, lastVerifiedAt: true
      }, orderBy: { nameSnapshot: 'asc' } }),
      this.prisma.landingPage.findMany({ select: {
        id: true, name: true, pageKey: true, status: true
      }, orderBy: { createdAt: 'desc' } }),
      this.prisma.wechatGroupRoute.findMany({ select: {
        id: true, landingPageId: true, groupId: true, enabled: true,
        includeFullPhone: true, activatedAt: true, createdAt: true
      }, orderBy: { createdAt: 'desc' } })
    ]);
    return {
      transportReady: false,
      blocker: '尚未完成专用微信号、稳定群标识及真实群发送/核对验证，禁止启用自动发送。',
      senders, groups, pages, routes
    };
  }

  async deliveries(query: { page?: string; pageSize?: string; status?: string; landingPageId?: string; groupId?: string; appointmentNo?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const where: Prisma.WechatGroupDeliveryWhereInput = {};
    if (query.status && Object.values(WechatGroupDeliveryStatus).includes(query.status as WechatGroupDeliveryStatus))
      where.status = query.status as WechatGroupDeliveryStatus;
    if (query.landingPageId) where.route = { landingPageId: query.landingPageId };
    if (query.groupId) where.groupId = query.groupId;
    if (query.appointmentNo) where.appointment = { appointmentNo: { contains: query.appointmentNo.slice(0, 40) } };
    const [total, rows] = await Promise.all([
      this.prisma.wechatGroupDelivery.count({ where }),
      this.prisma.wechatGroupDelivery.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, status: true, attemptCount: true, firstSentAt: true, confirmedAt: true,
          createdAt: true, lastErrorCode: true, lastErrorMessage: true,
          appointment: { select: { appointmentNo: true, phoneMasked: true } },
          group: { select: { nameSnapshot: true } },
          route: { select: { landingPage: { select: { name: true } } } }
        }
      })
    ]);
    return { total, page, pageSize, list: rows };
  }

  async createRoute(landingPageId: string, groupId: string, user: AdminCurrentUser, ip?: string, userAgent?: string) {
    const [page, group] = await Promise.all([
      this.prisma.landingPage.findUnique({ where: { id: landingPageId } }),
      this.prisma.wechatTargetGroup.findUnique({ where: { id: groupId }, include: { sender: true } })
    ]);
    if (!page || page.status !== ContentStatus.ACTIVE) throw new BusinessException(400901, '留资页面不可用');
    if (!group || !group.verified || group.sender.status !== 'ONLINE')
      throw new BusinessException(400902, '目标群尚未通过发送端稳定标识及在线验证');
    const route = await this.prisma.wechatGroupRoute.upsert({
      where: { landingPageId_groupId: { landingPageId, groupId } },
      create: { landingPageId, groupId, createdById: user.adminUserId },
      update: { updatedById: user.adminUserId }
    });
    await this.audit.create({ adminUserId: user.adminUserId, action: 'CREATE_WECHAT_GROUP_ROUTE',
      resourceType: 'wechat_group_routes', resourceId: route.id,
      afterJson: { landingPageId, groupId, enabled: false }, ip, userAgent });
    return route;
  }

  async enableRoute(_id: string): Promise<never> {
    throw new BusinessException(400903, '微信发送端未完成真实联调，当前禁止启用路由');
  }
}
