import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { AdminCurrentUser } from '../../common/decorators/current-user.decorator';
import { DataScopeService } from '../../common/data-scope/data-scope.service';
import { PromotionAccountAccessService } from '../../common/data-scope/promotion-account-access.service';
import { BusinessException } from '../../common/utils/business-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CreativeDefaultComponentDto, MultiAccountCreativeBatchRequestDto, MultiAccountCreativeTaskQueryDto,
  PromotionCreativeAdgroupQueryDto, PromotionCreativeAssetQueryDto, PromotionCreativeTemplateQueryDto,
} from './dto';
import { generateMultiCreativeCombinations, MultiCreativeCombinationValidationError } from './multi-account-creative-combinations';
import { matchesTencentCreativeRecord, normalizeTencentCreativeComponentsForVerification } from './multi-account-creative-verification';
import { PromotionCreativeBatchService } from './promotion-creative-batch.service';
import { PromotionDataSyncService, TencentMarketingApiError } from './promotion-data-sync.service';

type PlatformRecord = Record<string, any>;
type PreparedAsset = {
  snapshot: any; fingerprint: string; type: string; field: string; component: PlatformRecord;
  mappingStatus: 'AVAILABLE' | 'AUTHORIZED' | 'NEED_DISTRIBUTION' | 'NOT_AVAILABLE' | 'INVALID' | 'UNKNOWN';
  targetPlatformAssetId?: string; validationSource?: string; reason?: string; platformStatus?: string;
  platformWidth?: number; platformHeight?: number; platformCoverId?: string;
};
type PreparedTarget = {
  account: any; adgroup: PlatformRecord; templateId: string; templateName: string; template: PlatformRecord;
  requirements: PlatformRecord[]; status: 'PASSED' | 'FAILED'; reasons: string[]; mappings: PreparedAsset[];
  defaults: Array<{ config: any; field: string; component: PlatformRecord; sourceSnapshotId?: string }>;
  combinations: Array<{ titleIds: string[]; videoIds: string[]; imageIds: string[] }>;
  items: Array<{ name: string; fingerprint: string; idempotencyKey: string; payload: PlatformRecord; material: PlatformRecord }>;
};

const ADGROUP_FIELDS = JSON.stringify([
  'adgroup_id', 'adgroup_name', 'configured_status', 'system_status', 'created_time', 'is_deleted',
  'marketing_goal', 'marketing_sub_goal', 'marketing_carrier_type', 'marketing_target_type',
  'marketing_target_id', 'optimization_goal', 'site_set',
]);
const COMPONENT_FIELDS = JSON.stringify([
  'account_id', 'organization_id', 'component_id', 'component_value', 'created_time', 'last_modified_time',
  'component_sub_type', 'component_custom_name', 'is_deleted', 'disable_message', 'first_publication_status',
]);

