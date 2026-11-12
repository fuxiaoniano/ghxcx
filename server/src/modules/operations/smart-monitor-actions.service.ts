import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AdminCurrentUser } from '../../common/decorators/current-user.decorator';
import { PromotionAccountAccessService } from '../../common/data-scope/promotion-account-access.service';
import { BusinessException } from '../../common/utils/business-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PromotionDataSyncService, TencentMarketingApiError } from './promotion-data-sync.service';

export type CreativeConfiguredStatus = 'AD_STATUS_NORMAL' | 'AD_STATUS_SUSPEND';

@Injectable()
export class SmartMonitorActionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SmartMonitorActionsService.name);
  private scheduleTimer?: NodeJS.Timeout;
  private scheduleRunning = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PromotionAccountAccessService,
    private readonly sync: PromotionDataSyncService,
    private readonly audit: AuditLogsService,
  ) {}

  onModuleInit() {
    this.scheduleTimer = setInterval(() => void this.runScheduledActions().catch(() => this.logger.warn('定时创意任务扫描失败；未发起腾讯写请求')), 15_000);
    this.scheduleTimer.unref();
  }

  onModuleDestroy() { if (this.scheduleTimer) clearInterval(this.scheduleTimer); }

  async listActions(accountId: string, user: AdminCurrentUser) {
    const account = await this.prisma.promotionAccount.findFirst({ where: { AND: [await this.access.where(user, 'CREATIVES'), { id: accountId, status: 'ACTIVE', platform: { contains: '腾讯' } }] }, select: { id: true } });
    if (!account) throw new BusinessException(403973, '账户不在当前创意数据范围', 403);
    const rows = await this.prisma.smartMonitorAction.findMany({ where: { accountId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return rows.map((row) => ({ ...this.summary(row), action: row.action, scheduledAt: row.scheduledAt, attemptedAt: row.attemptedAt, createdAt: row.createdAt, replacementId: row.replacementId }));
  }

  async cancelSchedule(accountId: string, actionId: string, user: AdminCurrentUser) {
    await this.authorizedAccount(accountId, user);
    const record = await this.prisma.smartMonitorAction.findFirst({ where: { id: actionId, accountId, action: 'SCHEDULE_RESUME_CREATIVE', requestedByAdminId: user.adminUserId } });
    if (!record) throw new BusinessException(404978, '未找到本人在该账户的定时任务', 404);
    const changed = await this.prisma.smartMonitorAction.updateMany({ where: { id: actionId, status: 'SCHEDULED' }, data: { status: 'CANCELLED' } });
    if (!changed.count) throw new BusinessException(409979, '定时任务已开始执行或状态不明，不能取消', 409);
    await this.audit.create({ adminUserId: user.adminUserId, action: 'SMART_MONITOR_SCHEDULE_CANCEL', resourceType: 'smart_monitor_actions', resourceId: actionId,
      afterJson: { accountId, creativeId: record.creativeId, scheduledAt: record.scheduledAt?.toISOString() || null } });
    return { id: actionId, status: 'CANCELLED', creativeId: record.creativeId, adgroupId: record.adgroupId };
  }

  async deleteCreative(accountId: string, creativeId: string, confirmationCreativeId: string, idempotencyKey: string, reason: string, user: AdminCurrentUser) {
    if (confirmationCreativeId !== creativeId || !/^\d{1,16}$/.test(creativeId) || !Number.isSafeInteger(Number(creativeId)))
      throw new BusinessException(400977, '必须填写与目标完全一致的腾讯创意 ID', 400);
    const account = await this.authorizedAccount(accountId, user);
    const existing = await this.prisma.smartMonitorAction.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.accountId !== accountId || existing.creativeId !== creativeId || existing.action !== 'DELETE_CREATIVE' || existing.requestedByAdminId !== user.adminUserId)
        throw new BusinessException(409973, '幂等键已被其他操作占用', 409);
      return this.summary(existing);
    }
    const before = await this.getCreative(account.accountNo, creativeId, user.adminUserId);
    if (!before || before.is_deleted || !before.adgroup_id) throw new BusinessException(404973, '腾讯后台未确认该创意，已阻断删除', 404);
    const parent = await this.getAdgroup(account.accountNo, String(before.adgroup_id), user.adminUserId);
    if (!parent || parent.is_deleted) throw new BusinessException(404974, '腾讯后台未确认所属营销单元，已阻断删除', 404);
    await this.assertNoUncertainAction(accountId, creativeId);
    let record;
    try {
      record = await this.prisma.smartMonitorAction.create({ data: {
        accountId, adgroupId: String(before.adgroup_id), creativeId, action: 'DELETE_CREATIVE', status: 'PREFLIGHT_PASSED', idempotencyKey,
        requestedByAdminId: user.adminUserId, confirmedAt: new Date(), snapshotJson: {
          creativeId, adgroupId: String(before.adgroup_id), name: String(before.dynamic_creative_name || ''), configuredStatus: String(before.configured_status || ''),
          auditStatus: String(before.creative_set_approval_status || ''), parentConfiguredStatus: String(parent.configured_status || ''),
        },
      } });
    } catch (error) {
      const raced = await this.prisma.smartMonitorAction.findUnique({ where: { idempotencyKey } });
      if (raced && raced.accountId === accountId && raced.creativeId === creativeId && raced.action === 'DELETE_CREATIVE' && raced.requestedByAdminId === user.adminUserId) return this.summary(raced);
      throw error;
    }
    await this.audit.create({ adminUserId: user.adminUserId, action: 'SMART_MONITOR_CREATIVE_DELETE_REQUEST', resourceType: 'smart_monitor_actions', resourceId: record.id,
      afterJson: { accountId, creativeId, adgroupId: record.adgroupId, reason: reason.slice(0, 200) } });
    await this.prisma.smartMonitorAction.update({ where: { id: record.id }, data: { status: 'SUBMITTING', attemptedAt: new Date() } });
    let requestId: string | undefined;
    try {
      const response = await this.sync.tencentApi('POST', '/dynamic_creatives/delete', account.accountNo, { dynamic_creative_id: Number(creativeId) }, true, user.adminUserId);
      requestId = response.requestId;
      if (response.data?.dynamic_creative_id != null && String(response.data.dynamic_creative_id) !== creativeId)
        throw new BusinessException(502977, '腾讯返回的删除对象 ID 不一致', 502);
      await this.prisma.smartMonitorAction.update({ where: { id: record.id }, data: { status: 'PLATFORM_ACCEPTED', platformRequestId: requestId || null, responseSummary: { returnedId: response.data?.dynamic_creative_id ? String(response.data.dynamic_creative_id) : null } } });
    } catch (error) {
      const uncertain = !(error instanceof TencentMarketingApiError) || error.retryable;
      if (uncertain) {
        try { const deleted = await this.getCreative(account.accountNo, creativeId, user.adminUserId, true); if (deleted?.is_deleted === true && String(deleted.adgroup_id) === record.adgroupId) return this.confirmDeletion(record.id, accountId, creativeId, error instanceof TencentMarketingApiError ? error.requestId : requestId, user.adminUserId); }
        catch { /* Unknown: never blindly delete again. */ }
      }
      const updated = await this.prisma.smartMonitorAction.update({ where: { id: record.id }, data: { status: uncertain ? 'UNKNOWN_NEEDS_REVIEW' : 'FAILED', platformRequestId: error instanceof TencentMarketingApiError ? error.requestId || null : requestId || null,
        errorCode: error instanceof TencentMarketingApiError ? error.code : 'UNCONFIRMED', errorMessage: uncertain ? '删除结果不明；须回查腾讯后台，禁止重复删除或直接替换' : '腾讯明确拒绝删除' } });
      return this.summary(updated);
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 1200));
      try { const deleted = await this.getCreative(account.accountNo, creativeId, user.adminUserId, true); if (deleted?.is_deleted === true && String(deleted.adgroup_id) === record.adgroupId) return this.confirmDeletion(record.id, accountId, creativeId, requestId, user.adminUserId); }
      catch { /* A read error does not authorize another delete. */ }
    }
    const unknown = await this.prisma.smartMonitorAction.update({ where: { id: record.id }, data: { status: 'UNKNOWN_NEEDS_REVIEW', errorMessage: '腾讯已受理删除，但尚未回读到已删除状态；禁止自动重试' } });
    return this.summary(unknown);
  }

  private async confirmDeletion(recordId: string, accountId: string, creativeId: string, requestId: string | undefined, actorAdminId: string) {
    const updated = await this.prisma.smartMonitorAction.update({ where: { id: recordId }, data: { status: 'DELETED_CONFIRMED', verifiedAt: new Date(), platformRequestId: requestId || null, errorCode: null, errorMessage: null } });
    await this.prisma.smartMonitorCapability.upsert({ where: { accountId_endpoint: { accountId, endpoint: '/dynamic_creatives/delete' } },
      create: { accountId, endpoint: '/dynamic_creatives/delete', interfaceExists: true, projectImplemented: true, accountVerified: true, validationStatus: 'WRITE_READBACK_VERIFIED', requestId, verifiedAt: new Date(), safeNote: '指定创意删除后已回读 is_deleted=true' },
      update: { projectImplemented: true, accountVerified: true, validationStatus: 'WRITE_READBACK_VERIFIED', requestId, verifiedAt: new Date(), safeNote: '指定创意删除后已回读 is_deleted=true' } });
    await this.audit.create({ adminUserId: actorAdminId, action: 'SMART_MONITOR_CREATIVE_DELETE_CONFIRMED', resourceType: 'smart_monitor_actions', resourceId: recordId,
      afterJson: { accountId, creativeId, requestId: requestId || null } });
    return this.summary(updated);
  }

  async reconcileDeletion(accountId: string, actionId: string, user: AdminCurrentUser) {
    const account = await this.authorizedAccount(accountId, user);
    const record = await this.prisma.smartMonitorAction.findFirst({ where: { id: actionId, accountId, action: 'DELETE_CREATIVE', requestedByAdminId: user.adminUserId } });
    if (!record) throw new BusinessException(404977, '未找到本人在该账户的删除记录', 404);
    if (record.status === 'DELETED_CONFIRMED' || record.status === 'FAILED') return this.summary(record);
    const deleted = await this.getCreative(account.accountNo, record.creativeId, user.adminUserId, true);
    if (deleted?.is_deleted === true && String(deleted.adgroup_id) === record.adgroupId)
      return this.confirmDeletion(record.id, accountId, record.creativeId, record.platformRequestId || undefined, user.adminUserId);
    const unknown = await this.prisma.smartMonitorAction.update({ where: { id: record.id }, data: { status: 'UNKNOWN_NEEDS_REVIEW', verifiedAt: new Date(), errorMessage: '当前腾讯回读未证明已删除；需人工核对，禁止重复删除' } });
    return this.summary(unknown);
  }

  private async assertNoUncertainAction(accountId: string, creativeId: string) {
    const pending = await this.prisma.smartMonitorAction.findFirst({ where: { accountId, creativeId, action: { in: ['PAUSE_CREATIVE', 'RESUME_CREATIVE', 'DELETE_CREATIVE'] }, status: { in: ['SUBMITTING', 'PLATFORM_ACCEPTED', 'UNKNOWN_NEEDS_REVIEW'] } }, select: { id: true } });
    if (pending) throw new BusinessException(409978, '该创意存在结果不明或正在提交的操作，须先回读核对', 409);
  }

  async scheduleResume(accountId: string, creativeId: string, scheduledAt: Date, idempotencyKey: string, reason: string, user: AdminCurrentUser) {
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 60_000 || scheduledAt.getTime() > Date.now() + 30 * 86_400_000)
      throw new BusinessException(400975, '定时开启时间须在 1 分钟至 30 天后，并包含明确时区', 400);
    const account = await this.authorizedAccount(accountId, user);
    const existing = await this.prisma.smartMonitorAction.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.accountId !== accountId || existing.creativeId !== creativeId || existing.action !== 'SCHEDULE_RESUME_CREATIVE' || existing.requestedByAdminId !== user.adminUserId)
        throw new BusinessException(409973, '幂等键已被其他操作占用', 409);
      return this.summary(existing);
    }
    const creative = await this.getCreative(account.accountNo, creativeId, user.adminUserId);
    if (!creative || creative.is_deleted || !creative.adgroup_id || creative.configured_status !== 'AD_STATUS_SUSPEND')
      throw new BusinessException(409975, '仅允许为腾讯后台已暂停且归属明确的创意设置定时开启', 409);
    const parent = await this.getAdgroup(account.accountNo, String(creative.adgroup_id), user.adminUserId);
    if (!parent || parent.is_deleted) throw new BusinessException(404974, '上级营销单元不可用', 404);
    const pending = await this.prisma.smartMonitorAction.findFirst({ where: { accountId, creativeId, action: 'SCHEDULE_RESUME_CREATIVE', status: { in: ['SCHEDULED', 'SUBMITTING', 'UNKNOWN_NEEDS_REVIEW'] } }, select: { id: true } });
    if (pending) throw new BusinessException(409976, '该创意已有待执行或结果不明的定时开启任务', 409);
    const record = await this.prisma.smartMonitorAction.create({ data: {
      accountId, creativeId, adgroupId: String(creative.adgroup_id), action: 'SCHEDULE_RESUME_CREATIVE', status: 'SCHEDULED', idempotencyKey,
      requestedByAdminId: user.adminUserId, confirmedAt: new Date(), scheduledAt,
      snapshotJson: { creativeId, adgroupId: String(creative.adgroup_id), name: String(creative.dynamic_creative_name || ''), parentConfiguredStatus: String(parent.configured_status || ''), parentSystemStatus: String(parent.system_status || '') },
    } });
    await this.audit.create({ adminUserId: user.adminUserId, action: 'SMART_MONITOR_SCHEDULE_RESUME', resourceType: 'smart_monitor_actions', resourceId: record.id,
      afterJson: { accountId, creativeId, adgroupId: record.adgroupId, scheduledAt: scheduledAt.toISOString(), reason: reason.slice(0, 200) } });
    return this.summary(record);
  }

  async reconcile(accountId: string, actionId: string, user: AdminCurrentUser) {
    const account = await this.authorizedAccount(accountId, user);
    const record = await this.prisma.smartMonitorAction.findFirst({ where: { id: actionId, accountId, action: { in: ['PAUSE_CREATIVE', 'RESUME_CREATIVE'] }, requestedByAdminId: user.adminUserId } });
    if (!record) throw new BusinessException(404976, '未找到本人在该账户的状态操作记录', 404);
    if (record.status === 'CONFIRMED' || record.status === 'FAILED') return this.summary(record);
    const desired: CreativeConfiguredStatus = record.action === 'PAUSE_CREATIVE' ? 'AD_STATUS_SUSPEND' : 'AD_STATUS_NORMAL';
    const after = await this.getCreative(account.accountNo, record.creativeId, user.adminUserId);
    if (after && String(after.adgroup_id) === record.adgroupId && after.configured_status === desired)
      return this.confirm(record.id, accountId, record.creativeId, desired, record.platformRequestId || undefined, user.adminUserId);
    const unknown = await this.prisma.smartMonitorAction.update({ where: { id: record.id }, data: { status: 'UNKNOWN_NEEDS_REVIEW', verifiedAt: new Date(), errorMessage: '当前回读仍不一致；请人工核对，系统不会盲目重发' } });
    return this.summary(unknown);
  }

  async runScheduledActions() {
    if (this.scheduleRunning) return;
    this.scheduleRunning = true;
    try {
      const due = await this.prisma.smartMonitorAction.findMany({ where: { action: 'SCHEDULE_RESUME_CREATIVE', OR: [{ status: 'SCHEDULED', scheduledAt: { lte: new Date() } }, { status: 'SUBMITTING', attemptedAt: { lt: new Date(Date.now() - 120_000) } }] }, orderBy: { scheduledAt: 'asc' }, take: 5 });
      for (const task of due) {
        const claim = await this.prisma.smartMonitorAction.updateMany({ where: { id: task.id, status: task.status, attemptedAt: task.attemptedAt }, data: { status: 'SUBMITTING', attemptedAt: new Date() } });
        if (!claim.count) continue;
        try {
          const admin = await this.prisma.adminUser.findUnique({ where: { id: task.requestedByAdminId }, include: { customRole: true } });
          const storedPermissions = admin?.customRole?.permissionsJson ?? admin?.permissionsJson;
          const permissions = Array.isArray(storedPermissions) ? storedPermissions.filter((item): item is string => typeof item === 'string') : [];
          if (!admin || admin.status !== 'ACTIVE' || (admin.role !== 'SUPER_ADMIN' && !permissions.includes('PROMOTION_SMART_MONITOR_STATUS')))
            throw new BusinessException(403976, '预约人权限已失效，定时操作已阻断', 403);
          const user = { adminUserId: admin.id, username: admin.username, role: admin.role, permissions,
            dataScope: admin.role === 'SUPER_ADMIN' ? 'ALL' : (admin.customRole?.dataScope ?? admin.dataScope),
            dataScopeMemberIds: [], teamId: admin.teamId } as AdminCurrentUser;
          let result = await this.changeStatus(task.accountId, task.creativeId, 'AD_STATUS_NORMAL', `${task.idempotencyKey}-execute`, '智能监控持久化定时开启', user);
          if ('id' in result && result.id && ['SUBMITTING', 'PLATFORM_ACCEPTED', 'UNKNOWN_NEEDS_REVIEW'].includes(result.status))
            result = await this.reconcile(task.accountId, result.id, user);
          await this.prisma.smartMonitorAction.update({ where: { id: task.id }, data: { status: result.status === 'CONFIRMED' || result.status === 'ALREADY_SET' ? 'CONFIRMED' : result.status === 'FAILED' ? 'FAILED' : 'UNKNOWN_NEEDS_REVIEW', replacementId: 'id' in result ? result.id : null, verifiedAt: result.status === 'CONFIRMED' ? new Date() : null, errorMessage: 'errorMessage' in result ? result.errorMessage : null } });
        } catch {
          await this.prisma.smartMonitorAction.update({ where: { id: task.id }, data: { status: 'UNKNOWN_NEEDS_REVIEW', errorMessage: '定时执行未能确认结果；需先查询腾讯后台及关联状态操作，禁止直接重建' } });
        }
      }
    } finally { this.scheduleRunning = false; }
  }

  private async authorizedAccount(accountId: string, user: AdminCurrentUser) {
    const account = await this.prisma.promotionAccount.findFirst({ where: { AND: [await this.access.where(user, 'CREATIVES'), { id: accountId, status: 'ACTIVE', platform: { contains: '腾讯' }, accountNo: { not: null } }] } });
    if (!account?.accountNo) throw new BusinessException(403973, '创意所属账户不存在或不在当前数据范围', 403);
    await this.access.assertCanCreateCreatives(user, account);
    return account as typeof account & { accountNo: string };
  }

  async changeStatus(accountId: string, creativeId: string, desired: CreativeConfiguredStatus, idempotencyKey: string, reason: string, user: AdminCurrentUser) {
    const account = await this.authorizedAccount(accountId, user);
    if (!/^\d{1,16}$/.test(creativeId) || !Number.isSafeInteger(Number(creativeId))) throw new BusinessException(400973, '腾讯创意 ID 格式不正确', 400);
    const action = desired === 'AD_STATUS_SUSPEND' ? 'PAUSE_CREATIVE' : 'RESUME_CREATIVE';
    const existing = await this.prisma.smartMonitorAction.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.accountId !== accountId || existing.creativeId !== creativeId || existing.action !== action || existing.requestedByAdminId !== user.adminUserId) throw new BusinessException(409973, '幂等键已被其他操作占用', 409);
      return this.summary(existing);
    }
    // A creative-level query must prove identity and parent adgroup before any write.
    const before = await this.getCreative(account.accountNo, creativeId, user.adminUserId);
    if (!before || before.is_deleted || !before.adgroup_id) throw new BusinessException(404973, '腾讯后台未确认该创意及其所属营销单元，已阻断操作', 404);
    if (before.configured_status === desired) return { status: 'ALREADY_SET', creativeId, adgroupId: String(before.adgroup_id), platformRequestId: null };
    const parent = await this.getAdgroup(account.accountNo, String(before.adgroup_id), user.adminUserId);
    if (!parent || parent.is_deleted) throw new BusinessException(404974, '腾讯后台未确认上级营销单元，已阻断操作', 404);
    await this.assertNoUncertainAction(accountId, creativeId);
    let record;
    try {
      record = await this.prisma.smartMonitorAction.create({ data: {
        accountId, adgroupId: String(before.adgroup_id), creativeId, action, status: 'PREFLIGHT_PASSED', idempotencyKey,
        requestedByAdminId: user.adminUserId, confirmedAt: new Date(),
        snapshotJson: { creativeId, adgroupId: String(before.adgroup_id), name: String(before.dynamic_creative_name || ''),
          configuredStatus: String(before.configured_status || ''), auditStatus: String(before.creative_set_approval_status || ''),
          parentConfiguredStatus: String(parent.configured_status || ''), parentSystemStatus: String(parent.system_status || '') },
      } });
    } catch (error) {
      const raced = await this.prisma.smartMonitorAction.findUnique({ where: { idempotencyKey } });
      if (raced && raced.accountId === accountId && raced.creativeId === creativeId && raced.action === action && raced.requestedByAdminId === user.adminUserId) return this.summary(raced);
      throw error;
    }
    await this.audit.create({ adminUserId: user.adminUserId, action: 'SMART_MONITOR_CREATIVE_STATUS_REQUEST', resourceType: 'smart_monitor_actions', resourceId: record.id,
      afterJson: { accountId, adgroupId: record.adgroupId, creativeId, desired, reason: reason.slice(0, 200) } });
    await this.prisma.smartMonitorAction.update({ where: { id: record.id }, data: { status: 'SUBMITTING', attemptedAt: new Date() } });
    let requestId: string | undefined;
    try {
      const response = await this.sync.tencentApi('POST', '/dynamic_creatives/update', account.accountNo, { dynamic_creative_id: Number(creativeId), configured_status: desired }, true, user.adminUserId);
      requestId = response.requestId;
      const returnedId = response.data?.dynamic_creative_id;
      if (returnedId != null && String(returnedId) !== creativeId) throw new BusinessException(502973, '腾讯返回创意 ID 与请求对象不一致', 502);
      await this.prisma.smartMonitorAction.update({ where: { id: record.id }, data: { status: 'PLATFORM_ACCEPTED', platformRequestId: requestId || null, responseSummary: { returnedId: returnedId ? String(returnedId) : null } } });
    } catch (error) {
      const uncertain = !(error instanceof TencentMarketingApiError) || error.retryable || error.code === 'TIMEOUT';
      if (uncertain) {
        try {
          const after = await this.getCreative(account.accountNo, creativeId, user.adminUserId);
          if (after && String(after.adgroup_id) === record.adgroupId && after.configured_status === desired) {
            return this.confirm(record.id, accountId, creativeId, desired, error instanceof TencentMarketingApiError ? error.requestId : requestId, user.adminUserId);
          }
        } catch { /* Unknown is safer than replaying a possibly accepted write. */ }
      }
      const updated = await this.prisma.smartMonitorAction.update({ where: { id: record.id }, data: {
        status: uncertain ? 'UNKNOWN_NEEDS_REVIEW' : 'FAILED', platformRequestId: error instanceof TencentMarketingApiError ? error.requestId || null : null,
        errorCode: error instanceof TencentMarketingApiError ? error.code : 'UNCONFIRMED', errorMessage: uncertain ? '提交结果不明；须先回读创意状态，禁止直接重发' : '腾讯接口明确拒绝状态更新',
      } });
      return this.summary(updated);
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 1200));
      let after;
      try {
        after = await this.getCreative(account.accountNo, creativeId, user.adminUserId);
      } catch { continue; /* Eventual consistency or read failure is not a reason to re-submit. */ }
      if (after && String(after.adgroup_id) === record.adgroupId && after.configured_status === desired)
        return this.confirm(record.id, accountId, creativeId, desired, requestId, user.adminUserId);
    }
    const unknown = await this.prisma.smartMonitorAction.update({ where: { id: record.id }, data: { status: 'UNKNOWN_NEEDS_REVIEW', errorMessage: '腾讯已受理，但创意状态尚未回读一致；禁止直接重发' } });
    return this.summary(unknown);
  }

  private async confirm(recordId: string, accountId: string, creativeId: string, desired: CreativeConfiguredStatus, requestId: string | undefined, actorAdminId: string) {
    const updated = await this.prisma.smartMonitorAction.update({ where: { id: recordId }, data: { status: 'CONFIRMED', verifiedAt: new Date(), platformRequestId: requestId || null, errorCode: null, errorMessage: null } });
    await this.prisma.smartMonitorCapability.upsert({ where: { accountId_endpoint: { accountId, endpoint: '/dynamic_creatives/update' } },
      create: { accountId, endpoint: '/dynamic_creatives/update', interfaceExists: true, projectImplemented: true, accountVerified: true, validationStatus: 'WRITE_READBACK_VERIFIED', requestId, verifiedAt: new Date(), safeNote: '指定创意状态更新后已按账户及创意 ID 回读' },
      update: { projectImplemented: true, accountVerified: true, validationStatus: 'WRITE_READBACK_VERIFIED', requestId, verifiedAt: new Date(), safeNote: '指定创意状态更新后已按账户及创意 ID 回读' } });
    await this.audit.create({ adminUserId: actorAdminId, action: 'SMART_MONITOR_CREATIVE_STATUS_CONFIRMED', resourceType: 'smart_monitor_actions', resourceId: recordId,
      afterJson: { accountId, creativeId, desired, requestId: requestId || null } });
    return this.summary(updated);
  }

  private async getCreative(accountNo: string, creativeId: string, actorAdminId: string, isDeleted = false) {
    const response = await this.sync.tencentApi('GET', '/dynamic_creatives/get', accountNo, {
      fields: JSON.stringify(['dynamic_creative_id', 'dynamic_creative_name', 'adgroup_id', 'configured_status', 'creative_set_approval_status', 'is_deleted']),
      filtering: JSON.stringify([{ field: 'dynamic_creative_id', operator: 'EQUALS', values: [creativeId] }]), page: 1, page_size: 20, is_deleted: isDeleted,
    }, true, actorAdminId);
    return (Array.isArray(response.data?.list) ? response.data.list : []).find((row: Record<string, unknown>) => String(row.dynamic_creative_id) === creativeId) as Record<string, any> | undefined;
  }

  private async getAdgroup(accountNo: string, adgroupId: string, actorAdminId: string) {
    const response = await this.sync.tencentApi('GET', '/adgroups/get', accountNo, {
      fields: JSON.stringify(['adgroup_id', 'configured_status', 'system_status', 'is_deleted']),
      filtering: JSON.stringify([{ field: 'adgroup_id', operator: 'EQUALS', values: [adgroupId] }]), page: 1, page_size: 20, is_deleted: false,
    }, true, actorAdminId);
    return (Array.isArray(response.data?.list) ? response.data.list : []).find((row: Record<string, unknown>) => String(row.adgroup_id) === adgroupId) as Record<string, any> | undefined;
  }

  private summary(record: { id: string; status: string; creativeId: string; adgroupId: string; platformRequestId?: string | null; errorCode?: string | null; errorMessage?: string | null; verifiedAt?: Date | null }) {
    return { id: record.id, status: record.status, creativeId: record.creativeId, adgroupId: record.adgroupId, platformRequestId: record.platformRequestId || null, errorCode: record.errorCode || null, errorMessage: record.errorMessage || null, verifiedAt: record.verifiedAt || null };
  }
}