@Injectable()
export class MultiAccountCreativeBatchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MultiAccountCreativeBatchService.name);
  private worker?: NodeJS.Timeout;
  private workerBusy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: PromotionDataSyncService,
    private readonly single: PromotionCreativeBatchService,
    private readonly dataScopes: DataScopeService,
    private readonly audit: AuditLogsService,
    @Optional() private readonly promotionAccess?: PromotionAccountAccessService,
  ) {}

  onModuleInit() { this.worker = setInterval(() => void this.runWorker(), 5_000); void this.runWorker(); }
  onModuleDestroy() { if (this.worker) clearInterval(this.worker); }

  async options(user: AdminCurrentUser) {
    this.assertAnyPermission(user, ['PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW', 'PROMOTION_CREATIVE_DEFAULT_COMPONENT_VIEW']);
    const result = await this.single.options(user);
    const canCreate = this.has(user, 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CREATE');
    return {
      ...result,
      accounts: result.accounts.map((account) => ({
        ...account,
        canCreate: Boolean(account.authorized && account.hasUserToken && account.canCreate && canCreate),
      })),
    };
  }

  async adgroups(query: PromotionCreativeAdgroupQueryDto, user: AdminCurrentUser) {
    this.assertPermission(user, 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW');
    return this.single.adgroups(query, user);
  }

  async templates(query: PromotionCreativeTemplateQueryDto, user: AdminCurrentUser) {
    this.assertPermission(user, 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW');
    this.assertPermission(user, 'PROMOTION_CREATIVE_TEMPLATE_VIEW');
    return this.single.templates(query, user);
  }

  async assets(query: PromotionCreativeAssetQueryDto, user: AdminCurrentUser) {
    this.assertAnyPermission(user, ['PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW', 'PROMOTION_CREATIVE_DEFAULT_COMPONENT_MANAGE']);
    this.assertPermission(user, 'PROMOTION_CREATIVE_ASSET_VIEW');
    return this.single.assets(query, user);
  }

  async preflight(dto: MultiAccountCreativeBatchRequestDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    this.assertPermission(user, 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CREATE');
    this.assertPermission(user, 'PROMOTION_CREATIVE_TEMPLATE_VIEW');
    this.assertPermission(user, 'PROMOTION_CREATIVE_ASSET_VIEW');
    const prepared = await this.prepare(dto, user);
    if (this.promotionAccess) for (const target of prepared.targets.filter((item) => item.status === 'PASSED')) await this.promotionAccess.assertCanCreateCreatives(user, target.account);
    await this.audit.create({
      adminUserId: user.adminUserId, action: 'PREFLIGHT_MULTI_ACCOUNT_CREATIVE_BATCH', resourceType: 'multi_account_creative_batches',
      afterJson: this.preflightAudit(prepared) as Prisma.InputJsonValue, ip, userAgent: this.ua(userAgent),
    });
    return this.preflightResponse(prepared);
  }

  async create(dto: MultiAccountCreativeBatchRequestDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    this.assertPermission(user, 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CREATE');
    this.assertPermission(user, 'PROMOTION_CREATIVE_TEMPLATE_VIEW');
    this.assertPermission(user, 'PROMOTION_CREATIVE_ASSET_VIEW');
    const prepared = await this.prepare(dto, user);
    const failed = prepared.targets.filter((target) => target.status === 'FAILED');
    if (failed.length && !dto.allowSkipInvalid) throw new BusinessException(400881, `有 ${failed.length} 个目标预检失败；默认已阻断整个任务`, 400);
    const accepted = prepared.targets.filter((target) => target.status === 'PASSED');
    if (!accepted.length) throw new BusinessException(400882, '没有通过预检的账户和营销单元', 400);
    const normalized = this.redact({ dto, targets: prepared.targets.map((target) => ({
      accountId: target.account.id, adgroupId: String(target.adgroup.adgroup_id), templateId: target.templateId,
      status: target.status, itemFingerprints: target.items.map((item) => item.fingerprint),
    })) });
    const fingerprint = this.hash({ adminUserId: user.adminUserId, normalized });
    const recent = await this.prisma.multiAccountCreativeBatch.findFirst({
      where: { requestFingerprint: fingerprint, createdByAdminId: user.adminUserId, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) return { ...(await this.task(recent.id, user)), duplicate: true, message: '相同多账户任务已创建或正在执行' };
    const dedupeKey = this.hash(`${fingerprint}:${Math.floor(Date.now() / 600_000)}`);
    const itemKeys = accepted.flatMap((target) => target.items.map((item) => item.idempotencyKey));
    const existingItem = itemKeys.length ? await this.prisma.multiAccountCreativeBatchItem.findFirst({
      where: { idempotencyKey: { in: itemKeys } },
      include: { target: { select: { batchId: true, batch: { select: { createdByAdminId: true } } } } },
    }) : null;
    if (existingItem) {
      const existingBatch = existingItem.target.batch.createdByAdminId === user.adminUserId
        ? await this.prisma.multiAccountCreativeBatch.findUnique({ where: { id: existingItem.target.batchId } }) : null;
      if (existingBatch) return { ...(await this.task(existingBatch.id, user)), duplicate: true, message: '相同创意请求已存在，请在原任务中回查或重试，已阻止重复创建' };
      throw new BusinessException(409881, '相同创意请求已存在，已阻止重复创建', 409);
    }
    const taskNo = `MCB${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}${randomBytes(3).toString('hex').toUpperCase()}`;
    let batch;
    try {
      batch = await this.prisma.$transaction(async (tx) => {
        const created = await tx.multiAccountCreativeBatch.create({ data: {
          taskNo, dedupeKey, requestFingerprint: fingerprint, status: 'READY', creativeType: dto.creativeType,
          deliveryMode: dto.deliveryMode, combinationMode: dto.combinationMode,
          generationRules: dto.rules as unknown as Prisma.InputJsonValue, requestSnapshot: normalized as Prisma.InputJsonValue,
          allowSkipInvalid: Boolean(dto.allowSkipInvalid), totalAccountCount: new Set(accepted.map((target) => target.account.id)).size,
          totalAdgroupCount: accepted.length, totalCreativeCount: accepted.reduce((sum, target) => sum + target.items.length, 0),
          skippedCount: failed.length, createdByAdminId: user.adminUserId, submittedIp: ip, submittedUserAgent: this.ua(userAgent),
        } });
        const logicalBySnapshot = new Map<string, string>();
        for (const source of prepared.assets) {
          const logical = await tx.logicalCreativeAsset.create({ data: {
            batchId: created.id, sourceSnapshotId: source.id, assetType: source.assetType,
            sourceType: this.assetSource(source), sourceAccountId: source.originAccountId,
            sourceBusinessUnit: source.businessUnitKey, sourcePlatformAssetId: source.platformAssetId,
            name: source.name, fingerprint: this.assetFingerprint(source),
            specification: this.assetSpecification(source) as Prisma.InputJsonValue,
            snapshot: this.redact(source.payloadJson) as Prisma.InputJsonValue,
          } });
          logicalBySnapshot.set(source.id, logical.id);
        }
        const mappingsWritten = new Set<string>();
        for (const target of prepared.targets) {
          for (const mapping of target.mappings) {
            const logicalAssetId = logicalBySnapshot.get(mapping.snapshot.id)!;
            const key = `${logicalAssetId}:${target.account.id}`;
            if (mappingsWritten.has(key)) continue;
            mappingsWritten.add(key);
            await tx.creativeAssetTargetMapping.create({ data: {
              logicalAssetId, targetAccountId: target.account.id, targetPlatformAssetId: mapping.targetPlatformAssetId,
              mappingStatus: mapping.mappingStatus, validationSource: mapping.validationSource,
              failureReason: mapping.reason?.slice(0, 1000), platformAssetStatus: mapping.platformStatus,
              templateCompatible: target.status === 'PASSED', validatedAt: new Date(),
            } });
          }
          const targetKey = this.hash(`${created.id}:${target.account.id}:${target.adgroup.adgroup_id}`);
          const targetRow = await tx.multiAccountCreativeBatchTarget.create({ data: {
            batchId: created.id, accountId: target.account.id, adgroupId: String(target.adgroup.adgroup_id),
            adgroupName: String(target.adgroup.adgroup_name || ''), marketingGoal: target.adgroup.marketing_goal || null,
            templateId: target.templateId || null, templateName: target.templateName || null, creativeType: dto.creativeType,
            preflightStatus: target.status === 'PASSED' ? 'PASSED' : 'FAILED',
            preflightResult: { reasons: target.reasons } as Prisma.InputJsonValue,
            resolvedComponents: target.defaults.map((entry) => ({ type: entry.config.componentType, id: this.maskId(entry.config.platformComponentId), name: entry.config.componentName })) as Prisma.InputJsonValue,
            assetMappingResult: target.mappings.map((entry) => ({ asset: entry.snapshot.name, status: entry.mappingStatus, targetId: this.maskId(entry.targetPlatformAssetId), reason: entry.reason })) as Prisma.InputJsonValue,
            executionStatus: target.status === 'PASSED' ? 'PENDING' : 'SKIPPED', failureReason: target.reasons.join('；').slice(0, 1000) || null,
            idempotencyKey: targetKey,
          } });
          for (const [index, item] of target.items.entries()) await tx.multiAccountCreativeBatchItem.create({ data: {
            targetId: targetRow.id, sequence: index + 1, creativeName: item.name,
            materialCombination: item.material as Prisma.InputJsonValue,
            requestPayload: item.payload as Prisma.InputJsonValue, requestFingerprint: item.fingerprint,
            idempotencyKey: item.idempotencyKey,
          } });
        }
        return created;
      }, { timeout: 30_000 });
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error;
      const raced = await this.prisma.multiAccountCreativeBatch.findUnique({ where: { dedupeKey } });
      if (!raced) throw error;
      return { ...(await this.task(raced.id, user)), duplicate: true, message: '相同多账户任务已创建或正在执行' };
    }
    await this.audit.create({
      adminUserId: user.adminUserId, action: 'CREATE_MULTI_ACCOUNT_CREATIVE_BATCH', resourceType: 'multi_account_creative_batches',
      resourceId: batch.id, afterJson: this.preflightAudit(prepared) as Prisma.InputJsonValue, ip, userAgent: this.ua(userAgent),
    });
    for (const selection of dto.targets.filter((target) => target.componentOverrides?.length)) await this.audit.create({
      adminUserId: user.adminUserId,
      action: 'OVERRIDE_MULTI_ACCOUNT_CREATIVE_COMPONENTS',
      resourceType: 'multi_account_creative_batches',
      resourceId: batch.id,
      beforeJson: { strategy: 'ACCOUNT_DEFAULT', accountId: this.maskId(selection.accountId), adgroupIds: selection.adgroupIds.map((id) => this.maskId(id)) } as Prisma.InputJsonValue,
      afterJson: { overrides: selection.componentOverrides, reason: selection.overrideReason } as Prisma.InputJsonValue,
      ip,
      userAgent: this.ua(userAgent),
    });
    void this.runWorker();
    return { ...(await this.task(batch.id, user)), duplicate: false, message: '多账户创意任务已进入服务端执行队列' };
  }

  async tasks(query: MultiAccountCreativeTaskQueryDto, user: AdminCurrentUser) {
    this.assertPermission(user, 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW');
    const page = query.page || 1; const pageSize = query.pageSize || 20;
    const accountScope = await this.accountScope(user);
    const targetSome: Prisma.MultiAccountCreativeBatchTargetWhereInput = {
      account: accountScope, ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.adgroupId ? { adgroupId: query.adgroupId } : {}),
    };
    const where: Prisma.MultiAccountCreativeBatchWhereInput = {
      targets: { some: targetSome }, ...(query.status ? { status: query.status } : {}),
      ...(query.createdByAdminId ? { createdByAdminId: query.createdByAdminId } : {}),
      ...((query.dateFrom || query.dateTo) ? { createdAt: { ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}), ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59.999+08:00`) } : {}) } } : {}),
    };
    const [list, total] = await Promise.all([
      this.prisma.multiAccountCreativeBatch.findMany({ where, include: { targets: { where: { account: accountScope }, include: { account: { select: { id: true, name: true, accountNo: true } } } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.multiAccountCreativeBatch.count({ where }),
    ]);
    return { list: list.map((batch) => this.safeBatch(batch)), pageInfo: { page, pageSize, totalNumber: total, totalPage: Math.ceil(total / pageSize) } };
  }

  async task(id: string, user: AdminCurrentUser) {
    this.assertPermission(user, 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW');
    const accountScope = await this.accountScope(user);
    const batch = await this.prisma.multiAccountCreativeBatch.findFirst({
      where: { id, targets: { some: { account: accountScope } } },
      include: {
        logicalAssets: { where: { OR: [{ sourceSnapshotId: null }, { sourceSnapshot: { originAccount: accountScope } }] }, include: { mappings: { where: { targetAccount: accountScope }, include: { targetAccount: { select: { id: true, name: true, accountNo: true } } } } } },
        targets: { where: { account: accountScope }, include: { account: { select: { id: true, name: true, accountNo: true, project: true } }, items: { orderBy: { sequence: 'asc' } } }, orderBy: [{ accountId: 'asc' }, { adgroupId: 'asc' }] },
        submissionLogs: { where: { item: { target: { account: accountScope } } }, orderBy: { createdAt: 'desc' }, take: 200 },
      },
    });
    if (!batch) throw new BusinessException(404881, '多账户创意任务不存在或超出当前数据范围', 404);
    return this.safeBatch(batch);
  }

  async retry(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    this.assertPermission(user, 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_RETRY');
    const batch = await this.task(id, user);
    await this.assertFullTaskScope(id, batch.targets.length);
    if (batch.status === 'CANCELLED') throw new BusinessException(400883, '已取消任务不能重试', 400);
    let changed = 0;
    for (const target of batch.targets) for (const item of target.items) {
      if (item.platformCreativeId && ['PLATFORM_ACCEPTED', 'VERIFYING', 'UNKNOWN_NEEDS_REVIEW'].includes(item.status)) {
        await this.prisma.multiAccountCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'VERIFYING', errorCode: null, errorMessage: null } }); changed += 1;
      } else if (!item.platformCreativeId && item.status === 'FAILED') {
        await this.prisma.multiAccountCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'PENDING', errorCode: null, errorMessage: null, retryCount: { increment: 1 } } }); changed += 1;
      }
    }
    if (!changed) throw new BusinessException(400884, '没有可安全重试或回查的创意项', 400);
    await this.prisma.multiAccountCreativeBatch.update({ where: { id }, data: { status: 'RUNNING', completedAt: null } });
    await this.audit.create({ adminUserId: user.adminUserId, action: 'RETRY_MULTI_ACCOUNT_CREATIVE_BATCH', resourceType: 'multi_account_creative_batches', resourceId: id, afterJson: { count: changed } as Prisma.InputJsonValue, ip, userAgent: this.ua(userAgent) });
    void this.runWorker();
    return this.task(id, user);
  }

  async cancel(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    this.assertPermission(user, 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CANCEL');
    const batch = await this.task(id, user);
    await this.assertFullTaskScope(id, batch.targets.length);
    if (['SUCCEEDED', 'FAILED', 'PARTIAL_SUCCESS', 'COMPLETED_WITH_EXCEPTIONS', 'CANCELLED'].includes(batch.status)) {
      throw new BusinessException(400898, '已结束的任务不能取消', 400);
    }
    const pendingCount = await this.prisma.multiAccountCreativeBatchItem.count({ where: { target: { batchId: id }, status: 'PENDING' } });
    if (!pendingCount) throw new BusinessException(400899, '任务没有尚未提交的创意项，不能取消', 400);
    await this.prisma.$transaction([
      this.prisma.multiAccountCreativeBatchItem.updateMany({ where: { target: { batchId: id }, status: 'PENDING' }, data: { status: 'CANCELLED', errorMessage: '用户取消，尚未提交腾讯广告' } }),
      this.prisma.multiAccountCreativeBatchTarget.updateMany({ where: { batchId: id, executionStatus: 'PENDING' }, data: { executionStatus: 'CANCELLED' } }),
      this.prisma.multiAccountCreativeBatch.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), completedAt: new Date() } }),
    ]);
    await this.refreshCounts(id);
    await this.audit.create({ adminUserId: user.adminUserId, action: 'CANCEL_MULTI_ACCOUNT_CREATIVE_BATCH', resourceType: 'multi_account_creative_batches', resourceId: id, afterJson: { status: 'CANCELLED' } as Prisma.InputJsonValue, ip, userAgent: this.ua(userAgent) });
    return { id, cancelled: true };
  }

  async exportRows(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    this.assertPermission(user, 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_RESULT_EXPORT');
    const batch = await this.task(id, user);
    const rows = batch.targets.flatMap((target: PlatformRecord) => target.items.map((item: PlatformRecord) => ({
      taskNo: batch.taskNo, account: target.account.name, accountNo: target.account.accountNo, adgroup: target.adgroupName,
      adgroupId: target.adgroupId, creativeName: item.creativeName, status: item.status,
      platformCreativeId: item.platformCreativeId || '', errorCode: item.errorCode || '', errorMessage: item.errorMessage || '',
      submittedAt: item.lastRequestedAt, verifiedAt: item.lastVerifiedAt,
    })));
    await this.audit.create({ adminUserId: user.adminUserId, action: 'EXPORT_MULTI_ACCOUNT_CREATIVE_BATCH', resourceType: 'multi_account_creative_batches', resourceId: id, afterJson: { count: rows.length } as Prisma.InputJsonValue, ip, userAgent: this.ua(userAgent) });
    return rows;
  }

  async defaultComponents(accountId: string, user: AdminCurrentUser) {
    this.assertAnyPermission(user, ['PROMOTION_CREATIVE_DEFAULT_COMPONENT_VIEW', 'PROMOTION_CREATIVE_DEFAULT_COMPONENT_MANAGE', 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CREATE']);
    const account = await this.account(accountId, user);
    const rows = await this.prisma.creativeAccountDefaultComponent.findMany({ where: { accountId }, orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }] });
    return Promise.all(rows.map((row) => this.hydrateDefaultComponentName(accountId, String(account.accountNo), row)));
  }

  async saveDefaultComponent(dto: CreativeDefaultComponentDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    this.assertPermission(user, 'PROMOTION_CREATIVE_DEFAULT_COMPONENT_MANAGE');
    const account = await this.account(dto.accountId, user);
    const snapshot = await this.prisma.promotionCreativeMaterialSnapshot.findFirst({
      where: {
        originAccountId: account.id, platformAssetId: dto.platformComponentId, isDeleted: false,
        OR: [
          { platformAssetKind: 'COMPONENT' },
          { platformAssetKind: 'REFERENCE', assetType: 'LANDING_PAGE', componentField: { in: ['main_jump_info', 'jump_info', 'end_page'] } },
        ],
      },
    });
    if (!snapshot) throw new BusinessException(400885, '该组件不属于目标账户或尚未同步，不能设为默认组件', 400);
    const verified = await this.lookupAsset(account.accountNo!, snapshot);
    if (!verified.row) throw new BusinessException(400886, '腾讯后台未确认该账户可使用此组件', 400);
    const created = await this.prisma.creativeAccountDefaultComponent.create({ data: {
      ...dto, componentSnapshot: this.redact(snapshot.payloadJson) as Prisma.InputJsonValue, priority: dto.priority || 0,
      lastValidatedAt: new Date(), createdByAdminId: user.adminUserId, updatedByAdminId: user.adminUserId,
    } });
    await this.audit.create({ adminUserId: user.adminUserId, action: 'CREATE_CREATIVE_DEFAULT_COMPONENT', resourceType: 'creative_account_default_components', resourceId: created.id, afterJson: this.redact(created) as Prisma.InputJsonValue, ip, userAgent: this.ua(userAgent) });
    return created;
  }

  async deleteDefaultComponent(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    this.assertPermission(user, 'PROMOTION_CREATIVE_DEFAULT_COMPONENT_MANAGE');
    const row = await this.prisma.creativeAccountDefaultComponent.findUnique({ where: { id } });
    if (!row) throw new BusinessException(404882, '默认组件配置不存在', 404);
    await this.account(row.accountId, user);
    if (row.status === 'DISABLED') return { id, disabled: true, alreadyDisabled: true };
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.creativeAccountDefaultComponent.updateMany({ where: { id, status: 'ACTIVE' }, data: { status: 'DISABLED', updatedByAdminId: user.adminUserId } });
      if (!updated.count) return;
      await tx.auditLog.create({ data: {
        adminUserId: user.adminUserId, action: 'DISABLE_CREATIVE_DEFAULT_COMPONENT', resourceType: 'creative_account_default_components', resourceId: id,
        beforeJson: this.redact(row) as Prisma.InputJsonValue, afterJson: { status: 'DISABLED' } as Prisma.InputJsonValue,
        ip, userAgent: this.ua(userAgent),
      } });
    });
    return { id, disabled: true };
  }

  private async prepare(dto: MultiAccountCreativeBatchRequestDto, user: AdminCurrentUser) {
    const scope = await this.accountScope(user);
    const hasOverrides = dto.targets.some((target) => Boolean(target.componentOverrides?.length));
    if (hasOverrides) {
      this.assertPermission(user, 'PROMOTION_CREATIVE_DEFAULT_COMPONENT_MANAGE');
      if (dto.targets.some((target) => target.componentOverrides?.length && !target.overrideReason?.trim())) throw new BusinessException(400896, '覆盖账户默认组件时必须填写覆盖原因', 400);
    }
    const accountIds = [...new Set(dto.targets.map((item) => item.accountId))];
    const accounts = await this.prisma.promotionAccount.findMany({ where: { AND: [scope, { id: { in: accountIds }, status: ContentStatus.ACTIVE, platform: { contains: '腾讯' }, accountNo: { not: null } }] } });
    if (accounts.length !== accountIds.length) throw new BusinessException(403881, '部分目标账户不存在、已停用或超出当前数据范围', 403);
    const assets = await this.prisma.promotionCreativeMaterialSnapshot.findMany({
      where: { id: { in: [...new Set(dto.assetSnapshotIds)] }, originAccount: scope, isDeleted: false },
      include: { originAccount: { select: { id: true, name: true, accountNo: true, project: true } } },
    });
    if (assets.length !== new Set(dto.assetSnapshotIds).size) throw new BusinessException(403882, '部分素材不存在或超出当前数据范围', 403);
    const videos = assets.filter((item) => item.assetType === 'VIDEO');
    const titles = assets.filter((item) => item.assetType === 'TITLE' || ['title', 'description'].includes(String(item.componentField || '')));
    const images = assets.filter((item) => item.assetType === 'IMAGE');
    if ((!videos.length && !images.length) || !titles.length) throw new BusinessException(400887, '图片或视频至少选择一项，标题/文案至少选择一项', 400);
    if (dto.rules.videoCount === 0 && dto.rules.imageCount === 0) throw new BusinessException(400887, '每条创意的图片和视频数量不能同时为 0', 400);
    let combinations: ReturnType<typeof generateMultiCreativeCombinations>;
    try {
      combinations = generateMultiCreativeCombinations(dto.combinationMode, {
        titles: titles.map((item) => item.id), videos: videos.map((item) => item.id), images: images.map((item) => item.id),
      }, dto.rules);
    } catch (error) {
      if (error instanceof MultiCreativeCombinationValidationError) throw new BusinessException(400897, error.message, 400);
      throw error;
    }
    const assetMap = new Map(assets.map((item) => [item.id, item]));
    const accountMap = new Map(accounts.map((item) => [item.id, item]));
    // One preflight may contain many adgroups under the same account. Tencent
    // visibility is account scoped, so verify each asset only once per request.
    const authorizationCache = new Map<string, Promise<Awaited<ReturnType<typeof this.sync.tencentAccountCredentialStatus>>>>();
    const assetMappingCache = new Map<string, Promise<PreparedAsset>>();
    const componentLookupCache = new Map<string, ReturnType<typeof this.lookupDefaultComponent>>();
    const coverCheckCache = new Map<string, Promise<string | null>>();
    const activeDefaultCache = new Map<string, Promise<Array<{ componentType: string }>>>();
    const authorizationFor = (accountId: string) => {
      let pending = authorizationCache.get(accountId);
      if (!pending) {
        pending = this.sync.tencentAccountCredentialStatus(accountId, user.adminUserId);
        authorizationCache.set(accountId, pending);
      }
      return pending;
    };
    const mappingFor = (asset: typeof assets[number], account: typeof accounts[number]) => {
      const key = `${account.id}:${asset.id}`;
      let pending = assetMappingCache.get(key);
      if (!pending) {
        pending = this.mapAssetToTarget(asset, account);
        assetMappingCache.set(key, pending);
      }
      return pending;
    };
    const componentFor = (accountNo: string, config: any) => {
      const key = `${accountNo}:${config.platformComponentId}`;
      let pending = componentLookupCache.get(key);
      if (!pending) {
        pending = this.lookupDefaultComponent(accountNo, config);
        componentLookupCache.set(key, pending);
      }
      return pending;
    };
    const targets: PreparedTarget[] = [];
    for (const selection of dto.targets) {
      const account = accountMap.get(selection.accountId)!;
      const disabledDefaults = new Set((selection.disabledDefaultComponentTypes || []).map((field) => this.canonicalField(field)));
      for (const adgroupId of [...new Set(selection.adgroupIds)]) {
        const reasons: string[] = [];
        let adgroup: PlatformRecord = { adgroup_id: adgroupId };
        let template: PlatformRecord = {};
        let requirements: PlatformRecord[] = [];
        let templateId = selection.templateId || '';
        let templateName = '';
        const mappings: PreparedAsset[] = [];
        const defaults: PreparedTarget['defaults'] = [];
        try {
          const authorization = await authorizationFor(account.id);
          if (!authorization.enabled || !authorization.authorized) throw new BusinessException(400893, '目标账户未配置有效的腾讯广告授权', 400);
          if (!authorization.hasUserToken) throw new BusinessException(400894, '当前登录账号的腾讯 User Token 缺失或已过期，请在推广账户页面扫码获取', 400);
          adgroup = await this.adgroup(account.accountNo!, adgroupId);
          if (!templateId) throw new BusinessException(400888, '必须为每个账户明确选择兼容创意规格', 400);
          const detail = await this.single.templateDetail({ accountId: account.id, adgroupId, templateId, deliveryMode: dto.deliveryMode, dynamicCreativeType: dto.creativeType }, user);
          template = detail.template as PlatformRecord; requirements = detail.requirements as PlatformRecord[];
          templateName = String(template.creative_template_appellation || template.creative_template_style || `创意规格 ${templateId}`);
          for (let offset = 0; offset < assets.length; offset += 3) {
            const checked = await Promise.all(assets.slice(offset, offset + 3).map((asset) => {
              if (asset.originAccountId !== account.id && !this.has(user, 'PROMOTION_CREATIVE_ASSET_CROSS_ACCOUNT_USE')) {
                return { snapshot: asset, fingerprint: this.assetFingerprint(asset), type: asset.assetType, field: asset.componentField || (asset.payloadJson as PlatformRecord).componentField || asset.assetType.toLowerCase(), component: (asset.payloadJson as PlatformRecord).component || {}, mappingStatus: 'NOT_AVAILABLE' as const, reason: '缺少跨账户素材使用权限' };
              }
              return mappingFor(asset, account);
            }));
            mappings.push(...checked);
          }
          const unavailable = mappings.filter((entry) => !['AVAILABLE', 'AUTHORIZED'].includes(entry.mappingStatus));
          if (unavailable.length) reasons.push(...unavailable.map((entry) => `${entry.snapshot.name}：${entry.reason || entry.mappingStatus}`));
          const coverEntries: Array<{ entry: PreparedAsset; field: string }> = [];
          for (const entry of mappings.filter((item) => ['AVAILABLE', 'AUTHORIZED'].includes(item.mappingStatus) && ['VIDEO', 'IMAGE'].includes(item.type))) {
            const field = (this.single as any).componentSubmissionField(this.canonicalField(entry.field), requirements);
            const currentSnapshot = { ...entry.snapshot, payloadJson: { ...(entry.snapshot.payloadJson as PlatformRecord),
              ...(entry.platformWidth && entry.platformHeight ? { width: entry.platformWidth, height: entry.platformHeight } : {}) } };
            if (!(this.single as any).assetMatchesTemplateDimensions(currentSnapshot, field, requirements)) {
              const requirement = requirements.find((item) => this.requirementField(item) === field);
              const sizes = (requirement?.mediaRules || requirement?.itemRules || [])
                .map((rule: PlatformRecord) => Number(rule.ratioWidth) > 0 && Number(rule.ratioHeight) > 0
                  ? `比例 ${rule.ratioWidth}:${rule.ratioHeight}、最低 ${rule.minWidth || 0}×${rule.minHeight || 0}`
                  : Number(rule.width) > 0 && Number(rule.height) > 0 ? `${rule.width}×${rule.height}` : '')
                .filter(Boolean);
              const actual = currentSnapshot.payloadJson as PlatformRecord;
              reasons.push(`${entry.snapshot.name}：素材尺寸 ${actual.width || '未知'}×${actual.height || '未知'} 不符合当前创意规格${sizes.length ? `（要求 ${[...new Set(sizes)].join(' 或 ')}）` : ''}，请更换素材`);
            } else if (entry.type === 'VIDEO') {
              coverEntries.push({ entry, field });
            }
          }
          for (let offset = 0; offset < coverEntries.length; offset += 3) {
            const issues = await Promise.all(coverEntries.slice(offset, offset + 3).map(({ entry, field }) => {
              const key = `${account.id}:${entry.snapshot.id}:${templateId}`;
              let checked = coverCheckCache.get(key);
              if (!checked) {
                checked = this.single.videoDefaultCoverIssue(entry.snapshot, account.accountNo!, field, requirements, user.adminUserId, entry.platformCoverId);
                coverCheckCache.set(key, checked);
              }
              return checked;
            }));
            reasons.push(...issues.filter((issue): issue is string => Boolean(issue)));
          }
          const selectedFields = new Set(mappings.map((entry) => this.canonicalField(entry.field)));
          for (const requirement of requirements.filter((entry) => entry.required)) {
            const field = this.requirementField(requirement);
            if (this.requirementSatisfiedBySelection(field, selectedFields)) continue;
            if (['video', 'video_list', 'short_video', 'app_promotion_video', 'video_showcase', 'image', 'image_list', 'image_showcase'].includes(field)) {
              reasons.push(`创意规格必填“${requirement.description || field}”，请选择对应的图片或视频素材，或更换兼容规格`);
              continue;
            }
            if (disabledDefaults.has(field)) { reasons.push(`创意规格必填组件“${requirement.description || field}”已关闭，请开启后重试`); continue; }
            const overrideId = selection.componentOverrides?.find((entry) => this.canonicalField(entry.componentType) === field)?.configId;
            const configured = overrideId
              ? await this.prisma.creativeAccountDefaultComponent.findFirst({ where: { id: overrideId, accountId: account.id, componentType: field, status: 'ACTIVE' } })
              : await this.resolveDefault(account, field, dto.creativeType, adgroup.marketing_goal, templateId);
            const resolved = configured ? await this.hydrateDefaultComponentName(account.id, String(account.accountNo), configured) : null;
            if (!resolved) { reasons.push(`缺少账户默认组件：${field}`); continue; }
            const verified = await componentFor(account.accountNo!, resolved);
            if (!verified.row) { reasons.push(`默认组件“${resolved.componentName}”在腾讯后台不可用`); continue; }
            if (field === 'label') {
              const texts = (this.single as any).labelTexts(verified.row.component_value?.label) as string[];
              if (!texts.length) { reasons.push('腾讯标签组件未返回具体文案，请刷新该账户素材并重新配置默认标签'); continue; }
              resolved.componentName = texts.join(' · ');
            }
            defaults.push({ config: resolved, field, component: this.componentFromRow(verified.row, field, resolved.componentSnapshot as PlatformRecord) });
          }
          const channelVideoPlacement = Array.isArray(template.site_set)
            && template.site_set.includes('SITE_SET_CHANNELS')
            && requirements.some((entry) => ['video', 'video_list', 'short_video', 'app_promotion_video', 'video_showcase'].includes(this.requirementField(entry)));
          const channelImageFloatingZone = (this.single as any).templateRequiresChannelImageFloatingZone(template);
          // An enabled account default is an explicit choice, not merely a fallback
          // for required fields. Only submit fields advertised by this Tencent
          // template; never inject unrelated account components into the payload.
          const allowedFields = new Set(requirements.map((entry) => this.requirementField(entry)));
          let activeDefaultTypes = activeDefaultCache.get(account.id);
          if (!activeDefaultTypes) {
            activeDefaultTypes = this.prisma.creativeAccountDefaultComponent.findMany({
              where: { accountId: account.id, status: 'ACTIVE' }, select: { componentType: true },
            });
            activeDefaultCache.set(account.id, activeDefaultTypes);
          }
          const activeDefaultRows = await activeDefaultTypes;
          const optionalFields = [...new Set(activeDefaultRows.map((entry) => this.canonicalField(entry.componentType)))];
          for (const field of optionalFields) {
            if (!allowedFields.has(field) || selectedFields.has(field) || disabledDefaults.has(field) || defaults.some((entry) => entry.field === field)) continue;
            if (channelVideoPlacement && ['text_link', 'mini_card_link', 'floating_zone', 'wechat_channels'].includes(field)) continue;
            const overrideId = selection.componentOverrides?.find((entry) => this.canonicalField(entry.componentType) === field)?.configId;
            const configured = overrideId
              ? await this.prisma.creativeAccountDefaultComponent.findFirst({ where: { id: overrideId, accountId: account.id, componentType: field, status: 'ACTIVE' } })
              : await this.resolveDefault(account, field, dto.creativeType, adgroup.marketing_goal, templateId);
            if (!configured) continue;
            const resolved = await this.hydrateDefaultComponentName(account.id, String(account.accountNo), configured);
            const verified = await componentFor(account.accountNo!, resolved);
            if (!verified.row) { reasons.push(`已开启的默认组件“${resolved.componentName}”在腾讯后台不可用`); continue; }
            if (field === 'label') {
              const texts = (this.single as any).labelTexts(verified.row.component_value?.label) as string[];
              if (!texts.length) { reasons.push('腾讯标签组件未返回具体文案，请刷新该账户素材并重新配置默认标签'); continue; }
              resolved.componentName = texts.join(' · ');
            }
            defaults.push({ config: resolved, field, component: this.componentFromRow(verified.row, field, resolved.componentSnapshot as PlatformRecord) });
          }
          // 视频号版位还有规格字段之外的联动要求。原单账户流程会带入这些
          // 可选组件；多账户流程也必须从目标账户默认配置中解析，不能等到
          // validatePlacementDependencies 才报“未选择”。
          if (channelVideoPlacement || channelImageFloatingZone) {
            const existingFields = new Set(defaults.map((entry) => entry.field));
            if (channelVideoPlacement && !existingFields.has('text_link') && !existingFields.has('mini_card_link')) {
              let linked = false;
              for (const field of ['text_link', 'mini_card_link']) {
                if (disabledDefaults.has(field)) continue;
                const overrideId = selection.componentOverrides?.find((entry) => this.canonicalField(entry.componentType) === field)?.configId;
                const configured = overrideId
                  ? await this.prisma.creativeAccountDefaultComponent.findFirst({ where: { id: overrideId, accountId: account.id, componentType: field, status: 'ACTIVE' } })
                  : await this.resolveDefault(account, field, dto.creativeType, adgroup.marketing_goal, templateId);
                const resolved = configured ? await this.hydrateDefaultComponentName(account.id, String(account.accountNo), configured) : null;
                if (!resolved) continue;
                const verified = await componentFor(account.accountNo!, resolved);
                if (!verified.row) continue;
                defaults.push({ config: resolved, field, component: this.componentFromRow(verified.row, field, resolved.componentSnapshot as PlatformRecord) });
                existingFields.add(field);
                linked = true;
                break;
              }
              if (!linked) reasons.push('视频号版位需要启用可用的账户默认文字链或图文链接组件');
            }
            for (const field of ['floating_zone']) {
              if (existingFields.has(field)) continue;
              if (disabledDefaults.has(field)) { reasons.push('视频号版位必填的默认浮层卡片已关闭，请开启后重试'); continue; }
              const overrideId = selection.componentOverrides?.find((entry) => this.canonicalField(entry.componentType) === field)?.configId;
              const configured = overrideId
                ? await this.prisma.creativeAccountDefaultComponent.findFirst({ where: { id: overrideId, accountId: account.id, componentType: field, status: 'ACTIVE' } })
                : await this.resolveDefault(account, field, dto.creativeType, adgroup.marketing_goal, templateId);
              const resolved = configured ? await this.hydrateDefaultComponentName(account.id, String(account.accountNo), configured) : null;
              if (!resolved) { reasons.push('视频号版位缺少账户默认浮层卡片组件'); continue; }
              const verified = await componentFor(account.accountNo!, resolved);
              if (!verified.row) { reasons.push(`默认组件“${resolved.componentName}”在腾讯后台不可用`); continue; }
              defaults.push({ config: resolved, field, component: this.componentFromRow(verified.row, field, resolved.componentSnapshot as PlatformRecord) });
              existingFields.add(field);
            }
            if (channelVideoPlacement || channelImageFloatingZone) {
            const brand = defaults.find((entry) => entry.field === 'brand')?.component;
            const username = String(brand?.value?.jump_info?.page_spec?.wechat_channels_profile_spec?.username || '').trim();
            if (!username) reasons.push('视频号版位的新版品牌形象缺少已授权视频号标识，无法补齐腾讯要求的视频号兼容组件');
            else if (disabledDefaults.has('wechat_channels')) reasons.push('视频号版位必填的视频号兼容组件已关闭，请开启后重试');
            else if (!existingFields.has('wechat_channels')) {
              const candidates = await this.prisma.promotionCreativeMaterialSnapshot.findMany({
                where: { originAccountId: account.id, componentField: 'wechat_channels', platformAssetKind: 'COMPONENT', isDeleted: false },
                orderBy: { lastSyncedAt: 'desc' }, take: 100,
              });
              const compatible = candidates.find((candidate) => String((candidate.payloadJson as PlatformRecord)?.component?.value?.username || '').trim() === username);
              if (!compatible) reasons.push('目标账户未同步与新版品牌形象匹配的视频号兼容组件，请刷新账户素材');
              else {
                const verified = await this.lookupAsset(account.accountNo!, compatible);
                if (!verified.row) reasons.push('目标账户的视频号兼容组件在腾讯后台不可用');
                else defaults.push({
                  config: { componentType: 'wechat_channels', componentName: compatible.name, platformComponentId: compatible.platformAssetId },
                  field: 'wechat_channels', component: this.componentFromAssetRow(verified.row, compatible), sourceSnapshotId: compatible.id,
                });
              }
            }
            }
          }
          const itemPayloads = combinations.slice(0, dto.rules.maxPerAdgroup).map((combination, index) => {
            const chosen = [...combination.titleIds, ...combination.videoIds, ...combination.imageIds];
            const components: Record<string, PlatformRecord[]> = {};
            for (const id of chosen) {
              const mapped = mappings.find((entry) => entry.snapshot.id === id)!;
              const field = (this.single as any).componentSubmissionField(this.canonicalField(mapped.field), requirements);
              const value = (this.single as any).componentSubmissionValue(field, mapped.component);
              (components[field] ||= []).push((this.single as any).normalizeTencentAssetIds(value));
            }
            for (const entry of defaults) (components[entry.field] ||= []).push((this.single as any).normalizeTencentAssetIds(entry.component));
            (this.single as any).aggregateImageListComponents(components, requirements);
            (this.single as any).validateTemplateComponents(requirements, components, dto.creativeType, templateName);
            (this.single as any).validatePlacementDependencies(template, components);
            const chosenAssets = chosen.map((id) => assetMap.get(id)!);
            const name = this.creativeNameForTarget(dto.namePattern, String(adgroup.adgroup_name || adgroupId), index + 1, chosenAssets, account.name, templateName);
            const payload = {
              account_id: this.safeInteger(account.accountNo!, '账户 ID'), adgroup_id: this.safeInteger(adgroupId, '营销单元 ID'),
              dynamic_creative_name: name, creative_template_id: this.safeInteger(templateId, '创意规格 ID'),
              delivery_mode: dto.deliveryMode, dynamic_creative_type: dto.creativeType, creative_components: components,
              configured_status: dto.configuredStatus || 'AD_STATUS_NORMAL',
            };
            const itemFingerprint = this.hash({ account: account.accountNo, adgroupId, templateId, payload });
            return {
              name, fingerprint: itemFingerprint, idempotencyKey: itemFingerprint,
              payload, material: { selected: chosen.map((id) => ({ snapshotId: id, name: assetMap.get(id)?.name, platformAssetId: mappings.find((entry) => entry.snapshot.id === id)?.targetPlatformAssetId })), defaults: defaults.map((entry) => ({ type: entry.field, id: entry.config.platformComponentId, name: entry.config.componentName, ...(entry.sourceSnapshotId ? { sourceSnapshotId: entry.sourceSnapshotId } : {}) })) },
            };
          });
          targets.push({ account, adgroup, templateId, templateName, template, requirements, mappings, defaults, combinations, items: reasons.length ? [] : itemPayloads, status: reasons.length ? 'FAILED' : 'PASSED', reasons });
        } catch (error) {
          reasons.push(error instanceof Error ? error.message : '预检失败');
          targets.push({ account, adgroup, templateId, templateName, template, requirements, mappings, defaults, combinations, items: [], status: 'FAILED', reasons });
        }
      }
    }
    const countsByAccount = new Map<string, number>();
    for (const target of targets.filter((item) => item.status === 'PASSED')) countsByAccount.set(target.account.id, (countsByAccount.get(target.account.id) || 0) + target.items.length);
    for (const target of targets) if ((countsByAccount.get(target.account.id) || 0) > dto.rules.maxPerAccount) {
      target.status = 'FAILED'; target.items = []; target.reasons.push(`账户预计创意数超过账户上限 ${dto.rules.maxPerAccount}`);
    }
    const total = targets.reduce((sum, target) => sum + target.items.length, 0);
    if (total > dto.rules.maxTotal) throw new BusinessException(400889, `预计生成 ${total} 条，超过单次任务上限 ${dto.rules.maxTotal}`, 400);
    return { dto, assets, targets, total };
  }

  private async mapAssetToTarget(snapshot: any, account: any): Promise<PreparedAsset> {
    const payload = snapshot.payloadJson as PlatformRecord;
    const base = { snapshot, fingerprint: this.assetFingerprint(snapshot), type: snapshot.assetType, field: snapshot.componentField || payload.componentField || snapshot.assetType.toLowerCase(), component: payload.component || {} };
    if (snapshot.isDeleted || payload.kind === 'REFERENCE' || /reject|invalid|delete|offline|disabled|fail/i.test(`${snapshot.status || ''} ${snapshot.auditStatus || ''}`)) return { ...base, mappingStatus: 'INVALID', reason: '素材已失效、删除、审核未通过或缺少提交结构' };
    try {
      const direct = await this.lookupAsset(account.accountNo!, snapshot);
      if (direct.row) return { ...base, component: this.componentFromAssetRow(direct.row, snapshot), mappingStatus: 'AVAILABLE', targetPlatformAssetId: snapshot.platformAssetId, validationSource: 'TARGET_ACCOUNT_API', platformStatus: String(direct.row.system_status || direct.row.status || direct.row.first_publication_status || 'AVAILABLE'), platformWidth: Number(direct.row.width) || undefined, platformHeight: Number(direct.row.height) || undefined, platformCoverId: direct.row.cover_id ? String(direct.row.cover_id) : undefined };
      const organizationId = String(payload.platformOrganizationId || '');
      const scopes = Array.isArray(payload.platformAssetScopes) ? payload.platformAssetScopes.map(String) : [];
      if (organizationId && scopes.includes('BUSINESS_UNIT')) {
        const membership = await this.sync.tencentApi('POST', '/business_unit_account/get', account.accountNo!, { account_id_list: [this.safeInteger(account.accountNo!, '账户 ID')] }, false);
        const sameOrganization = this.rows(membership.data).some((row) => String(row.account_id) === String(account.accountNo) && String(row.organization_id) === organizationId);
        if (sameOrganization) {
          const shared = await this.lookupAsset(account.accountNo!, snapshot, organizationId);
          if (shared.row) return { ...base, component: this.componentFromAssetRow(shared.row, snapshot), mappingStatus: 'AUTHORIZED', targetPlatformAssetId: snapshot.platformAssetId, validationSource: 'TENCENT_BUSINESS_UNIT_API', platformStatus: String(shared.row.system_status || shared.row.status || shared.row.first_publication_status || 'AVAILABLE'), platformWidth: Number(shared.row.width) || undefined, platformHeight: Number(shared.row.height) || undefined, platformCoverId: shared.row.cover_id ? String(shared.row.cover_id) : undefined };
        }
      }
      return { ...base, mappingStatus: scopes.includes('BUSINESS_UNIT') ? 'NEED_DISTRIBUTION' : 'NOT_AVAILABLE', reason: scopes.includes('BUSINESS_UNIT') ? '腾讯业务单元可见性未能确认到目标账户，且项目没有已接入的素材分发接口' : '腾讯目标账户查询不到该素材' };
    } catch (error) {
      return { ...base, mappingStatus: 'UNKNOWN', reason: error instanceof Error ? error.message : '腾讯素材可见性校验失败' };
    }
  }

  private async lookupAsset(accountNo: string, snapshot: any, organizationId?: string): Promise<{ row: PlatformRecord | null; requestId?: string }> {
    const kind = snapshot.platformAssetKind;
    if (kind === 'REFERENCE' && snapshot.assetType === 'LANDING_PAGE') {
      if (organizationId) return { row: null, requestId: undefined };
      const response = await this.sync.tencentApi('GET', '/official_landing_page_detail/get', accountNo, {
        page_id: this.safeInteger(String(snapshot.platformAssetId), '落地页 ID'),
      });
      const detail = response.data as PlatformRecord;
      const invalid = /OFFLINE|REJECT|DELETE|INVALID/i.test(String(detail?.page_status || ''));
      const payload = snapshot.payloadJson as PlatformRecord;
      const field = this.canonicalField(snapshot.componentField || payload.componentField || 'main_jump_info');
      const row: PlatformRecord | null = String(detail?.page_id || '') === String(snapshot.platformAssetId) && !invalid
        ? { component_value: { [field]: payload.component }, page_status: detail.page_status }
        : null;
      return { row, requestId: response.requestId };
    }
    // 腾讯 /videos/get 的 filtering 使用 media_id，但返回记录仍是 video_id。
    // 图片和组件的过滤/返回字段均保持各自 ID；不能把三类接口混用。
    const field = kind === 'VIDEO' ? 'media_id' : kind === 'IMAGE' ? 'image_id' : 'component_id';
    const resultField = kind === 'VIDEO' ? 'video_id' : field;
    const path = kind === 'VIDEO' ? '/videos/get' : kind === 'IMAGE' ? '/images/get' : '/components/get';
    const fields = kind === 'COMPONENT' ? { fields: COMPONENT_FIELDS } : {};
    const response = await this.sync.tencentApi('GET', path, accountNo, {
      ...fields, ...(organizationId ? { organization_id: this.safeInteger(organizationId, '业务单元 ID') } : {}),
      filtering: JSON.stringify([{ field, operator: 'EQUALS', values: [snapshot.platformAssetId] }]), page: 1, page_size: 10,
    }, !organizationId);
    const row = this.rows(response.data).find((entry) => String(entry[resultField] || '') === String(snapshot.platformAssetId)) || null;
    return { row, requestId: response.requestId };
  }

  private async lookupDefaultComponent(accountNo: string, config: any) {
    const snapshot = config.accountId ? await this.prisma.promotionCreativeMaterialSnapshot.findFirst({
      where: { originAccountId: config.accountId, platformAssetId: config.platformComponentId, isDeleted: false },
    }) : null;
    if (snapshot?.platformAssetKind === 'REFERENCE') return this.lookupAsset(accountNo, snapshot);
    const response = await this.sync.tencentApi('GET', '/components/get', accountNo, {
      fields: COMPONENT_FIELDS, filtering: JSON.stringify([{ field: 'component_id', operator: 'EQUALS', values: [config.platformComponentId] }]), page: 1, page_size: 10,
    });
    return { row: this.rows(response.data).find((entry) => String(entry.component_id || '') === String(config.platformComponentId)), requestId: response.requestId };
  }

  private async resolveDefault(account: any, field: string, creativeType: string, marketingGoal: unknown, templateId: string) {
    const candidates = await this.prisma.creativeAccountDefaultComponent.findMany({ where: { accountId: account.id, componentType: field, status: 'ACTIVE' }, orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }] });
    const score = (item: any) => {
      if ((item.templateId && item.templateId !== templateId) || (item.creativeType && item.creativeType !== creativeType) || (item.marketingGoal && item.marketingGoal !== marketingGoal)) return -1;
      return (item.templateId ? 400 : 0) + (item.creativeType ? 300 : 0) + (item.marketingGoal ? 200 : 0) + 100;
    };
    return candidates.map((item) => ({ item, score: score(item) })).filter((entry) => entry.score >= 0).sort((a, b) => b.score - a.score || b.item.priority - a.item.priority)[0]?.item || null;
  }

  private creativeNameForTarget(pattern: string, adgroupName: string, sequence: number, assets: any[], accountName: string, templateName = '') {
    return (this.single as any).creativeName(pattern.replaceAll('{营销单元}', adgroupName), sequence, assets, accountName, templateName);
  }

  private async hydrateDefaultComponentName(accountId: string, accountNo: string, config: any) {
    const snapshot = await this.prisma.promotionCreativeMaterialSnapshot.findFirst({
      where: { originAccountId: accountId, platformAssetId: config.platformComponentId, isDeleted: false },
      select: { name: true, payloadJson: true },
    });
    let displayName = snapshot?.name;
    if (this.canonicalField(config.componentType || '') === 'label' && snapshot?.payloadJson) {
      const texts = (this.single as any).labelTexts((snapshot.payloadJson as PlatformRecord).component) as string[];
      if (texts.length) return { ...config, componentName: texts.join(' · ') };
      // An old cached name may contain the former false nine-image label.
      displayName = snapshot.name;
    }
    if (this.canonicalField(config.componentType || '') === 'main_jump_info' && snapshot?.payloadJson) {
      const payload = snapshot.payloadJson as PlatformRecord;
      const pageId = (this.single as any).officialLandingPageId(payload.component);
      if (pageId) {
        const landingPage = await this.prisma.promotionCreativeMaterialSnapshot.findFirst({
          where: { originAccountId: accountId, assetType: 'LANDING_PAGE', platformAssetKind: 'REFERENCE', platformAssetId: String(pageId), isDeleted: false },
          select: { name: true },
        });
        displayName = landingPage?.name || await (this.single as any).landingPageNameFromTencent(accountNo, String(pageId)) || displayName;
      }
    }
    return { ...config, componentName: this.canonicalField(config.componentType || '') === 'label'
      ? (displayName || '腾讯标签文案未同步') : this.defaultComponentDisplayName(config, displayName) };
  }

  private defaultComponentDisplayName(config: { componentType?: string; componentName?: string; platformComponentId?: string }, snapshotName?: string | null) {
    const type = this.canonicalField(config.componentType || '');
    if (type === 'main_jump_info' && snapshotName?.trim()) return snapshotName.trim();
    return config.componentName?.trim() || snapshotName?.trim() || `腾讯组件 ${this.maskId(config.platformComponentId)}`;
  }

  private async adgroup(accountNo: string, adgroupId: string) {
    const response = await this.sync.tencentApi('GET', '/adgroups/get', accountNo, { fields: ADGROUP_FIELDS, filtering: JSON.stringify([{ field: 'adgroup_id', operator: 'EQUALS', values: [adgroupId] }]), page: 1, page_size: 10, is_deleted: false });
    const row = this.rows(response.data).find((entry) => String(entry.adgroup_id || '') === adgroupId);
    if (!row) throw new BusinessException(404883, '营销单元不存在、已删除或不属于目标账户', 404);
    if (row.is_deleted || row.configured_status !== 'AD_STATUS_NORMAL' || /DELETED|FROZEN|STOP|VIOLATION|CLOSED|REMOVED|INVALID/i.test(String(row.system_status || ''))) throw new BusinessException(400890, `营销单元当前不可创建创意（${row.system_status || row.configured_status || '未知状态'}）`, 400);
    return row;
  }

  private async runWorker() {
    if (this.workerBusy) return;
    this.workerBusy = true;
    try {
      const item = await this.prisma.multiAccountCreativeBatchItem.findFirst({
        where: { OR: [{ status: 'PENDING' }, { status: { in: ['PLATFORM_ACCEPTED', 'VERIFYING'] }, verificationAttempts: { lt: 5 }, updatedAt: { lte: new Date(Date.now() - 10_000) } }] },
        include: { target: { include: { account: true, batch: true } } }, orderBy: { createdAt: 'asc' },
      });
      if (!item) return;
      if (item.target.batch.status === 'CANCELLED' && item.status === 'PENDING') return;
      if (item.platformCreativeId) await this.verifyItem(item);
      else await this.submitItem(item);
      await this.refreshCounts(item.target.batchId);
    } catch (error) { this.logger.error(`多账户创意工作器异常: ${error instanceof Error ? error.message : 'unknown'}`); }
    finally { this.workerBusy = false; }
  }

  private async submitItem(item: any) {
    const locked = await this.prisma.multiAccountCreativeBatchItem.updateMany({ where: { id: item.id, status: 'PENDING' }, data: { status: 'SUBMITTING', lastRequestedAt: new Date(), errorCode: null, errorMessage: null } });
    if (!locked.count) return;
    const { target } = item; const { account, batch } = target;
    try {
      const creator = await this.currentUser(batch.createdByAdminId);
      this.assertPermission(creator, 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CREATE');
      this.assertPermission(creator, 'PROMOTION_CREATIVE_TEMPLATE_VIEW');
      this.assertPermission(creator, 'PROMOTION_CREATIVE_ASSET_VIEW');
      await this.account(account.id, creator);
      await this.promotionAccess?.assertCanCreateCreatives(creator, account);
      await this.adgroup(account.accountNo!, target.adgroupId);
      await this.revalidateItemAssets(item, account);
      const duplicate = await this.prisma.multiAccountCreativeBatchItem.findFirst({ where: { idempotencyKey: item.idempotencyKey, status: 'CONFIRMED', id: { not: item.id } } });
      if (duplicate) throw new BusinessException(400891, `相同腾讯请求已由创意 ${duplicate.platformCreativeId || duplicate.id} 确认成功，已阻止重复创建`, 400);
      await this.log(batch.id, item.id, 'SUBMIT_TENCENT_CREATIVE', 'SUBMITTING', item.requestPayload);
      let response;
      try { response = await this.sync.tencentApi('POST', '/dynamic_creatives/add', account.accountNo!, item.requestPayload as PlatformRecord, true, batch.createdByAdminId); }
      catch (error) {
        if (error instanceof TencentMarketingApiError && error.retryable) {
          await this.prisma.multiAccountCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'UNKNOWN_NEEDS_REVIEW', errorCode: error.code, errorMessage: error.message, platformRequestId: error.requestId } });
          await this.log(batch.id, item.id, 'TENCENT_RESPONSE_UNKNOWN', 'UNKNOWN_NEEDS_REVIEW', undefined, undefined, error);
          return;
        }
        throw error;
      }
      const creativeId = String((response.data as any)?.dynamic_creative_id || '');
      if (!creativeId) {
        await this.prisma.multiAccountCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'UNKNOWN_NEEDS_REVIEW', errorCode: 'MISSING_CREATIVE_ID', errorMessage: '腾讯已响应但未返回创意 ID；必须先人工回查，禁止盲目重建', platformRequestId: response.requestId } });
        return;
      }
      await this.prisma.multiAccountCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'PLATFORM_ACCEPTED', platformCreativeId: creativeId, platformRequestId: response.requestId, platformResponse: { accepted: true, creativeId: this.maskId(creativeId) } } });
      await this.log(batch.id, item.id, 'TENCENT_CREATIVE_ACCEPTED', 'PLATFORM_ACCEPTED', undefined, { creativeId: this.maskId(creativeId) }, undefined, response.requestId);
      await this.verifyItem({ ...item, platformCreativeId: creativeId, status: 'PLATFORM_ACCEPTED' });
    } catch (error) {
      const code = error instanceof TencentMarketingApiError ? error.code : 'CREATE_FAILED';
      await this.prisma.multiAccountCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'FAILED', errorCode: code, errorMessage: (error instanceof Error ? error.message : '创建失败').slice(0, 1000) } });
      await this.log(batch.id, item.id, 'TENCENT_CREATIVE_REJECTED', 'FAILED', undefined, undefined, error);
    }
  }

  private async verifyItem(item: any) {
    const full = await this.prisma.multiAccountCreativeBatchItem.findUnique({ where: { id: item.id }, include: { target: { include: { account: true, batch: true } } } });
    if (!full?.platformCreativeId) return;
    await this.prisma.multiAccountCreativeBatchItem.update({ where: { id: full.id }, data: { status: 'VERIFYING', verificationAttempts: { increment: 1 }, lastVerifiedAt: new Date() } });
    try {
      const response = await this.sync.tencentApi('GET', '/dynamic_creatives/get', full.target.account.accountNo!, {
        fields: JSON.stringify(['dynamic_creative_id', 'dynamic_creative_name', 'adgroup_id', 'creative_template_id', 'delivery_mode', 'dynamic_creative_type', 'creative_components', 'configured_status', 'created_time']),
        filtering: JSON.stringify([{ field: 'dynamic_creative_id', operator: 'EQUALS', values: [full.platformCreativeId] }]), page: 1, page_size: 10,
      }, true, full.target.batch.createdByAdminId);
      const row = this.rows(response.data).find((entry) => String(entry.dynamic_creative_id || '') === full.platformCreativeId);
      if (!row) {
        const attempts = full.verificationAttempts + 1;
        await this.prisma.multiAccountCreativeBatchItem.update({ where: { id: full.id }, data: attempts >= 5
          ? { status: 'UNKNOWN_NEEDS_REVIEW', errorCode: 'VERIFY_NOT_FOUND', errorMessage: '腾讯返回创意 ID，但连续回查仍未找到；禁止自动重建' }
          : { status: 'PLATFORM_ACCEPTED', errorCode: 'VERIFY_PENDING', errorMessage: '腾讯数据尚未可查询，将延迟再次核验' } });
        return;
      }
      const payload = full.requestPayload as PlatformRecord;
      const matches = matchesTencentCreativeRecord({
        creativeId: full.platformCreativeId,
        creativeName: full.creativeName,
        adgroupId: full.target.adgroupId,
        templateId: String(full.target.templateId || ''),
        deliveryMode: String(full.target.batch.deliveryMode),
        creativeType: String(full.target.creativeType),
        components: payload.creative_components || {},
      }, row, (expected, actual) => (this.single as any).platformComponentsMatch(
        normalizeTencentCreativeComponentsForVerification(expected),
        normalizeTencentCreativeComponentsForVerification(actual),
      ));
      if (!matches) {
        await this.prisma.multiAccountCreativeBatchItem.update({ where: { id: full.id }, data: { status: 'UNKNOWN_NEEDS_REVIEW', errorCode: 'VERIFY_MISMATCH', errorMessage: '腾讯回查结果与目标账户上下文、营销单元、规格、类型或关键组件不一致', verificationResult: this.redact(row) as Prisma.InputJsonValue } });
        return;
      }
      await this.prisma.multiAccountCreativeBatchItem.update({ where: { id: full.id }, data: { status: 'CONFIRMED', errorCode: null, errorMessage: null, lastVerifiedAt: new Date(), verificationResult: this.redact(row) as Prisma.InputJsonValue } });
      await this.log(full.target.batchId, full.id, 'VERIFY_TENCENT_CREATIVE', 'CONFIRMED', undefined, { creativeId: this.maskId(full.platformCreativeId), adgroupId: this.maskId(full.target.adgroupId) }, undefined, response.requestId);
    } catch (error) {
      const attempts = full.verificationAttempts + 1;
      const retryable = error instanceof TencentMarketingApiError && error.retryable;
      const status = retryable && attempts < 5 ? 'PLATFORM_ACCEPTED' : 'UNKNOWN_NEEDS_REVIEW';
      await this.prisma.multiAccountCreativeBatchItem.update({ where: { id: full.id }, data: { status, errorCode: error instanceof TencentMarketingApiError ? error.code : 'VERIFY_FAILED', errorMessage: (error instanceof Error ? error.message : '腾讯回查失败').slice(0, 1000) } });
      await this.log(full.target.batchId, full.id, 'VERIFY_TENCENT_CREATIVE', status, undefined, undefined, error);
    }
  }

  private async refreshCounts(batchId: string) {
    const batch = await this.prisma.multiAccountCreativeBatch.findUnique({ where: { id: batchId } });
    if (!batch) return;
    const grouped = await this.prisma.multiAccountCreativeBatchItem.groupBy({ by: ['status'], where: { target: { batchId } }, _count: { _all: true } });
    const count = (...statuses: string[]) => grouped.filter((entry) => statuses.includes(entry.status)).reduce((sum, entry) => sum + entry._count._all, 0);
    const confirmedCount = count('CONFIRMED'); const failedCount = count('FAILED'); const skippedCount = count('SKIPPED', 'CANCELLED');
    const pendingVerifyCount = count('PLATFORM_ACCEPTED', 'VERIFYING', 'UNKNOWN_NEEDS_REVIEW');
    const running = count('PENDING', 'SUBMITTING', 'PLATFORM_ACCEPTED', 'VERIFYING');
    const status = batch.status === 'CANCELLED' ? 'CANCELLED' : running ? 'RUNNING' : confirmedCount === batch.totalCreativeCount ? 'SUCCEEDED' : confirmedCount ? (pendingVerifyCount ? 'COMPLETED_WITH_EXCEPTIONS' : 'PARTIAL_SUCCESS') : pendingVerifyCount ? 'COMPLETED_WITH_EXCEPTIONS' : 'FAILED';
    await this.prisma.multiAccountCreativeBatch.update({ where: { id: batchId }, data: { status, confirmedCount, failedCount, skippedCount: Math.max(batch.skippedCount, skippedCount), pendingVerifyCount, ...(running ? { startedAt: batch.startedAt || new Date() } : { completedAt: new Date() }) } });
  }

  private async revalidateItemAssets(item: any, account: any) {
    const material = item.materialCombination as PlatformRecord;
    const selected = Array.isArray(material?.selected) ? material.selected : [];
    const snapshotIds = selected.map((entry: PlatformRecord) => String(entry.snapshotId || '')).filter(Boolean);
    const snapshots = snapshotIds.length ? await this.prisma.promotionCreativeMaterialSnapshot.findMany({ where: { id: { in: snapshotIds }, isDeleted: false } }) : [];
    if (snapshots.length !== snapshotIds.length) throw new BusinessException(400893, '执行前发现素材快照缺失或已删除，已阻止提交', 400);
    for (const snapshot of snapshots) {
      const mapped = await this.mapAssetToTarget(snapshot, account);
      if (!['AVAILABLE', 'AUTHORIZED'].includes(mapped.mappingStatus)) throw new BusinessException(400894, `执行前素材“${snapshot.name}”已不可用于目标账户：${mapped.reason || mapped.mappingStatus}`, 400);
    }
    const defaults = Array.isArray(material?.defaults) ? material.defaults : [];
    for (const entry of defaults as PlatformRecord[]) {
      if (entry.sourceSnapshotId) {
        const source = await this.prisma.promotionCreativeMaterialSnapshot.findFirst({ where: { id: String(entry.sourceSnapshotId), originAccountId: account.id, platformAssetId: String(entry.id || ''), isDeleted: false } });
        if (!source || !(await this.lookupAsset(account.accountNo!, source)).row) throw new BusinessException(400895, `执行前视频号兼容组件“${entry.name || entry.type}”已失效，已阻止提交`, 400);
        continue;
      }
      const config = await this.prisma.creativeAccountDefaultComponent.findFirst({ where: { accountId: account.id, componentType: String(entry.type || ''), platformComponentId: String(entry.id || ''), status: 'ACTIVE' } });
      if (!config || !(await this.lookupDefaultComponent(account.accountNo!, config)).row) throw new BusinessException(400895, `执行前默认组件“${entry.name || entry.type}”已失效，已阻止提交`, 400);
    }
  }

  private preflightResponse(prepared: Awaited<ReturnType<MultiAccountCreativeBatchService['prepare']>>) {
    return {
      accountCount: new Set(prepared.targets.map((target) => target.account.id)).size,
      adgroupCount: prepared.targets.length, estimatedCreativeCount: prepared.total,
      passedCount: prepared.targets.filter((target) => target.status === 'PASSED').length,
      failedCount: prepared.targets.filter((target) => target.status === 'FAILED').length,
      targets: prepared.targets.map((target) => ({
        account: { id: target.account.id, name: target.account.name, accountNo: target.account.accountNo },
        adgroup: { id: String(target.adgroup.adgroup_id || ''), name: target.adgroup.adgroup_name || '' },
        template: { id: target.templateId, name: target.templateName }, status: target.status, reasons: target.reasons,
        creativeCount: target.items.length,
        mappings: target.mappings.map((item) => ({ assetId: item.snapshot.id, name: item.snapshot.name, status: item.mappingStatus, targetPlatformAssetId: item.targetPlatformAssetId, reason: item.reason })),
        defaultComponents: target.defaults.map((entry) => ({ type: entry.field, id: entry.config.platformComponentId, name: entry.config.componentName })),
        items: target.items.map((item) => ({ name: item.name, material: item.material })),
      })),
    };
  }

  private preflightAudit(prepared: Awaited<ReturnType<MultiAccountCreativeBatchService['prepare']>>) {
    return { accountCount: new Set(prepared.targets.map((target) => target.account.id)).size, adgroupCount: prepared.targets.length, creativeCount: prepared.total, passed: prepared.targets.filter((target) => target.status === 'PASSED').length, failed: prepared.targets.filter((target) => target.status === 'FAILED').length };
  }

  private requirementSatisfiedBySelection(field: string, selected: Set<string>) {
    if (['video', 'video_list', 'short_video', 'app_promotion_video', 'video_showcase'].includes(field)) return selected.has('video');
    if (['image', 'image_list', 'image_showcase'].includes(field)) return ['image', 'image_list', 'image_showcase'].some((name) => selected.has(name));
    if (['title', 'description'].includes(field)) return selected.has(field) || selected.has('title');
    return selected.has(field);
  }

  private requirementField(requirement: PlatformRecord) { return this.canonicalField(String(requirement.path || requirement.name || '').split('.').pop() || ''); }
  private canonicalField(field: string) { return (this.single as any).canonicalCreativeComponentField(field); }
  private componentFromAssetRow(row: PlatformRecord, snapshot: any) {
    if (snapshot.platformAssetKind === 'VIDEO') return { value: { video_id: String(row.video_id) } };
    if (snapshot.platformAssetKind === 'IMAGE') return { value: { image_id: String(row.image_id), ...(row.preview_url ? { image_url: row.preview_url } : {}) } };
    const payload = snapshot.payloadJson as PlatformRecord;
    const field = this.canonicalField(snapshot.componentField || payload.componentField || '');
    return this.componentFromRow(row, field, payload);
  }
  private componentFromRow(row: PlatformRecord, field: string, fallback: PlatformRecord) {
    const value = row.component_value?.[field] || row.component_value?.[this.canonicalField(field)];
    // Official landing pages are inline values, not Tencent component IDs.
    const component = value ? { ...value, ...(row.component_id != null ? { component_id: row.component_id } : {}) } : fallback.component || fallback;
    return this.normalizeComponentIds(component);
  }
  private normalizeComponentIds(value: unknown): any {
    if (Array.isArray(value)) return value.map((entry) => this.normalizeComponentIds(entry));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value as PlatformRecord).map(([key, entry]) => [
      key,
      key === 'component_id' ? this.safeInteger(String(entry), '组件 ID') : this.normalizeComponentIds(entry),
    ]));
  }
  private assetSource(snapshot: any) { const scopes = (snapshot.payloadJson as PlatformRecord)?.platformAssetScopes; return Array.isArray(scopes) && scopes.includes('BUSINESS_UNIT') ? 'BUSINESS_UNIT' : 'ACCOUNT'; }
  private assetSpecification(snapshot: any) { const payload = snapshot.payloadJson as PlatformRecord; return { width: payload.width || null, height: payload.height || null, fileSize: payload.fileSize || null, status: snapshot.status, auditStatus: snapshot.auditStatus, syncedAt: snapshot.lastSyncedAt }; }
  private assetFingerprint(snapshot: any) { return this.hash({ kind: snapshot.platformAssetKind, id: snapshot.platformAssetId, payload: snapshot.payloadJson }); }
  private rows(data: any): PlatformRecord[] { const rows = data?.list || data?.data || []; return Array.isArray(rows) ? rows : []; }
  private safeInteger(value: string, label: string) { const number = Number(value); if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number <= 0) throw new BusinessException(400892, `${label}格式不正确或超出安全整数范围`, 400); return number; }
  private hash(value: unknown) { return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex'); }
  private maskId(value: unknown) { const text = String(value || ''); return text.length <= 4 ? '****' : `****${text.slice(-4)}`; }
  private ua(value?: string | string[]) { return (Array.isArray(value) ? value.join(' ') : value || '').slice(0, 255) || undefined; }
  private safeBatch<T extends PlatformRecord>(batch: T) {
    const { dedupeKey: _dedupeKey, requestFingerprint: _requestFingerprint, requestSnapshot: _requestSnapshot, submittedIp: _submittedIp, submittedUserAgent: _submittedUserAgent, ...rest } = batch;
    const safe = rest as PlatformRecord;
    if (Array.isArray(safe.logicalAssets)) safe.logicalAssets = safe.logicalAssets.map((asset: PlatformRecord) => {
      const { snapshot: _snapshot, ...safeAsset } = asset;
      return safeAsset;
    });
    if (Array.isArray(safe.targets)) safe.targets = safe.targets.map((target: PlatformRecord) => ({
      ...target,
      items: Array.isArray(target.items) ? target.items.map((item: PlatformRecord) => ({
        ...item,
        requestPayload: this.redact(item.requestPayload),
        platformResponse: this.redact(item.platformResponse),
        verificationResult: this.redact(item.verificationResult),
      })) : target.items,
    }));
    return safe;
  }
  private has(user: AdminCurrentUser, permission: string) { return user.role === 'SUPER_ADMIN' || user.permissions.includes(permission) || user.permissions.includes('PROMOTION_MANAGE'); }
  private assertPermission(user: AdminCurrentUser, permission: string) { if (!this.has(user, permission)) throw new BusinessException(403883, `缺少权限：${permission}`, 403); }
  private assertAnyPermission(user: AdminCurrentUser, permissions: string[]) { if (!permissions.some((permission) => this.has(user, permission))) throw new BusinessException(403883, `缺少任一权限：${permissions.join('、')}`, 403); }
  private async accountScope(user: AdminCurrentUser): Promise<Prisma.PromotionAccountWhereInput> { return this.promotionAccess ? await this.promotionAccess.where(user, 'CREATIVES') as Prisma.PromotionAccountWhereInput : await this.dataScopes.ownershipWhere(user, 'ownerAdminId', 'createdByAdminId') as Prisma.PromotionAccountWhereInput; }
  private async assertFullTaskScope(batchId: string, visibleTargetCount: number) {
    const totalTargetCount = await this.prisma.multiAccountCreativeBatchTarget.count({ where: { batchId } });
    if (visibleTargetCount !== totalTargetCount) throw new BusinessException(403886, '当前账号无权操作此任务中的全部推广账户', 403);
  }
  private async account(id: string, user: AdminCurrentUser) { const row = await this.prisma.promotionAccount.findFirst({ where: { AND: [await this.accountScope(user), { id, status: ContentStatus.ACTIVE, platform: { contains: '腾讯' }, accountNo: { not: null } }] } }); if (!row) throw new BusinessException(403884, '腾讯账户不存在、已停用或超出当前数据范围', 403); return row; }
  private async currentUser(id: string): Promise<AdminCurrentUser> {
    const row = await this.prisma.adminUser.findUnique({ where: { id }, include: { customRole: true } });
    if (!row || row.status !== 'ACTIVE' || row.deletedAt) throw new BusinessException(403885, '任务创建人已停用或删除，任务已停止', 403);
    const rawPermissions = row.customRole?.permissionsJson ?? row.permissionsJson;
    const rawMembers = row.customRole?.dataScopeMemberIds ?? row.dataScopeMemberIds;
    const permissions = (Array.isArray(rawPermissions) ? rawPermissions : []).filter((item: unknown): item is string => typeof item === 'string');
    const members = (Array.isArray(rawMembers) ? rawMembers : []).filter((item: unknown): item is string => typeof item === 'string');
    return {
      adminUserId: row.id,
      username: row.username,
      role: row.role,
      permissions,
      dataScope: row.role === 'SUPER_ADMIN' ? 'ALL' : row.customRole?.dataScope ?? row.dataScope,
      dataScopeMemberIds: members,
      teamId: row.teamId
    };
  }
  private async log(batchId: string, itemId: string | undefined, action: string, status: string, request?: unknown, response?: unknown, error?: unknown, platformRequestId?: string) { await this.prisma.multiAccountCreativeSubmissionLog.create({ data: { batchId, itemId, action, status, requestSummary: request ? this.redact(request) as Prisma.InputJsonValue : undefined, responseSummary: response ? this.redact(response) as Prisma.InputJsonValue : undefined, platformRequestId, errorCode: error instanceof TencentMarketingApiError ? error.code : undefined, errorMessage: error instanceof Error ? error.message.slice(0, 1000) : undefined } }); }
  private redact(value: any): any { if (Array.isArray(value)) return value.map((item) => this.redact(item)); if (!value || typeof value !== 'object') return value; return Object.fromEntries(Object.entries(value).map(([key, item]) => { if (/token|secret|authorization|credential/i.test(key)) return [key, '[REDACTED]']; if (/(account|adgroup|creative|component|asset).*id/i.test(key) && typeof item !== 'object') return [key, this.maskId(item)]; return [key, this.redact(item)]; })); }
}
