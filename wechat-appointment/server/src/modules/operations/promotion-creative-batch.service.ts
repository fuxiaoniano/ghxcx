import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { AdminCurrentUser } from '../../common/decorators/current-user.decorator';
import { DataScopeService } from '../../common/data-scope/data-scope.service';
import { PromotionAccountAccessService, type PromotionAccountCapability } from '../../common/data-scope/promotion-account-access.service';
import { BusinessException } from '../../common/utils/business-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  PromotionCreativeAdgroupQueryDto, PromotionCreativeAssetQueryDto, PromotionCreativeBatchRequestDto,
  PromotionCreativeTaskQueryDto, PromotionCreativeTemplateQueryDto,
} from './dto';
import { generateCreativeCombinations, type CreativeCombination } from './promotion-creative-combinations';
import { PromotionDataSyncService, TencentMarketingApiError } from './promotion-data-sync.service';

const CREATIVE_COMPONENT_FIELDS = new Set([
  'title', 'description', 'image', 'image_list', 'video', 'brand', 'consult', 'phone', 'form', 'action_button',
  'chosen_button', 'label', 'show_data', 'marketing_pendant', 'app_gift_pack_code', 'shop_image', 'count_down',
  'barrage', 'floating_zone', 'text_link', 'end_page', 'living_desc', 'wechat_channels', 'short_video', 'element_story',
  'wxgame_playable_page', 'main_jump_info', 'app_promotion_video', 'video_showcase', 'image_showcase', 'social_skill',
  'mini_card_link', 'floating_zone_list', 'video_channels_content', 'wechat_shop_activity', 'audio', 'wxgame_direct_page', 'jump_info',
  'video_list', 'doctor_card', 'channels_live_feed', 'rewarded_browse', 'channels_brand',
]);

type PlatformRecord = Record<string, any>;
type AssetFamily = 'TITLE' | 'VIDEO' | 'IMAGE' | 'LANDING_PAGE' | 'MARKETING' | 'BRAND' | 'WECHAT_CHANNELS' | 'CONVERSION' | 'OTHER';

const ADGROUP_FIELDS = JSON.stringify([
  'adgroup_id', 'adgroup_name', 'configured_status', 'system_status', 'created_time', 'is_deleted',
  'marketing_goal', 'marketing_sub_goal', 'marketing_carrier_type', 'marketing_target_type',
  'marketing_target_id', 'optimization_goal', 'site_set',
]);

// components/get only guarantees explicitly requested fields. Without
// component_value, title/description/brand/marketing components cannot be
// classified and were silently skipped.
const COMPONENT_FIELDS = JSON.stringify([
  'account_id', 'organization_id', 'component_id', 'component_value', 'created_time',
  'last_modified_time', 'component_sub_type', 'component_custom_name', 'generation_type',
  'is_deleted', 'similarity_status', 'potential_status', 'disable_message',
  'first_publication_status', 'scene',
]);

@Injectable()
export class PromotionCreativeBatchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PromotionCreativeBatchService.name);
  private worker?: NodeJS.Timeout;
  private workerBusy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: PromotionDataSyncService,
    private readonly dataScopes: DataScopeService,
    private readonly audit: AuditLogsService,
    @Optional() private readonly promotionAccess?: PromotionAccountAccessService,
  ) {}

  onModuleInit() {
    this.worker = setInterval(() => void this.runWorker(), 5_000);
    void this.runWorker();
  }

  onModuleDestroy() { if (this.worker) clearInterval(this.worker); }

  async options(user: AdminCurrentUser) {
    const scope = await this.accountScope(user);
    const accounts = await this.prisma.promotionAccount.findMany({
      where: { AND: [scope, { status: ContentStatus.ACTIVE, platform: { contains: '腾讯' }, accountNo: { not: null } }] },
      orderBy: [{ project: 'asc' }, { name: 'asc' }, { accountNo: 'asc' }],
    });
    const config = await this.prisma.promotionDataSyncConfig.findUnique({ where: { provider: 'TENCENT_ADS' } });
    const credentials = await this.prisma.promotionAccountCredential.findMany({ where: { accountId: { in: accounts.map((account) => account.id) } } });
    const credentialMap = new Map(credentials.map((credential) => [credential.accountId, credential]));
    const businessUnitMap = new Map<string, { key: string; name: string; project: string; accountCount: number }>();
    for (const account of accounts) {
      const key = this.businessUnitKey(account.project);
      const current = businessUnitMap.get(key) || { key, name: `腾讯广告 · ${account.project}`, project: account.project, accountCount: 0 };
      current.accountCount += 1;
      businessUnitMap.set(key, current);
    }
    return {
      accounts: await Promise.all(accounts.map(async (account) => {
        const credential = credentialMap.get(account.id);
        const credentialStatus = this.sync.credentialStatus(credential, config);
        const authorized = Boolean(config?.enabled && credentialStatus.authorized);
        const hasUserToken = credentialStatus.hasUserToken;
        const accountCanCreate = this.promotionAccess ? await this.promotionAccess.canCreateCreatives(user, account) : true;
        return {
        id: account.id, name: account.name, accountNo: account.accountNo, project: account.project, platform: account.platform,
        tencentBusinessUnitKey: this.tencentAccountScopeKey(String(account.accountNo)),
        authorized, hasUserToken, canCreate: authorized && hasUserToken && accountCanCreate && this.has(user, 'PROMOTION_CREATIVE_BATCH_CREATE'),
        authorizationMessage: !authorized ? '未配置可用的腾讯业务单元或账户级授权凭证' : !hasUserToken ? '缺少有效的腾讯 User Token，请联系管理员检查业务单元授权或账户凭证' : !accountCanCreate ? '当前成员未获该账户的创意创建权限' : '腾讯授权已配置；目标账户权限将在读取营销单元时由腾讯接口确认',
      }})),
      businessUnits: [...businessUnitMap.values()],
      maxBatchSize: await this.maxBatchSize(),
      sdk: { apiVersion: '3.0', packageVersion: 'v1.7.87', ordinaryMode: 'DYNAMIC_CREATIVE_TYPE_COMMON', programMode: 'DYNAMIC_CREATIVE_TYPE_PROGRAM' },
    };
  }

  async adgroups(query: PromotionCreativeAdgroupQueryDto, user: AdminCurrentUser) {
    const account = await this.account(query.accountId, user);
    const page = query.page || 1; const pageSize = query.pageSize || 20;
    const response = await this.sync.tencentApi('GET', '/adgroups/get', String(account.accountNo), {
      fields: ADGROUP_FIELDS, page, page_size: pageSize, is_deleted: false,
    });
    let rows = this.rows(response.data);
    const search = query.search?.trim().toLowerCase();
    if (search) rows = rows.filter((row) => [row.adgroup_name, row.adgroup_id, row.marketing_target_id, row.system_status].some((value) => String(value || '').toLowerCase().includes(search)));
    return {
      list: rows.map((row) => ({
        id: String(row.adgroup_id || ''), name: String(row.adgroup_name || `营销单元 ${row.adgroup_id || ''}`),
        marketingGoal: row.marketing_goal || null, marketingSubGoal: row.marketing_sub_goal || null,
        marketingCarrierType: row.marketing_carrier_type || null, marketingTargetType: row.marketing_target_type || null,
        marketingTargetId: row.marketing_target_id ? String(row.marketing_target_id) : null,
        optimizationGoal: row.optimization_goal || null, configuredStatus: row.configured_status || null,
        systemStatus: row.system_status || null, createdTime: this.platformTime(row.created_time),
        canCreate: this.adgroupUsable(row), unavailableReason: this.adgroupUsable(row) ? null : this.adgroupUnavailableReason(row), raw: this.safePlatformRecord(row),
      })),
      pageInfo: this.pageInfo(response.data, page, pageSize), requestId: response.requestId,
    };
  }

  async templates(query: PromotionCreativeTemplateQueryDto, user: AdminCurrentUser) {
    const account = await this.account(query.accountId, user);
    const adgroup = await this.adgroup(account, query.adgroupId, true);
    const page = query.page || 1; const pageSize = query.pageSize || 30;
    const response = await this.sync.tencentApi('GET', '/creative_template_list/get', String(account.accountNo), {
      adgroup_id: this.safeInteger(query.adgroupId, '营销单元 ID'), dynamic_creative_type: query.dynamicCreativeType, page, page_size: pageSize,
    });
    let rows = this.rows(response.data).filter((item) => !item.is_offline);
    const search = query.search?.trim().toLowerCase();
    if (search) rows = rows.filter((row) => [row.creative_template_id, row.creative_template_appellation, row.creative_template_style].some((value) => String(value || '').toLowerCase().includes(search)));
    return {
      adgroup: this.safePlatformRecord(adgroup),
      list: rows.map((row) => ({
        id: String(row.creative_template_id || ''), name: String(row.creative_template_appellation || row.creative_template_style || `创意规格 ${row.creative_template_id}`),
        style: row.creative_template_style || null, size: row.creative_template_size || null, sampleImage: row.creative_sample_image || null,
        siteSet: row.site_set || null, supportBidModes: row.support_bid_mode_list || [], offline: Boolean(row.is_offline), offlineTips: row.offline_tips || null,
      })),
      pageInfo: this.pageInfo(response.data, page, pageSize), requestId: response.requestId,
    };
  }

  async templateDetail(query: PromotionCreativeTemplateQueryDto & { templateId: string }, user: AdminCurrentUser) {
    const account = await this.account(query.accountId, user);
    const adgroup = await this.adgroup(account, query.adgroupId, true);
    const requestParams = {
      adgroup_id: this.safeInteger(query.adgroupId, '营销单元 ID'), creative_template_id: this.safeInteger(query.templateId, '创意规格 ID'),
      delivery_mode: query.deliveryMode, dynamic_creative_type: query.dynamicCreativeType, use_new_version: true,
      marketing_goal: adgroup.marketing_goal, marketing_sub_goal: adgroup.marketing_sub_goal,
      marketing_target_type: adgroup.marketing_target_type, marketing_carrier_type: adgroup.marketing_carrier_type,
      ...(adgroup.site_set ? { site_set: JSON.stringify(adgroup.site_set) } : {}),
    };
    const response = await this.sync.tencentApi('GET', '/creative_template/get', String(account.accountNo), requestParams);
    const detail = this.rows(response.data).find((row) => String(row.creative_template_id) === query.templateId) || this.rows(response.data)[0];
    if (!detail) throw new BusinessException(400851, '腾讯广告未返回该营销单元可用的创意规格', 400);
    this.assertDynamicSupport(detail, query.dynamicCreativeType);
    let cachedDetail: PlatformRecord = detail;
    if (query.dynamicCreativeType === 'DYNAMIC_CREATIVE_TYPE_PROGRAM') {
      let ordinaryRequirements: Array<Record<string, any>> = [];
      try {
        const ordinaryResponse = await this.sync.tencentApi('GET', '/creative_template/get', String(account.accountNo), {
          ...requestParams,
          dynamic_creative_type: 'DYNAMIC_CREATIVE_TYPE_COMMON',
        });
        const ordinaryDetail = this.rows(ordinaryResponse.data).find((row) => String(row.creative_template_id) === query.templateId)
          || this.rows(ordinaryResponse.data)[0];
        if (ordinaryDetail) ordinaryRequirements = this.templateRequirements(ordinaryDetail);
      } catch (error) {
        this.logger.warn(`读取普通创意必填规格失败，将尝试使用本地缓存: ${error instanceof Error ? error.message : 'unknown'}`);
      }
      if (!ordinaryRequirements.length) {
        const ordinaryCache = await this.prisma.promotionCreativeTemplateCache.findUnique({
          where: { accountId_adgroupId_templateId_deliveryMode_dynamicCreativeType: { accountId: account.id, adgroupId: query.adgroupId, templateId: query.templateId, deliveryMode: query.deliveryMode, dynamicCreativeType: 'DYNAMIC_CREATIVE_TYPE_COMMON' } },
        });
        if (ordinaryCache) ordinaryRequirements = this.templateRequirements(ordinaryCache.templateJson as PlatformRecord);
      }
      if (!ordinaryRequirements.length) throw new BusinessException(400876, '无法读取同规格普通创意的必填规则，请先切换普通创意加载该规格后重试', 400);
      cachedDetail = { ...detail, __ordinaryRequirements: ordinaryRequirements };
    }
    const templateName = String(detail.creative_template_appellation || detail.creative_template_style || `创意规格 ${query.templateId}`);
    const cache = await this.prisma.promotionCreativeTemplateCache.upsert({
      where: { accountId_adgroupId_templateId_deliveryMode_dynamicCreativeType: { accountId: account.id, adgroupId: query.adgroupId, templateId: query.templateId, deliveryMode: query.deliveryMode, dynamicCreativeType: query.dynamicCreativeType } },
      create: { accountId: account.id, adgroupId: query.adgroupId, templateId: query.templateId, deliveryMode: query.deliveryMode, dynamicCreativeType: query.dynamicCreativeType, templateName, templateJson: cachedDetail as Prisma.InputJsonValue },
      update: { templateName, templateJson: cachedDetail as Prisma.InputJsonValue, lastSyncedAt: new Date() },
    });
    return { id: cache.id, template: detail, requirements: this.templateRequirementsForContext(cachedDetail, query.templateId, query.dynamicCreativeType), requestId: response.requestId };
  }

  async assets(query: PromotionCreativeAssetQueryDto, user: AdminCurrentUser) {
    const target = await this.account(query.accountId, user, 'MATERIALS');
    const businessUnitKey = this.tencentAccountScopeKey(String(target.accountNo));
    if (query.businessUnitKey && ![businessUnitKey, this.businessUnitKey(target.project)].includes(query.businessUnitKey)) throw new BusinessException(400852, '腾讯资产范围与目标账户不匹配', 400);
    // Landing-page snapshots created by the earlier implementation were
    // reference-only. Refresh them on access so approved pages become
    // selectable without requiring an operator to know about cache migration.
    // Asset categories are fetched independently from Tencent. Checking only
    // whether an account has *any* snapshot caused the first loaded category
    // (often video) to suppress later component syncs, so newly-created text
    // links and other account components never reached the admin list. Keep a
    // short per-category/per-source cache and refresh stale or missing scopes.
    if (query.refresh || !await this.hasFreshAssetSnapshots(target.id, query.assetType, query.source)) {
      await this.syncAssets(target, query.assetType, query.page || 1, 100, query.source);
    }
    if (['TEXT_LINK', 'ACTION_BUTTON'].includes(String(query.assetType || ''))
      && (query.refresh || !await this.hasFreshAssetSnapshots(target.id, 'LANDING_PAGE', 'ACCOUNT'))) {
      await this.syncAssets(target, 'LANDING_PAGE', 1, 100, 'ACCOUNT');
    }
    const page = query.page || 1; const pageSize = query.pageSize || 20;
    const componentTypeScope = this.assetQueryScope(query.assetType);
    let templateRequirements: Array<Record<string, any>> | null = null;
    if (query.adgroupId && query.templateId && query.deliveryMode && query.dynamicCreativeType) {
      const cachedTemplate = await this.prisma.promotionCreativeTemplateCache.findFirst({
        where: {
          accountId: target.id, adgroupId: query.adgroupId, templateId: query.templateId,
          deliveryMode: query.deliveryMode, dynamicCreativeType: query.dynamicCreativeType,
        },
        orderBy: { lastSyncedAt: 'desc' },
      });
      const detail = cachedTemplate
        ? { template: cachedTemplate.templateJson, requirements: this.templateRequirementsForContext(cachedTemplate.templateJson as PlatformRecord, query.templateId, query.dynamicCreativeType) }
        : await this.templateDetail({
          accountId: target.id, adgroupId: query.adgroupId, templateId: query.templateId,
          deliveryMode: query.deliveryMode, dynamicCreativeType: query.dynamicCreativeType,
        }, user);
      templateRequirements = detail.requirements as Array<Record<string, any>>;
    }
    const allowedTemplateFields = templateRequirements
      ? new Set(templateRequirements.map((item) => this.canonicalCreativeComponentField(String(item.path || item.name || '').split('.').pop() || '')).filter(Boolean))
      : null;
    const where: Prisma.PromotionCreativeMaterialSnapshotWhereInput = {
      originAccountId: target.id, businessUnitKey, isDeleted: false, ...componentTypeScope,
      ...(query.search ? { OR: [{ name: { contains: query.search } }, { platformAssetId: { contains: query.search } }] } : {}),
    };
    const candidates = await this.prisma.promotionCreativeMaterialSnapshot.findMany({ where, include: { originAccount: { select: { id: true, name: true, accountNo: true, project: true } } }, orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }], take: 1000 });
    const sourceRows = candidates.filter((row) => {
      const payload = row.payloadJson as Record<string, any>;
      const scopes = Array.isArray(payload.platformAssetScopes) ? payload.platformAssetScopes.map(String) : [];
      const sourceMatches = scopes.length
        ? scopes.includes(query.source)
        : (query.source === 'ACCOUNT'
          ? String(payload.platformOwnerAccountId || target.accountNo || '') === String(target.accountNo)
          : String(payload.platformOwnerAccountId || target.accountNo || '') !== String(target.accountNo));
      if (!sourceMatches) return false;
      if (query.assetType === 'BRAND') {
        const authorizedType = String(payload.authorizedAccount?.type || '');
        if (payload.componentSubType !== 'BRAND_WECHAT_CHANNEL' && authorizedType !== 'WECHAT_CHANNELS') return false;
      }
      if (!allowedTemplateFields || !templateRequirements) return true;
      const canonical = this.canonicalCreativeComponentField(row.componentField || payload.componentField);
      const submissionField = this.componentSubmissionField(canonical, templateRequirements);
      return allowedTemplateFields.has(this.canonicalCreativeComponentField(submissionField))
        && this.assetMatchesTemplateDimensions(row, submissionField, templateRequirements);
    });
    const dimensionsOf = (row: typeof sourceRows[number]) => {
      const payload = row.payloadJson as Record<string, any>;
      const bundledCount = this.imageListItemCount(payload);
      if (bundledCount > 1) {
        const requirement = templateRequirements?.find((item) => String(item.path || item.name || '').split('.').pop() === 'image_list');
        const dimensionRule = (Array.isArray(requirement?.itemRules) ? requirement.itemRules : [])
          .find((rule: any) => Number(rule.width) > 0 && Number(rule.height) > 0);
        return dimensionRule ? `${Number(dimensionRule.width)}×${Number(dimensionRule.height)}` : null;
      }
      return ['IMAGE', 'VIDEO'].includes(row.assetType) && Number(payload.width) > 0 && Number(payload.height) > 0
        ? `${Number(payload.width)}×${Number(payload.height)}`
        : null;
    };
    const availableDimensions = [...new Set(sourceRows.map(dimensionsOf).filter((value): value is string => Boolean(value)))].sort((left, right) => {
      const [leftWidth, leftHeight] = left.split('×').map(Number); const [rightWidth, rightHeight] = right.split('×').map(Number);
      return leftWidth * leftHeight - rightWidth * rightHeight || left.localeCompare(right);
    });
    const requestedDimensions = query.dimensions?.replace('x', '×');
    const rows = requestedDimensions ? sourceRows.filter((row) => dimensionsOf(row) === requestedDimensions) : sourceRows;
    const spend = query.assetType === 'MEDIA'
      ? await this.assetSpendWindows(String(target.accountNo))
      : query.assetType === 'COPY'
        ? await this.componentSpendWindows(String(target.accountNo), await this.tencentBusinessUnitId(String(target.accountNo)))
        : { seven: new Map<string, number>(), fifteen: new Map<string, number>(), available: false };
    const sortBy = query.sortBy || 'CREATED_TIME'; const direction = query.sortOrder === 'ASC' ? 1 : -1;
    rows.sort((left, right) => {
      const compareText = (a: unknown, b: unknown) => String(a || '').localeCompare(String(b || ''), 'zh-CN');
      const compareNumber = (a: unknown, b: unknown) => Number(a ?? -1) - Number(b ?? -1);
      let compared = 0;
      if (sortBy === 'NAME') compared = compareText(left.name, right.name);
      else if (sortBy === 'STATUS') compared = compareText(`${left.status || ''}:${left.auditStatus || ''}`, `${right.status || ''}:${right.auditStatus || ''}`);
      else if (sortBy === 'SPEND_7_DAYS') compared = compareNumber(spend.seven.get(left.platformAssetId), spend.seven.get(right.platformAssetId));
      else if (sortBy === 'SPEND_15_DAYS') compared = compareNumber(spend.fifteen.get(left.platformAssetId), spend.fifteen.get(right.platformAssetId));
      else compared = compareNumber(left.platformCreatedAt?.getTime(), right.platformCreatedAt?.getTime());
      return compared * direction || compareText(left.name, right.name);
    });
    const total = rows.length;
    const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
    const showsLinkedLandingPage = ['TEXT_LINK', 'ACTION_BUTTON', 'MINI_CARD_LINK'].includes(String(query.assetType || ''));
    const landingPageRows = showsLinkedLandingPage
      ? await this.prisma.promotionCreativeMaterialSnapshot.findMany({
        where: { originAccountId: target.id, businessUnitKey, assetType: 'LANDING_PAGE', isDeleted: false },
        select: { platformAssetId: true, name: true, payloadJson: true },
        take: 1000,
      })
      : [];
    const landingPageByPageId = new Map<string, { pageId: string; name: string; platformAssetId: string }>();
    for (const landingPage of landingPageRows) {
      const pageId = this.officialLandingPageId((landingPage.payloadJson as PlatformRecord)?.component);
      if (pageId && !landingPageByPageId.has(pageId)) landingPageByPageId.set(pageId, { pageId, name: landingPage.name, platformAssetId: landingPage.platformAssetId });
    }
    return {
      list: pageRows.map((row) => {
        const payload = row.payloadJson as Record<string, any>;
        const sameAccount = query.source === 'ACCOUNT';
        const platformReady = payload.kind !== 'REFERENCE';
        const stateValid = !/reject|invalid|delete|offline|disabled|fail/i.test(`${row.status || ''} ${row.auditStatus || ''}`);
        // 腾讯业务单元资产使用平台原始素材 ID 直接引用，不复制到目标账户。
        // 资产查询已按业务单元和成员数据范围收敛；提交时还会再次校验。
        const usable = platformReady && stateValid;
        const linkedPageId = ['text_link', 'mini_card_link', 'action_button', 'chosen_button'].includes(this.canonicalCreativeComponentField(row.componentField))
          ? this.officialLandingPageId(payload.component)
          : null;
        const linkedLandingPage = linkedPageId
          ? landingPageByPageId.get(linkedPageId) || { pageId: linkedPageId, name: `腾讯落地页 ${linkedPageId}`, platformAssetId: linkedPageId }
          : null;
        return {
          id: row.id, source: sameAccount ? 'ACCOUNT' : 'BUSINESS_UNIT', sourceAccount: row.originAccount,
          businessUnitKey: row.businessUnitKey, platformAssetId: row.platformAssetId, platformAssetKind: row.platformAssetKind, type: row.assetType, componentField: row.componentField,
          name: row.name, contentSummary: this.imageListItemCount(payload) > 1 ? `${row.name} · 九图组件（${this.imageListItemCount(payload)} 张）` : this.componentContent(row.componentField, payload.component, row.name), previewUrl: null, status: row.status, auditStatus: row.auditStatus, createdTime: row.platformCreatedAt,
          dimensions: dimensionsOf(row),
          bundleItemCount: this.imageListItemCount(payload) || null,
          componentSubType: payload.componentSubType || null,
          spend7Days: spend.available ? (spend.seven.get(row.platformAssetId) ?? 0) : null,
          spend15Days: spend.available ? (spend.fifteen.get(row.platformAssetId) ?? 0) : null,
          linkedLandingPage,
          usable,
          referenceMode: sameAccount ? 'ACCOUNT_DIRECT' : 'BUSINESS_UNIT_DIRECT',
          unavailableReason: usable ? null : !platformReady ? '该平台记录仅供参考，缺少可提交的创意组件结构' : '素材已失效、删除或审核未通过',
        };
      }),
      pageInfo: { page, pageSize, totalNumber: total, totalPage: Math.ceil(total / pageSize) },
      availableDimensions,
    };
  }

  async preview(dto: PromotionCreativeBatchRequestDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const prepared = await this.prepare(dto, user);
    await this.audit.create({ adminUserId: user.adminUserId, action: 'PREVIEW_PROMOTION_CREATIVE_BATCH', resourceType: 'promotion_creative_batch', resourceId: dto.accountId, afterJson: this.auditSummary(prepared) as Prisma.InputJsonValue, ip, userAgent: this.userAgent(userAgent) });
    return { ...prepared.preview, maxBatchSize: prepared.maxBatchSize, requiresConfirmation: prepared.preview.items.length > 20 };
  }

  async createTask(dto: PromotionCreativeBatchRequestDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const prepared = await this.prepare(dto, user);
    if (this.promotionAccess) await this.promotionAccess.assertCanCreateCreatives(user, prepared.account);
    const normalized = { ...dto, rules: prepared.effectiveRules, materials: this.sortSelection(dto.materials), combinations: prepared.combinations, submissions: prepared.itemPayloads.map((item) => item.payload) };
    const fingerprint = this.hash({ adminUserId: user.adminUserId, accountId: dto.accountId, adgroupId: dto.adgroupId, templateId: dto.templateId, normalized });
    const recent = await this.prisma.promotionCreativeBatchTask.findFirst({ where: { requestFingerprint: fingerprint, createdByAdminId: user.adminUserId, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } }, include: { items: { orderBy: { sequence: 'asc' } } }, orderBy: { createdAt: 'desc' } });
    if (recent) return { ...recent, duplicate: true, message: '该批任务已创建或正在提交' };
    const bucket = Math.floor(Date.now() / 600_000);
    const dedupeKey = `${fingerprint}:${bucket}`;
    const existing = await this.prisma.promotionCreativeBatchTask.findUnique({ where: { dedupeKey }, include: { items: { orderBy: { sequence: 'asc' } } } });
    if (existing) return { ...existing, duplicate: true, message: '该批任务已创建或正在提交' };
    let task;
    try {
      task = await this.prisma.$transaction(async (tx) => tx.promotionCreativeBatchTask.create({ data: {
        dedupeKey, requestFingerprint: fingerprint, accountId: dto.accountId, businessUnitKey: dto.businessUnitKey,
        adgroupId: dto.adgroupId, marketingTargetId: prepared.adgroup.marketingTargetId, templateId: dto.templateId,
        deliveryMode: dto.deliveryMode, dynamicCreativeType: dto.dynamicCreativeType, combinationMode: dto.combinationMode,
        materialRules: prepared.effectiveRules as unknown as Prisma.InputJsonValue, requestSnapshot: this.redact(normalized) as Prisma.InputJsonValue,
        totalCount: prepared.itemPayloads.length, createdByAdminId: user.adminUserId, submittedIp: ip,
        submittedUserAgent: this.userAgent(userAgent),
        items: { create: prepared.itemPayloads.map((item, index) => ({
          sequence: index + 1, creativeName: item.name, itemFingerprint: this.hash(item.payload),
          platformRequestKey: `${fingerprint.slice(0, 48)}-${String(index + 1).padStart(3, '0')}`,
          creativePayload: item.payload as Prisma.InputJsonValue, materialSnapshot: item.materialSnapshot as Prisma.InputJsonValue,
        })) },
      }, include: { items: { orderBy: { sequence: 'asc' } } } }));
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error;
      const raced = await this.prisma.promotionCreativeBatchTask.findUnique({ where: { dedupeKey }, include: { items: { orderBy: { sequence: 'asc' } } } });
      if (!raced) throw error;
      return { ...raced, duplicate: true, message: '该批任务已创建或正在提交' };
    }
    await this.audit.create({ adminUserId: user.adminUserId, action: 'CREATE_PROMOTION_CREATIVE_BATCH', resourceType: 'promotion_creative_batch_tasks', resourceId: task.id, afterJson: this.auditSummary(prepared) as Prisma.InputJsonValue, ip, userAgent: this.userAgent(userAgent) });
    void this.runWorker();
    return { ...task, duplicate: false, message: '批量创意任务已进入服务端队列' };
  }

  async tasks(query: PromotionCreativeTaskQueryDto, user: AdminCurrentUser) {
    const page = query.page || 1; const pageSize = query.pageSize || 20;
    const where: Prisma.PromotionCreativeBatchTaskWhereInput = { account: await this.accountScope(user), ...(query.accountId ? { accountId: query.accountId } : {}), ...(query.status ? { status: query.status } : {}) };
    const [list, total] = await Promise.all([
      this.prisma.promotionCreativeBatchTask.findMany({ where, include: { account: { select: { id: true, name: true, accountNo: true, project: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.promotionCreativeBatchTask.count({ where }),
    ]);
    return { list, pageInfo: { page, pageSize, totalNumber: total, totalPage: Math.ceil(total / pageSize) } };
  }

  async task(id: string, user: AdminCurrentUser) {
    const task = await this.taskOrThrow(id, user);
    const result = await this.prisma.promotionCreativeBatchTask.findUnique({ where: { id: task.id }, include: { account: { select: { id: true, name: true, accountNo: true, project: true } }, items: { orderBy: { sequence: 'asc' } }, submissionLogs: { orderBy: { createdAt: 'desc' }, take: 100 } } });
    if (!result) return result;
    return {
      ...result,
      items: result.items.map((item) => {
        if (item.errorCode === '11101') return { ...item, recoverySuggestion: this.recoverySuggestion('11101', item.errorMessage || '') };
        const components = (item.creativePayload as Record<string, any>)?.creative_components || {};
        if (item.errorCode === '1670002' && components.video?.length && !components.image?.length && !components.image_list?.length) {
          return {
            ...item,
            errorMessage: `视频默认封面尺寸不符合当前规格；腾讯原始提示：${item.errorMessage || '图片尺寸不符合要求'}`,
            recoverySuggestion: '该项已明确失败，未创建腾讯创意。请更换默认封面尺寸符合当前规格的视频后创建新批次',
          };
        }
        return item;
      }),
    };
  }

  async retry(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const task = await this.taskOrThrow(id, user);
    const taskAccount = await this.account(task.accountId, user);
    await this.promotionAccess?.assertCanCreateCreatives(user, taskAccount);
    await this.assertTencentUserTokenConfigured(task.accountId);
    if (task.status === 'CANCELLED') throw new BusinessException(400858, '已取消任务不能重试', 400);
    const items = await this.prisma.promotionCreativeBatchItem.findMany({ where: { taskId: id, status: { in: ['FAILED', 'UNKNOWN'] } } });
    if (!items.length) throw new BusinessException(400859, '没有可重试或待确认的创意', 400);
    for (const item of items) {
      if (item.status === 'UNKNOWN') await this.reconcileItem(task, item, true);
      else await this.prisma.promotionCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'PENDING', errorCode: null, errorMessage: null, recoverySuggestion: null, retryCount: { increment: 1 } } });
    }
    await this.prisma.promotionCreativeBatchTask.update({ where: { id }, data: { status: 'PENDING', completedAt: null } });
    await this.audit.create({ adminUserId: user.adminUserId, action: 'RETRY_PROMOTION_CREATIVE_BATCH', resourceType: 'promotion_creative_batch_tasks', resourceId: id, afterJson: { itemCount: items.length } as Prisma.InputJsonValue, ip, userAgent: this.userAgent(userAgent) });
    void this.runWorker();
    return this.task(id, user);
  }

  async cancel(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const task = await this.taskOrThrow(id, user);
    if (!['PENDING', 'PROCESSING'].includes(task.status)) throw new BusinessException(400860, '仅待处理或处理中且尚未提交的明细可取消', 400);
    await this.prisma.$transaction([
      this.prisma.promotionCreativeBatchItem.updateMany({ where: { taskId: id, status: 'PENDING' }, data: { status: 'SKIPPED', errorMessage: '用户取消，未提交腾讯广告' } }),
      this.prisma.promotionCreativeBatchTask.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), completedAt: new Date() } }),
    ]);
    await this.audit.create({ adminUserId: user.adminUserId, action: 'CANCEL_PROMOTION_CREATIVE_BATCH', resourceType: 'promotion_creative_batch_tasks', resourceId: id, beforeJson: { status: task.status } as Prisma.InputJsonValue, afterJson: { status: 'CANCELLED' } as Prisma.InputJsonValue, ip, userAgent: this.userAgent(userAgent) });
    return { id, cancelled: true };
  }

  async exportRows(id: string, user: AdminCurrentUser) {
    const task = await this.taskOrThrow(id, user);
    const items = await this.prisma.promotionCreativeBatchItem.findMany({ where: { taskId: task.id }, orderBy: { sequence: 'asc' } });
    await this.audit.create({ adminUserId: user.adminUserId, action: 'EXPORT_PROMOTION_CREATIVE_BATCH_RESULTS', resourceType: 'promotion_creative_batch_tasks', resourceId: id, afterJson: { count: items.length } as Prisma.InputJsonValue });
    return items.map((item) => ({ sequence: item.sequence, creativeName: item.creativeName, status: item.status, platformCreativeId: item.platformCreativeId || '', errorCode: item.errorCode || '', errorMessage: item.errorMessage || '', submittedAt: item.submittedAt, verifiedAt: item.verifiedAt }));
  }

  private async prepare(dto: PromotionCreativeBatchRequestDto, user: AdminCurrentUser) {
    this.assertPermission(user, 'PROMOTION_CREATIVE_BATCH_CREATE');
    this.assertPermission(user, 'PROMOTION_CREATIVE_TEMPLATE_VIEW');
    this.assertPermission(user, 'PROMOTION_CREATIVE_ASSET_VIEW');
    const account = await this.account(dto.accountId, user);
    await this.assertTencentUserTokenConfigured(account.id);
    const acceptedScopeKeys = [this.tencentAccountScopeKey(String(account.accountNo)), this.businessUnitKey(account.project)];
    if (!acceptedScopeKeys.includes(dto.businessUnitKey)) throw new BusinessException(400852, '腾讯资产范围与目标账户不匹配', 400);
    const adgroupRaw = await this.adgroup(account, dto.adgroupId, true);
    const detail = await this.templateDetail({ accountId: dto.accountId, adgroupId: dto.adgroupId, templateId: dto.templateId, deliveryMode: dto.deliveryMode, dynamicCreativeType: dto.dynamicCreativeType }, user);
    const maxBatchSize = await this.maxBatchSize();
    let combinations: CreativeCombination[];
    const effectiveRules = { ...dto.rules };
    if (dto.materials.images.length) {
      const imageSelections = await this.prisma.promotionCreativeMaterialSnapshot.findMany({
        where: { id: { in: dto.materials.images } },
        select: { id: true, componentField: true, payloadJson: true },
      });
      const imageListSelections = imageSelections.filter((asset) => this.imageListItemCount(asset.payloadJson) > 1);
      if (imageListSelections.length && imageListSelections.length !== dto.materials.images.length) {
        throw new BusinessException(400875, '腾讯九图组件不能与单张图片混合选择，请仅选择九图组件或仅选择单张图片', 400);
      }
      // A prebuilt image_list is one selectable component. Its inner list is
      // still checked against Tencent's nine-image template below.
      if (imageListSelections.length) effectiveRules.imageCount = 1;
    }
    try {
      // Brand and marketing components are fixed creative structure, not
      // combinable media. Attach every explicitly selected fixed component to
      // each generated creative. This removes the ambiguous conversionCount
      // behaviour that previously discarded a chosen floating card when the
      // count happened to be zero.
      const fixedComponentIds = [...new Set([...dto.materials.conversionComponents, ...dto.materials.otherComponents])];
      const simplifiedMaterials = {
        ...dto.materials,
        conversionComponents: [],
        otherComponents: [],
      };
      const simplifiedRules = { ...effectiveRules, conversionCount: 0 };
      const simplifiedManualGroups = (dto.manualGroups || []).map((group) => ({
        ...group,
        conversionIds: [],
        otherComponentIds: fixedComponentIds,
      }));
      combinations = dto.combinationMode === 'MANUAL'
        ? generateCreativeCombinations(dto.combinationMode, dto.materials, effectiveRules, dto.manualGroups || [], maxBatchSize)
        : generateCreativeCombinations(dto.combinationMode, simplifiedMaterials, simplifiedRules, simplifiedManualGroups, maxBatchSize);
    }
    catch (error) { throw new BusinessException(400853, error instanceof Error ? error.message : '创意组合规则无效', 400); }
    // Required placement components (for example a video-channel floating card)
    // are selected independently from the generic marketing-component count.
    // Keep the operator's explicit choices available even when conversionCount
    // is zero, otherwise the compatibility upgrader would silently pick a
    // different card from the latest cached assets.
    const selectedIds = [...new Set([
      ...combinations.flatMap((item) => [...item.titleIds, ...item.videoIds, ...item.landingPageIds, ...item.conversionIds, ...item.imageIds, ...item.otherComponentIds]),
      ...dto.materials.conversionComponents,
      ...dto.materials.otherComponents,
    ])];
    const assets = await this.prisma.promotionCreativeMaterialSnapshot.findMany({
      where: { id: { in: selectedIds }, originAccount: await this.accountScope(user) },
      include: { originAccount: { select: { id: true, name: true, accountNo: true, project: true } } },
    });
    if (assets.length !== selectedIds.length) throw new BusinessException(400854, '部分素材不存在或已被清理，请重新选择', 400);
    const assetMap = new Map(assets.map((item) => [item.id, item]));
    const preferredConversionAssets = dto.materials.conversionComponents.map((id) => assetMap.get(id)!);
    for (const asset of assets) this.assertAssetUsable(asset, account.id, dto.businessUnitKey);
    const requirements = detail.requirements as Array<Record<string, any>>;
    if (dto.combinationMode !== 'MANUAL') {
      const fixedAssets = [...new Set([...dto.materials.conversionComponents, ...dto.materials.otherComponents])].map((id) => assetMap.get(id)!);
      combinations = this.applyFixedComponentVariants(combinations, fixedAssets, requirements, dto.combinationMode, maxBatchSize);
    }
    const itemPayloads = await Promise.all(combinations.map(async (combination, index) => {
      const selected = [...combination.titleIds, ...combination.videoIds, ...combination.landingPageIds, ...combination.conversionIds, ...combination.imageIds, ...combination.otherComponentIds].map((id) => assetMap.get(id)!);
      const creativeComponents: Record<string, unknown[]> = {};
      for (const asset of selected) {
        const payload = asset.payloadJson as Record<string, any>;
        const field = this.componentSubmissionField(
          this.canonicalCreativeComponentField(asset.componentField || payload.componentField),
          requirements,
        );
        if (!field || !CREATIVE_COMPONENT_FIELDS.has(field) || !payload.component) throw new BusinessException(400855, `素材“${asset.name}”缺少腾讯创意组件结构，不能提交`, 400);
        const component = this.componentSubmissionValue(field, payload.component);
        (creativeComponents[field] ||= []).push(this.normalizeTencentAssetIds(component));
      }
      this.aggregateImageListComponents(creativeComponents);
      const upgraded = await this.upgradeLegacyChannelComponents(
        { creative_components: creativeComponents },
        { accountId: account.id, businessUnitKey: dto.businessUnitKey },
        [...new Map([...selected, ...preferredConversionAssets].map((asset) => [asset.id, asset])).values()],
        detail.template as PlatformRecord,
      );
      const completedComponents = upgraded.payload.creative_components as Record<string, unknown[]>;
      const completedAssets = [...selected, ...upgraded.assets.filter((asset) => !selected.some((item) => item.id === asset.id))];
      this.validateTemplateComponents(requirements, completedComponents, dto.dynamicCreativeType);
      this.validatePlacementDependencies(detail.template as PlatformRecord, completedComponents);
      const name = this.creativeName(dto.namePattern, index + 1, selected, account.name);
      const payload = {
        account_id: this.safeInteger(String(account.accountNo), '账户 ID'), adgroup_id: this.safeInteger(dto.adgroupId, '营销单元 ID'),
        dynamic_creative_name: name, creative_template_id: this.safeInteger(dto.templateId, '创意规格 ID'),
        delivery_mode: dto.deliveryMode, dynamic_creative_type: dto.dynamicCreativeType, creative_components: completedComponents,
        configured_status: dto.options?.configuredStatus || 'AD_STATUS_NORMAL',
        ...(dto.options?.impressionTrackingUrl ? { impression_tracking_url: dto.options.impressionTrackingUrl } : {}),
        ...(dto.options?.clickTrackingUrl ? { click_tracking_url: dto.options.clickTrackingUrl } : {}),
        ...(dto.options?.pageTrackUrl ? { page_track_url: dto.options.pageTrackUrl } : {}),
      };
      return { name, payload, materialSnapshot: completedAssets.map((asset) => ({ id: asset.id, type: asset.assetType, source: asset.originAccountId === account.id ? 'ACCOUNT' : 'BUSINESS_UNIT', referenceMode: asset.originAccountId === account.id ? 'ACCOUNT_DIRECT' : 'BUSINESS_UNIT_DIRECT', sourceAccountId: asset.originAccountId, platformAssetId: asset.platformAssetId, name: asset.name })) };
    }));
    return {
      account, adgroup: { id: String(adgroupRaw.adgroup_id), name: adgroupRaw.adgroup_name, marketingTargetId: adgroupRaw.marketing_target_id ? String(adgroupRaw.marketing_target_id) : null },
      template: detail, combinations, itemPayloads, maxBatchSize, effectiveRules,
      preview: { account: { id: account.id, name: account.name, accountNo: account.accountNo, project: account.project }, adgroup: { id: dto.adgroupId, name: adgroupRaw.adgroup_name }, template: { id: dto.templateId, name: (detail.template as any).creative_template_appellation || (detail.template as any).creative_template_style }, items: itemPayloads.map((item, index) => ({ sequence: index + 1, name: item.name, materials: item.materialSnapshot, creativeComponents: (item.payload as any).creative_components })) },
    };
  }

  private async runWorker() {
    if (this.workerBusy) return;
    this.workerBusy = true;
    try {
      const task = await this.prisma.promotionCreativeBatchTask.findFirst({ where: { status: { in: ['PENDING', 'PROCESSING'] } }, orderBy: { createdAt: 'asc' } });
      if (!task) return;
      const locked = await this.prisma.promotionCreativeBatchTask.updateMany({ where: { id: task.id, status: { in: ['PENDING', 'PROCESSING'] } }, data: { status: 'PROCESSING', startedAt: task.startedAt || new Date() } });
      if (!locked.count) return;
      const item = await this.prisma.promotionCreativeBatchItem.findFirst({ where: { taskId: task.id, status: 'PENDING' }, orderBy: { sequence: 'asc' } });
      if (item) await this.processItem(task, item);
      await this.refreshTaskCounts(task.id);
    } catch (error) { this.logger.error(`批量创意工作器异常: ${error instanceof Error ? error.message : 'unknown'}`); }
    finally { this.workerBusy = false; }
  }

  private async processItem(task: any, item: any) {
    const locked = await this.prisma.promotionCreativeBatchItem.updateMany({ where: { id: item.id, status: 'PENDING' }, data: { status: 'VALIDATING', errorCode: null, errorMessage: null, recoverySuggestion: null } });
    if (!locked.count) return;
    const account = await this.prisma.promotionAccount.findUnique({ where: { id: task.accountId } });
    if (!account?.accountNo || account.status !== ContentStatus.ACTIVE) return this.failItem(task, item, 'ACCOUNT_UNAVAILABLE', '目标账户不存在、已停用或未填写腾讯账户 ID', '恢复账户并重新发起任务');
    try {
      const creator = await this.currentUser(task.createdByAdminId);
      this.assertPermission(creator, 'PROMOTION_CREATIVE_BATCH_CREATE');
      await this.account(task.accountId, creator);
      await this.promotionAccess?.assertCanCreateCreatives(creator, account);
      await this.assertTencentUserTokenConfigured(account.id);
      const adgroup = await this.adgroup(account, task.adgroupId, true);
      if (!this.adgroupUsable(adgroup)) return this.failItem(task, item, 'ADGROUP_UNAVAILABLE', this.adgroupUnavailableReason(adgroup), '选择可投放营销单元后重新创建批次');
      await this.prisma.promotionCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'PREPARING_ASSETS' } });
      const materialSnapshot = item.materialSnapshot as Array<{ id: string; [key: string]: unknown }>;
      const assets = await this.prisma.promotionCreativeMaterialSnapshot.findMany({ where: { id: { in: materialSnapshot.map((entry) => entry.id) } } });
      if (assets.length !== materialSnapshot.length) return this.failItem(task, item, 'ASSET_MISSING', '部分素材快照不存在', '重新选择素材并创建新批次');
      for (const asset of assets) this.assertAssetUsable(asset, task.accountId, task.businessUnitKey);
      const upgraded = await this.upgradeLegacyChannelComponents(
        this.normalizeTencentCreativePayload(item.creativePayload as Record<string, unknown>), task, assets,
      );
      const creativePayload = upgraded.payload;
      const nextMaterialSnapshot = [...materialSnapshot];
      for (const asset of upgraded.assets) {
        if (!nextMaterialSnapshot.some((entry) => entry.id === asset.id)) nextMaterialSnapshot.push(this.materialSnapshotEntry(asset, task.accountId));
      }
      await this.prisma.promotionCreativeBatchItem.update({ where: { id: item.id }, data: {
        status: 'SUBMITTING', submittedAt: new Date(), creativePayload: creativePayload as Prisma.InputJsonValue,
        materialSnapshot: nextMaterialSnapshot as Prisma.InputJsonValue,
      } });
      await this.submissionLog(task.id, item.id, 'SUBMIT_TENCENT_CREATIVE', 'SUBMITTING', creativePayload);
      let response;
      try { response = await this.sync.tencentApi('POST', '/dynamic_creatives/add', String(account.accountNo), creativePayload); }
      catch (error) {
        if (error instanceof TencentMarketingApiError && error.retryable) {
          await this.prisma.promotionCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'UNKNOWN', errorCode: error.code, errorMessage: error.message, recoverySuggestion: '平台响应不确定，必须先回查，系统不会直接重复创建', platformRequestId: error.requestId, submittedAt: new Date() } });
          await this.submissionLog(task.id, item.id, 'TENCENT_CREATIVE_RESPONSE_UNKNOWN', 'UNKNOWN', undefined, undefined, error);
          return;
        }
        throw error;
      }
      const creativeId = String((response.data as any)?.dynamic_creative_id || '');
      if (!creativeId) {
        await this.prisma.promotionCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'UNKNOWN', errorCode: 'MISSING_CREATIVE_ID', errorMessage: '腾讯广告接受请求但未返回创意 ID', recoverySuggestion: '请使用回查/重试功能确认平台结果', platformRequestId: response.requestId } });
        return;
      }
      await this.prisma.promotionCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'PLATFORM_ACCEPTED', platformCreativeId: creativeId, platformRequestId: response.requestId } });
      await this.submissionLog(task.id, item.id, 'TENCENT_CREATIVE_ACCEPTED', 'PLATFORM_ACCEPTED', undefined, { creativeId }, undefined, response.requestId);
      await this.reconcileItem(task, { ...item, platformCreativeId: creativeId, status: 'PLATFORM_ACCEPTED' }, false);
    } catch (error) {
      const code = error instanceof TencentMarketingApiError ? error.code : 'VALIDATION_OR_PLATFORM_ERROR';
      const message = error instanceof Error ? error.message : '腾讯广告创建失败';
      await this.failItem(task, item, code, message, this.recoverySuggestion(code, message));
    }
  }

  private async reconcileItem(task: any, item: any, allowResubmit: boolean) {
    const account = await this.prisma.promotionAccount.findUnique({ where: { id: task.accountId } });
    if (!account?.accountNo) return;
    // Tencent only returns dynamic_creative_id after accepting and creating the
    // creative. Treat that authoritative ID as success. A follow-up GET may
    // normalize/omit helper fields (URLs, account hints, default covers), so it
    // must not downgrade an accepted creative to UNKNOWN and tempt operators
    // to create duplicates.
    if (item.platformCreativeId) {
      await this.prisma.promotionCreativeBatchItem.update({ where: { id: item.id }, data: {
        status: 'SUCCEEDED', verifiedAt: new Date(), errorCode: null, errorMessage: null, recoverySuggestion: null,
        verifyResult: { acceptedByTencent: true, creativeId: String(item.platformCreativeId), confirmationRule: 'PLATFORM_CREATIVE_ID_RETURNED' },
      } });
      await this.submissionLog(task.id, item.id, 'CONFIRM_TENCENT_CREATIVE_ID', 'SUCCEEDED', undefined, { creativeId: String(item.platformCreativeId) });
      return;
    }
    await this.prisma.promotionCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'VERIFYING' } });
    const filtering = item.platformCreativeId
      ? [{ field: 'dynamic_creative_id', operator: 'EQUALS', values: [String(item.platformCreativeId)] }]
      : [{ field: 'dynamic_creative_name', operator: 'EQUALS', values: [String(item.creativeName)] }];
    try {
      const response = await this.sync.tencentApi('GET', '/dynamic_creatives/get', String(account.accountNo), {
        fields: JSON.stringify([
          'dynamic_creative_id', 'dynamic_creative_name', 'adgroup_id', 'creative_template_id',
          'delivery_mode', 'dynamic_creative_type', 'creative_components', 'created_time',
          'configured_status', 'system_status',
        ]),
        filtering: JSON.stringify(filtering), page: 1, page_size: 20, is_deleted: false,
      });
      const row = this.rows(response.data).find((entry) => String(entry.dynamic_creative_id || '') === String(item.platformCreativeId || '') || String(entry.dynamic_creative_name || '') === item.creativeName);
      const payload = item.creativePayload as Record<string, any>;
      const submittedAt = item.submittedAt ? new Date(item.submittedAt).getTime() : Date.now();
      const platformCreatedAt = Number(row?.created_time || 0) * (Number(row?.created_time || 0) > 1e12 ? 1 : 1000);
      const matches = row ? String(row.adgroup_id || '') === String(task.adgroupId)
        && String(row.creative_template_id || '') === String(task.templateId)
        && String(row.dynamic_creative_name || '') === String(item.creativeName)
        && String(row.delivery_mode || '') === String(task.deliveryMode)
        && String(row.dynamic_creative_type || '') === String(task.dynamicCreativeType)
        && this.platformComponentsMatch(payload.creative_components || {}, row.creative_components || {})
        && (!platformCreatedAt || platformCreatedAt >= submittedAt - 120_000) : false;
      if (row && matches) {
        await this.prisma.promotionCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'SUCCEEDED', platformCreativeId: String(row.dynamic_creative_id), verifiedAt: new Date(), verifyResult: this.safePlatformRecord(row) as Prisma.InputJsonValue, errorCode: null, errorMessage: null, recoverySuggestion: null } });
        await this.submissionLog(task.id, item.id, 'VERIFY_TENCENT_CREATIVE', 'SUCCEEDED', undefined, { creativeId: String(row.dynamic_creative_id), adgroupId: String(row.adgroup_id), templateId: String(row.creative_template_id) }, undefined, response.requestId);
        return;
      }
      if (row) {
        await this.prisma.promotionCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'UNKNOWN', platformCreativeId: item.platformCreativeId || String(row.dynamic_creative_id || '') || null, errorCode: 'VERIFY_MISMATCH', errorMessage: '腾讯广告回查结果与本地任务的名称、营销单元、规格、类型、素材或创建时间不一致', recoverySuggestion: '请人工核对腾讯后台；为防重复创建，系统不会自动重投', verifiedAt: new Date(), verifyResult: this.safePlatformRecord(row) as Prisma.InputJsonValue } });
        await this.submissionLog(task.id, item.id, 'VERIFY_TENCENT_CREATIVE', 'UNKNOWN', undefined, { reason: 'VERIFY_MISMATCH', creativeId: String(row.dynamic_creative_id || '') }, undefined, response.requestId);
        return;
      }
      if (allowResubmit && !item.platformCreativeId && Date.now() - submittedAt >= 5 * 60_000) {
        await this.prisma.promotionCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'PENDING', errorCode: null, errorMessage: null, recoverySuggestion: null, retryCount: { increment: 1 } } });
      } else {
        await this.prisma.promotionCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'UNKNOWN', errorCode: 'VERIFY_NOT_FOUND', errorMessage: '腾讯广告回查暂未找到该创意', recoverySuggestion: '等待至少 5 分钟后再次回查；为防重复创建，当前不会重新提交', verifiedAt: new Date(), verifyResult: { found: false } } });
      }
    } catch (error) {
      await this.prisma.promotionCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'UNKNOWN', errorCode: error instanceof TencentMarketingApiError ? error.code : 'VERIFY_FAILED', errorMessage: error instanceof Error ? error.message : '回查失败', recoverySuggestion: '稍后重新回查，禁止直接重复创建', verifiedAt: new Date() } });
      await this.submissionLog(task.id, item.id, 'VERIFY_TENCENT_CREATIVE', 'UNKNOWN', undefined, undefined, error);
    }
  }

  private async refreshTaskCounts(taskId: string) {
    const task = await this.prisma.promotionCreativeBatchTask.findUnique({ where: { id: taskId } });
    if (!task || task.status === 'CANCELLED') return;
    const grouped = await this.prisma.promotionCreativeBatchItem.groupBy({ by: ['status'], where: { taskId }, _count: { _all: true } });
    const count = (statuses: string[]) => grouped.filter((entry) => statuses.includes(entry.status)).reduce((total, entry) => total + entry._count._all, 0);
    const pending = count(['PENDING', 'VALIDATING', 'PREPARING_ASSETS', 'SUBMITTING', 'PLATFORM_ACCEPTED', 'VERIFYING']);
    const successCount = count(['SUCCEEDED']); const failedCount = count(['FAILED']); const unknownCount = count(['UNKNOWN']); const skippedCount = count(['SKIPPED']);
    const status = pending ? 'PROCESSING' : successCount === task.totalCount ? 'SUCCEEDED' : successCount ? 'PARTIAL_SUCCESS' : unknownCount ? 'UNKNOWN' : 'FAILED';
    await this.prisma.promotionCreativeBatchTask.update({ where: { id: taskId }, data: { status, successCount, failedCount, unknownCount, skippedCount, ...(pending ? {} : { completedAt: new Date() }) } });
    if (!pending) await this.audit.create({ adminUserId: task.createdByAdminId, action: status === 'PARTIAL_SUCCESS' ? 'PROMOTION_CREATIVE_BATCH_PARTIAL_SUCCESS' : 'PROMOTION_CREATIVE_BATCH_COMPLETED', resourceType: 'promotion_creative_batch_tasks', resourceId: taskId, afterJson: { status, successCount, failedCount, unknownCount, skippedCount } as Prisma.InputJsonValue, ip: task.submittedIp || undefined, userAgent: task.submittedUserAgent || undefined });
  }

  private async failItem(task: any, item: any, code: string, message: string, suggestion: string) {
    await this.prisma.promotionCreativeBatchItem.update({ where: { id: item.id }, data: { status: 'FAILED', errorCode: code, errorMessage: message.slice(0, 1000), recoverySuggestion: suggestion.slice(0, 500) } });
    await this.submissionLog(task.id, item.id, 'TENCENT_CREATIVE_REJECTED', 'FAILED', undefined, undefined, new TencentMarketingApiError(code, message));
  }

  private async assertTencentUserTokenConfigured(accountId: string) {
    const config = await this.prisma.promotionDataSyncConfig.findUnique({ where: { provider: 'TENCENT_ADS' }, select: { enabled: true, extraConfig: true } });
    const credential = await this.prisma.promotionAccountCredential.findUnique({ where: { accountId }, select: { userTokenCipher: true, userTokenExpiresAt: true } });
    const expired = Boolean(credential?.userTokenExpiresAt && credential.userTokenExpiresAt.getTime() <= Date.now());
    if (!config?.enabled || !credential?.userTokenCipher || expired) {
      throw new BusinessException(400867, expired
        ? '该账户的腾讯 User Token 已过期，请到推广账户的账户凭证重新扫码获取'
        : '该账户缺少腾讯 User Token，请到推广账户的账户凭证扫码获取并保存', 400);
    }
  }

  private async submissionLog(taskId: string, itemId: string | null, action: string, status: string, request?: unknown, response?: unknown, error?: unknown, platformRequestId?: string) {
    const apiError = error instanceof TencentMarketingApiError ? error : null;
    await this.prisma.promotionCreativeSubmissionLog.create({ data: {
      taskId, itemId, action, status, requestSummary: request ? this.redact(request) as Prisma.InputJsonValue : undefined,
      responseSummary: response ? this.redact(response) as Prisma.InputJsonValue : undefined,
      platformRequestId: platformRequestId || apiError?.requestId, errorCode: apiError?.code,
      errorMessage: error instanceof Error ? error.message.slice(0, 1000) : undefined,
    } });
  }

  private async syncAssets(account: { id: string; accountNo: string | null; project: string }, assetType?: string, page = 1, pageSize = 20, source: 'ACCOUNT' | 'BUSINESS_UNIT' = 'ACCOUNT') {
    if (!account.accountNo) throw new BusinessException(400861, '账户未填写腾讯广告账户 ID', 400);
    const types = assetType === 'MEDIA' ? ['VIDEO', 'IMAGE'] : assetType === 'COPY' ? ['TITLE'] : assetType ? [assetType] : ['TITLE', 'VIDEO', 'IMAGE', 'LANDING_PAGE', 'MARKETING', 'BRAND', 'WECHAT_CHANNELS', 'CONVERSION', 'OTHER'];
    const businessUnitKey = this.tencentAccountScopeKey(String(account.accountNo));
    const organizationId = source === 'BUSINESS_UNIT' ? await this.tencentBusinessUnitId(account.accountNo) : null;
    const platformScope = organizationId ? { organization_id: this.safeInteger(organizationId, '腾讯业务单元 ID') } : {};
    const authorizedBrands = source === 'ACCOUNT' && types.includes('BRAND')
      ? await this.authorizedBrandAccounts(account.accountNo)
      : { channels: new Map<string, PlatformRecord>(), officials: new Map<string, PlatformRecord>() };
    const upsert = async (asset: { id: string; kind: 'COMPONENT' | 'VIDEO' | 'IMAGE' | 'REFERENCE'; type: AssetFamily; field?: string; name: string; preview?: string | null; status?: string | null; auditStatus?: string | null; payload: Record<string, unknown>; createdTime?: unknown; deleted?: boolean }) => {
      const existing = await this.prisma.promotionCreativeMaterialSnapshot.findUnique({ where: { originAccountId_platformAssetKind_platformAssetId: { originAccountId: account.id, platformAssetKind: asset.kind, platformAssetId: asset.id } }, select: { payloadJson: true } });
      const existingPayload = existing?.payloadJson && typeof existing.payloadJson === 'object' ? existing.payloadJson as PlatformRecord : {};
      const platformAssetScopes = [...new Set([...(Array.isArray(existingPayload.platformAssetScopes) ? existingPayload.platformAssetScopes.map(String) : []), source])];
      const scopedPayload = { ...asset.payload, platformAssetScopes, platformOrganizationId: organizationId || asset.payload.platformOrganizationId || null };
      await this.prisma.promotionCreativeMaterialSnapshot.upsert({
        where: { originAccountId_platformAssetKind_platformAssetId: { originAccountId: account.id, platformAssetKind: asset.kind, platformAssetId: asset.id } },
        create: { originAccountId: account.id, businessUnitKey, platformAssetId: asset.id, platformAssetKind: asset.kind, assetType: asset.type, componentField: asset.field, name: asset.name.slice(0, 255), previewUrl: asset.preview?.slice(0, 1000), status: asset.status?.slice(0, 100), auditStatus: asset.auditStatus?.slice(0, 100), payloadJson: scopedPayload as Prisma.InputJsonValue, isDeleted: Boolean(asset.deleted), platformCreatedAt: this.platformTime(asset.createdTime) },
        update: { businessUnitKey, assetType: asset.type, componentField: asset.field, name: asset.name.slice(0, 255), previewUrl: asset.preview?.slice(0, 1000), status: asset.status?.slice(0, 100), auditStatus: asset.auditStatus?.slice(0, 100), payloadJson: scopedPayload as Prisma.InputJsonValue, isDeleted: Boolean(asset.deleted), platformCreatedAt: this.platformTime(asset.createdTime), lastSyncedAt: new Date() },
      });
    };
    if (types.some((type) => ['TITLE', 'COPY', 'LANDING_PAGE', 'MARKETING', 'BRAND', 'WECHAT_CHANNELS', 'CONVERSION', 'OTHER', 'ACTION_BUTTON', 'MINI_CARD_LINK', 'TEXT_LINK', 'FLOATING_ZONE', 'LABEL', 'SOCIAL_SKILL', 'IMAGE', 'VIDEO'].includes(type))) {
      const rows = await this.tencentAssetRows('/components/get', account.accountNo, {
        ...platformScope, fields: COMPONENT_FIELDS, is_deleted: false,
      }, !organizationId, pageSize);
      for (const row of rows) {
        const value = row.component_value && typeof row.component_value === 'object' ? row.component_value : {};
        const sourceField = Object.keys(value).find((key) => CREATIVE_COMPONENT_FIELDS.has(key));
        if (!sourceField) continue;
        const field = this.canonicalCreativeComponentField(sourceField);
        const family = this.assetFamily(field);
        if (!this.requestedAssetMatches(assetType, family, field)) continue;
        const brand = family === 'BRAND' ? this.brandAuthorization(value[sourceField], authorizedBrands) : null;
        await upsert({ id: String(row.component_id), kind: 'COMPONENT', type: family, field, name: this.componentName(row, field, value[sourceField]), preview: brand?.icon, status: row.disable_message ? 'DISABLED' : row.first_publication_status || 'AVAILABLE', auditStatus: row.potential_status || row.similarity_status || null, payload: { kind: 'COMPONENT', componentField: field, component: value[sourceField], componentSubType: row.component_sub_type, platformOwnerAccountId: row.account_id ? String(row.account_id) : account.accountNo, platformOrganizationId: row.organization_id ? String(row.organization_id) : null, ...(brand ? { authorizedAccount: brand.account } : {}) }, createdTime: row.created_time, deleted: row.is_deleted });
      }
    }
    if (types.includes('VIDEO')) {
      const rows = await this.tencentAssetRows('/videos/get', account.accountNo, platformScope, !organizationId, pageSize);
      for (const row of rows) await upsert({ id: String(row.video_id), kind: 'VIDEO', type: 'VIDEO', field: 'video', name: String(row.description || `视频 ${row.video_id}`), preview: row.preview_url || row.key_frame_image_url, status: row.system_status || row.status, auditStatus: row.status, payload: { kind: 'VIDEO', componentField: 'video', platformOwnerAccountId: row.account_id ? String(row.account_id) : account.accountNo, platformOrganizationId: row.organization_id ? String(row.organization_id) : null, width: Number(row.width) || null, height: Number(row.height) || null, fileSize: Number(row.file_size) || null, component: { value: { video_id: String(row.video_id), ...(row.cover_id ? { cover_id: String(row.cover_id) } : {}) } } }, createdTime: row.created_time });
    }
    if (types.includes('IMAGE')) {
      const rows = await this.tencentAssetRows('/images/get', account.accountNo, platformScope, !organizationId, pageSize);
      for (const row of rows) await upsert({ id: String(row.image_id), kind: 'IMAGE', type: 'IMAGE', field: 'image', name: String(row.description || `图片 ${row.image_id}`), preview: row.preview_url, status: row.status, auditStatus: row.similarity_status, payload: { kind: 'IMAGE', componentField: 'image', platformOwnerAccountId: row.account_id ? String(row.account_id) : account.accountNo, platformOrganizationId: row.organization_id ? String(row.organization_id) : null, width: Number(row.width) || null, height: Number(row.height) || null, fileSize: Number(row.file_size) || null, component: { value: { image_id: String(row.image_id), ...(row.preview_url ? { image_url: row.preview_url } : {}) } } }, createdTime: row.created_time });
    }
    if (source === 'ACCOUNT' && types.includes('LANDING_PAGE')) {
      const response = await this.sync.tencentApi('GET', '/official_landing_page_list/get', account.accountNo, {
        fields: JSON.stringify(['page_id', 'landing_page_id', 'page_name', 'page_title', 'page_type', 'page_status', 'reject_reason']),
        page, page_size: Math.min(pageSize, 100),
      });
      for (const row of this.rows(response.data)) {
        if (!row.page_id) continue;
        const approved = row.page_status === 'LANDING_PAGE_STATUS_APPROVED';
        await upsert({
          id: String(row.page_id), kind: 'REFERENCE', type: 'LANDING_PAGE', field: 'main_jump_info',
          name: String(row.page_name || row.page_title || `落地页 ${row.page_id}`),
          status: row.page_status, auditStatus: approved ? 'APPROVED' : row.reject_reason || row.page_status,
          payload: approved ? {
            kind: 'COMPONENT', componentField: 'main_jump_info',
            component: { value: {
              page_type: 'PAGE_TYPE_OFFICIAL',
              page_spec: { official_spec: { page_id: this.safeInteger(String(row.page_id), '落地页 ID') } },
              jumpinfo_account_id: this.safeInteger(String(account.accountNo), '落地页所属账户 ID'),
              platform_type: 'ALL',
            } },
            sourcePageType: row.page_type, landingPageId: row.landing_page_id ? String(row.landing_page_id) : null, platformOwnerAccountId: account.accountNo,
          } : { kind: 'REFERENCE', raw: this.safePlatformRecord(row), reason: `落地页状态为 ${row.page_status || '未知'}，仅审核通过的落地页可投放` },
          deleted: row.page_status === 'LANDING_PAGE_STATUS_OFFLINE',
        });
      }
    }
  }

  private async tencentBusinessUnitId(accountNo: string) {
    const response = await this.sync.tencentApi('POST', '/business_unit_account/get', accountNo, {
      account_id_list: [this.safeInteger(accountNo, '腾讯广告账户 ID')],
    }, false);
    const rows = this.rows(response.data);
    const match = rows.find((row) => String(row.account_id || '') === String(accountNo)) || rows[0];
    const organizationId = match?.organization_id;
    if (!organizationId) throw new BusinessException(400872, '腾讯后台未返回该账户所属的业务单元，无法拉取业务单元图片、视频和文案', 400);
    return String(organizationId);
  }

  private async tencentAssetRows(path: '/components/get' | '/videos/get' | '/images/get', accountNo: string, input: Record<string, unknown>, injectAccountId: boolean, requestedPageSize: number) {
    const pageSize = Math.min(Math.max(1, requestedPageSize), 100);
    const rows: PlatformRecord[] = [];
    for (let page = 1; page <= 50; page += 1) {
      const response = await this.sync.tencentApi('GET', path, accountNo, { ...input, page, page_size: pageSize }, injectAccountId);
      const current = this.rows(response.data);
      rows.push(...current);
      const totalPage = Number((response.data as any)?.page_info?.total_page || 0);
      if (!current.length || (totalPage > 0 ? page >= totalPage : current.length < pageSize)) break;
    }
    return rows;
  }

  private async authorizedBrandAccounts(accountNo: string) {
    const channels = new Map<string, PlatformRecord>();
    const officials = new Map<string, PlatformRecord>();
    try {
      const channelResponse = await this.sync.tencentApi('GET', '/wechat_channels_accounts/get', accountNo, {
        fields: JSON.stringify(['wechat_channels_account_id', 'wechat_channels_account_name', 'wechat_channels_account_icon', 'authorization_status', 'authorization_type', 'authorization_scope', 'is_disable', 'disable_message']),
        page: 1, page_size: 100,
      });
      for (const row of this.rows(channelResponse.data)) channels.set(String(row.wechat_channels_account_id || ''), row);
    } catch (error) {
      this.logger.warn(`读取腾讯已授权视频号失败，品牌形象仍按组件数据展示: ${error instanceof Error ? error.message : 'unknown'}`);
    }
    return { channels, officials };
  }

  private brandAuthorization(component: unknown, authorized: { channels: Map<string, PlatformRecord>; officials: Map<string, PlatformRecord> }) {
    const value = component && typeof component === 'object' ? (component as PlatformRecord).value : null;
    const channel = value?.jump_info?.page_spec?.wechat_channels_profile_spec;
    if (channel) {
      const id = String(channel.wechat_channels_account_id || '');
      const account = authorized.channels.get(id) || {};
      const display = String(account.wechat_channels_account_name || '').trim();
      return { label: `视频号 · ${display || this.maskPlatformId(id) || '已授权账号'}`, icon: account.wechat_channels_account_icon || null, account: { type: 'WECHAT_CHANNELS', id, name: display || null, authorizationStatus: account.authorization_status || null } };
    }
    const official = value?.jump_info?.page_spec?.wechat_official_account_detail_spec;
    if (official) {
      const id = String(official.wechat_official_account_id || official.app_id || '');
      const account = authorized.officials.get(id) || {};
      const display = String(account.wechat_official_account_name || '').trim();
      return { label: `公众号 · ${display || this.maskPlatformId(id) || '已授权账号'}`, icon: account.wechat_official_account_icon || null, account: { type: 'WECHAT_OFFICIAL', id, name: display || null } };
    }
    return null;
  }

  private maskPlatformId(value: string) { return value ? `****${value.slice(-4)}` : ''; }

  private templateRequirements(detail: PlatformRecord) {
    const elements = Array.isArray(detail.creative_components)
      ? detail.creative_components
      : Array.isArray(detail.creative_permissions?.creative_components)
        ? detail.creative_permissions.creative_components
        : [];
    return elements.map((item: PlatformRecord) => {
      const valid = item.valid && typeof item.valid === 'object' ? item.valid as PlatformRecord : {};
      const required = Boolean(item.required ?? valid.required);
      const subtypeOptions = Array.isArray(item.component_sub_type_options) ? item.component_sub_type_options : [];
      const nestedLists = subtypeOptions.flatMap((option: PlatformRecord) => {
        const valueFields = Array.isArray(option.value_field) ? option.value_field : [];
        return valueFields.filter((field: PlatformRecord) => field.name === 'list').map((field: PlatformRecord) => {
          const listValid = field.valid && typeof field.valid === 'object' ? field.valid as PlatformRecord : {};
          const structures = Array.isArray(field.structure) ? field.structure : [];
          const imageField = structures.find((structure: PlatformRecord) => structure.name === 'image_id');
          const imageValid = imageField?.valid && typeof imageField.valid === 'object' ? imageField.valid as PlatformRecord : {};
          return {
            componentSubType: option.component_sub_type || null,
            min: Number(listValid.min_occurs ?? 0), max: Number(listValid.max_occurs ?? 0),
            width: Number(imageValid.width || 0), height: Number(imageValid.height || 0),
          };
        });
      });
      const nestedMins = nestedLists.map((rule) => rule.min).filter((value) => value > 0);
      const nestedMaxes = nestedLists.map((rule) => rule.max).filter((value) => value > 0);
      return ({
      name: item.name || String(item.path || '').split('.').pop(), path: item.path || item.name,
      required, elementType: item.element_type || item.component_type || item.type || null, fieldType: item.field_type || item.component_sub_type || null,
      min: Number(item.array_property?.min_number ?? valid.min_occurs ?? (required ? 1 : 0)),
      max: Number(item.array_property?.max_number ?? valid.max_occurs ?? 1),
      itemMin: nestedMins.length ? Math.min(...nestedMins) : null,
      itemMax: nestedMaxes.length ? Math.max(...nestedMaxes) : null,
      itemRules: nestedLists,
      description: item.description || item.desc || null, restriction: item.restriction || valid || null,
      });
    });
  }

  private templateRequirementsForContext(detail: PlatformRecord, templateId: string, dynamicType: string) {
    const requirements: Array<Record<string, any>> = this.templateRequirements(detail);
    if (dynamicType !== 'DYNAMIC_CREATIVE_TYPE_PROGRAM') return requirements;
    const ordinaryRequirements = Array.isArray(detail.__ordinaryRequirements)
      ? detail.__ordinaryRequirements as Array<Record<string, any>>
      : [];
    if (!ordinaryRequirements.length) return requirements;
    return this.alignDynamicRequiredRequirements(requirements, ordinaryRequirements, templateId);
  }

  private alignDynamicRequiredRequirements(dynamicRequirements: Array<Record<string, any>>, ordinaryRequirements: Array<Record<string, any>>, templateId = '') {
    const fieldOf = (requirement: Record<string, any>) => this.canonicalCreativeComponentField(String(requirement.path || requirement.name || '').split('.').pop() || '');
    const ordinaryByField = new Map(ordinaryRequirements.map((requirement) => [fieldOf(requirement), requirement]));
    const aligned = dynamicRequirements.map((requirement) => {
      const ordinary = ordinaryByField.get(fieldOf(requirement));
      return {
        ...requirement,
        required: Boolean(ordinary?.required),
        min: ordinary?.required ? Math.max(1, Number(ordinary.min || 1)) : 0,
        compatibilityNote: `动态创意必填项已与普通创意规格${templateId ? ` ${templateId}` : ''}对齐`,
      };
    });
    const dynamicFields = new Set(aligned.map(fieldOf));
    for (const ordinary of ordinaryRequirements) {
      const field = fieldOf(ordinary);
      if (!ordinary.required || dynamicFields.has(field)) continue;
      aligned.push({
        ...ordinary,
        required: true,
        min: Math.max(1, Number(ordinary.min || 1)),
        compatibilityNote: `动态创意必填项已与普通创意规格${templateId ? ` ${templateId}` : ''}对齐`,
      });
    }
    return aligned;
  }

  private async upgradeLegacyChannelComponents(payload: Record<string, unknown>, task: any, selectedAssets: any[], template: PlatformRecord = {}) {
    const components = payload.creative_components && typeof payload.creative_components === 'object'
      ? payload.creative_components as Record<string, unknown[]>
      : {};
    const channel = Array.isArray(components.wechat_channels) ? components.wechat_channels[0] as PlatformRecord | undefined : undefined;
    const existingBrand = Array.isArray(components.brand) ? components.brand[0] as PlatformRecord | undefined : undefined;
    const username = String(channel?.value?.username
      || existingBrand?.value?.jump_info?.page_spec?.wechat_channels_profile_spec?.username
      || '').trim();
    if (!username) return { payload, assets: [] };
    const selectedChannel = selectedAssets.find((asset) => asset.componentField === 'wechat_channels');
    const selectedBrand = selectedAssets.find((asset) => asset.componentField === 'brand');
    const candidates = await this.prisma.promotionCreativeMaterialSnapshot.findMany({
      where: { businessUnitKey: task.businessUnitKey, componentField: { in: ['brand', 'wechat_channels', 'floating_zone', 'text_link'] }, isDeleted: false },
      take: 200,
      orderBy: [{ updatedAt: 'desc' }],
    });
    const addedAssets: any[] = [];
    const nextComponents = { ...components };
    // 管理后台仅展示并选择新版 brand。腾讯部分视频号版位仍会在提交接口
    // 强制校验 wechat_channels，因此从新版品牌形象中的 username 自动匹配并
    // 补齐平台兼容字段，不再要求用户额外选择旧组件。
    if (!channel) {
      const compatibleChannel = this.matchWechatChannelComponent(
        candidates,
        username,
        selectedBrand?.originAccountId || task.accountId,
      );
      if (!compatibleChannel) throw new BusinessException(400872, '新版品牌形象缺少腾讯视频号兼容信息，请同步账户素材后重试', 400);
      this.assertAssetUsable(compatibleChannel, task.accountId, task.businessUnitKey);
      nextComponents.wechat_channels = [this.normalizeTencentAssetIds((compatibleChannel.payloadJson as PlatformRecord).component)];
      addedAssets.push(compatibleChannel);
    }
    if (!existingBrand) {
      const brandAsset = this.matchWechatChannelBrand(candidates, username, selectedChannel?.originAccountId || task.accountId);
      if (!brandAsset) throw new BusinessException(400869, '当前创意缺少新版品牌形象，且未找到与所选视频号匹配的品牌形象组件，请重新选择“品牌形象”后创建批次', 400);
      this.assertAssetUsable(brandAsset, task.accountId, task.businessUnitKey);
      nextComponents.brand = [this.normalizeTencentAssetIds((brandAsset.payloadJson as PlatformRecord).component)];
      addedAssets.push(brandAsset);
    }
    // 腾讯的视频号品牌形象也能用于大图类规格，但横版大图、常规大图
    // 并不因此需要视频版位专用的文字链和浮层卡片。只有规格本身包含
    // video/short_video/video_list 字段时才补齐这组兼容组件。
    if (!this.templateUsesVideo(template)) {
      return { payload: { ...payload, creative_components: nextComponents }, assets: addedAssets };
    }
    const landingPageId = this.officialLandingPageId(nextComponents.main_jump_info?.[0]);
    const currentTextLink = Array.isArray(nextComponents.text_link) ? nextComponents.text_link[0] : undefined;
    const currentTextLinkPageId = this.officialLandingPageId(currentTextLink);
    // 腾讯要求主落地页 page_spec/page_id 与文字链 link_page_spec/page_id 完全一致。
    // 旧逻辑只在缺少文字链时补齐，用户选中不匹配的文字链会直接触发 31050。
    // 这里从本次已选组件或账户快照中重新匹配同一 page_id，避免提交无效组合。
    if (!currentTextLink || (landingPageId && currentTextLinkPageId !== landingPageId)) {
      const textLink = this.matchPlacementComponent(selectedAssets, 'text_link', task.accountId, landingPageId)
        || this.matchPlacementComponent(candidates, 'text_link', task.accountId, landingPageId);
      if (!textLink) throw new BusinessException(400870, `视频号版位缺少与当前落地页${landingPageId ? `（page_id：${landingPageId}）` : ''}匹配的文字链组件，请同步账户组件或更换落地页后创建批次`, 400);
      this.assertAssetUsable(textLink, task.accountId, task.businessUnitKey);
      nextComponents.text_link = [this.normalizeTencentAssetIds((textLink.payloadJson as PlatformRecord).component)];
      addedAssets.push(textLink);
    }
    if (!Array.isArray(nextComponents.floating_zone) || !nextComponents.floating_zone.length) {
      const floatingZone = this.matchPlacementComponent(selectedAssets, 'floating_zone', task.accountId)
        || this.matchPlacementComponent(candidates, 'floating_zone', task.accountId);
      if (!floatingZone) throw new BusinessException(400871, '视频号版位必填浮层卡片，但当前业务单元没有可用浮层卡片，请先在腾讯后台创建后同步', 400);
      this.assertAssetUsable(floatingZone, task.accountId, task.businessUnitKey);
      nextComponents.floating_zone = [this.normalizeTencentAssetIds((floatingZone.payloadJson as PlatformRecord).component)];
      addedAssets.push(floatingZone);
    }
    return {
      payload: { ...payload, creative_components: nextComponents },
      assets: addedAssets,
    };
  }

  private matchWechatChannelBrand(candidates: any[], username: string, preferredOriginAccountId: string) {
    const matching = candidates.filter((candidate) => {
      const payload = candidate.payloadJson as PlatformRecord;
      const brandUsername = payload?.component?.value?.jump_info?.page_spec?.wechat_channels_profile_spec?.username;
      return payload?.componentSubType === 'BRAND_WECHAT_CHANNEL' && String(brandUsername || '').trim() === username;
    });
    return matching.find((candidate) => candidate.originAccountId === preferredOriginAccountId) || matching[0] || null;
  }

  private matchWechatChannelComponent(candidates: any[], username: string, preferredOriginAccountId: string) {
    const matching = candidates.filter((candidate) => {
      if (candidate.componentField !== 'wechat_channels') return false;
      const payload = candidate.payloadJson as PlatformRecord;
      return String(payload?.component?.value?.username || '').trim() === username;
    });
    return matching.find((candidate) => candidate.originAccountId === preferredOriginAccountId) || matching[0] || null;
  }

  private matchPlacementComponent(candidates: any[], field: string, preferredOriginAccountId: string, landingPageId?: string | null) {
    const matching = candidates.filter((candidate) => {
      if (this.canonicalCreativeComponentField(candidate.componentField) !== field) return false;
      if (!landingPageId) return true;
      return this.officialLandingPageId((candidate.payloadJson as PlatformRecord)?.component) === landingPageId;
    });
    return matching.find((candidate) => candidate.originAccountId === preferredOriginAccountId) || matching[0] || null;
  }

  private applyFixedComponentVariants(
    base: CreativeCombination[],
    assets: any[],
    requirements: Array<Record<string, any>>,
    mode: 'BALANCED' | 'CARTESIAN',
    limit: number,
  ) {
    if (!assets.length) return base;
    const grouped = new Map<string, any[]>();
    for (const asset of assets) {
      const payload = asset.payloadJson as PlatformRecord;
      const canonical = this.canonicalCreativeComponentField(asset.componentField || payload.componentField);
      const field = this.componentSubmissionField(canonical, requirements);
      const group = grouped.get(field) || [];
      if (!group.some((item) => item.id === asset.id)) group.push(asset);
      grouped.set(field, group);
    }
    const groups = [...grouped.values()];
    if (mode === 'BALANCED') {
      const total = Math.max(base.length, ...groups.map((group) => group.length));
      if (total > limit) throw new BusinessException(400853, `固定组件轮换预计生成 ${total} 条，超过服务端上限 ${limit} 条`, 400);
      return Array.from({ length: total }, (_, index) => ({
        ...base[index % base.length],
        otherComponentIds: groups.map((group) => group[index % group.length].id),
      }));
    }
    let variants: string[][] = [[]];
    for (const group of groups) variants = variants.flatMap((selected) => group.map((asset) => [...selected, asset.id]));
    if (base.length * variants.length > limit) throw new BusinessException(400853, `全组合预计生成 ${base.length * variants.length} 条，超过服务端上限 ${limit} 条`, 400);
    return base.flatMap((combination) => variants.map((ids) => ({ ...combination, otherComponentIds: ids })));
  }

  private officialLandingPageId(component: unknown) {
    const value = component && typeof component === 'object' ? (component as PlatformRecord).value : null;
    const pageId = value?.jump_info?.page_spec?.official_spec?.page_id ?? value?.page_spec?.official_spec?.page_id;
    return pageId === undefined || pageId === null ? null : String(pageId);
  }

  private materialSnapshotEntry(asset: any, targetAccountId: string) {
    return {
      id: asset.id, type: asset.assetType, source: asset.originAccountId === targetAccountId ? 'ACCOUNT' : 'BUSINESS_UNIT',
      referenceMode: asset.originAccountId === targetAccountId ? 'ACCOUNT_DIRECT' : 'BUSINESS_UNIT_DIRECT',
      sourceAccountId: asset.originAccountId, platformAssetId: asset.platformAssetId, name: asset.name,
    };
  }

  private validateTemplateComponents(requirements: Array<Record<string, any>>, components: Record<string, unknown[]>, dynamicType: string) {
    // Both ordinary and dynamic creatives may contain multiple core materials
    // (copy, video, image and landing page) when Tencent's selected template
    // advertises that capacity. The per-field minimum/maximum below is the
    // single source of truth; fixed components remain constrained by max=1.
    void dynamicType;
    for (const requirement of requirements) {
      const field = String(requirement.path || requirement.name || '').split('.').pop() || '';
      if (!CREATIVE_COMPONENT_FIELDS.has(field)) continue;
      const count = components[field]?.length || 0;
      if (requirement.required && count < Math.max(1, Number(requirement.min || 0))) throw new BusinessException(400857, `创意规格缺少必填组件“${requirement.description || field}”`, 400);
      if (Number.isFinite(Number(requirement.max)) && count > Number(requirement.max)) throw new BusinessException(400862, `组件“${requirement.description || field}”最多允许 ${requirement.max} 项，当前为 ${count} 项`, 400);
      if (field === 'image_list' && count) {
        const imageCount = components[field].reduce<number>((total, component) => {
          const record = component && typeof component === 'object' ? component as PlatformRecord : {};
          const value = record.value && typeof record.value === 'object' ? record.value as PlatformRecord : {};
          return total + (Array.isArray(value.list) ? value.list.length : 0);
        }, 0);
        const itemMin = Number(requirement.itemMin || 0);
        const itemMax = Number(requirement.itemMax || 0);
        if (itemMin && imageCount < itemMin) throw new BusinessException(400857, `九图规格每条创意至少需要 ${itemMin} 张图片，当前为 ${imageCount} 张`, 400);
        if (itemMax && imageCount > itemMax) throw new BusinessException(400862, `九图规格每条创意最多允许 ${itemMax} 张图片，当前为 ${imageCount} 张`, 400);
      }
    }
  }

  private validatePlacementDependencies(template: PlatformRecord, components: Record<string, unknown[]>) {
    const sites = Array.isArray(template.site_set) ? template.site_set : [];
    const channelPlacement = sites.includes('SITE_SET_CHANNELS')
      && (Boolean(components.wechat_channels?.length)
        || (components.brand || []).some((component: any) => component?.value?.jump_info?.page_type === 'PAGE_TYPE_WECHAT_CHANNELS_PROFILE'));
    if (!channelPlacement || !this.templateUsesVideo(template)) return;
    if (!components.text_link?.length) throw new BusinessException(400870, '视频号版位需填写营销组件中的文字链', 400);
    if (!components.floating_zone?.length) throw new BusinessException(400871, '视频号版位必填营销组件中的浮层卡片', 400);
    const landingPageId = this.officialLandingPageId(components.main_jump_info?.[0]);
    const mismatchedTextLink = components.text_link.find((component) => {
      const textLinkPageId = this.officialLandingPageId(component);
      return landingPageId && textLinkPageId && textLinkPageId !== landingPageId;
    });
    if (mismatchedTextLink) throw new BusinessException(400874, `文字链落地页必须与主落地页一致（当前主落地页 page_id：${landingPageId}）`, 400);
  }

  private templateUsesVideo(template: PlatformRecord) {
    return this.templateRequirements(template).some((requirement: Record<string, any>) => {
      const field = String(requirement.path || requirement.name || '').split('.').pop() || '';
      return ['video', 'video_list', 'short_video', 'app_promotion_video', 'video_showcase'].includes(field);
    });
  }

  private assertDynamicSupport(detail: PlatformRecord, dynamicType: string) {
    if (dynamicType !== 'DYNAMIC_CREATIVE_TYPE_PROGRAM') return;
    const supported = detail.support_dynamic_ability_spec_list?.dynamic_ability_type;
    if (!Array.isArray(supported) || !supported.length) throw new BusinessException(400863, '该腾讯创意规格未返回动态素材能力，不能创建多素材动态创意', 400);
  }

  private assertAssetUsable(asset: any, targetAccountId: string, businessUnitKey: string) {
    if (asset.businessUnitKey !== businessUnitKey) throw new BusinessException(403853, `素材“${asset.name}”不属于目标业务单元`, 403);
    const payload = asset.payloadJson as Record<string, unknown>;
    if (this.canonicalCreativeComponentField(asset.componentField) === 'brand') {
      const authorizedType = String((payload.authorizedAccount as Record<string, unknown> | undefined)?.type || '');
      if (payload.componentSubType !== 'BRAND_WECHAT_CHANNEL' && authorizedType !== 'WECHAT_CHANNELS') throw new BusinessException(400873, `品牌形象“${asset.name}”不是已授权的视频号品牌组件，已拒绝使用`, 400);
    }
    if (asset.isDeleted || payload.kind === 'REFERENCE' || /reject|invalid|delete|offline|disabled|fail/i.test(`${asset.status || ''} ${asset.auditStatus || ''}`)) throw new BusinessException(400865, `素材“${asset.name}”已失效、删除、审核未通过或缺少可提交结构`, 400);
    // Same-business-unit materials are submitted with their existing Tencent
    // asset/component IDs. They are never copied or uploaded to targetAccountId.
    void targetAccountId;
  }

  private async adgroup(account: { accountNo: string | null }, adgroupId: string, requireUsable: boolean) {
    if (!account.accountNo) throw new BusinessException(400861, '账户未填写腾讯广告账户 ID', 400);
    const response = await this.sync.tencentApi('GET', '/adgroups/get', account.accountNo, {
      fields: ADGROUP_FIELDS,
      filtering: JSON.stringify([{ field: 'adgroup_id', operator: 'EQUALS', values: [adgroupId] }]),
      page: 1, page_size: 10, is_deleted: false,
    });
    const row = this.rows(response.data).find((item) => String(item.adgroup_id || '') === adgroupId);
    if (!row) throw new BusinessException(404851, '营销单元不存在、已删除或不属于目标账户', 404);
    if (requireUsable && !this.adgroupUsable(row)) throw new BusinessException(400866, this.adgroupUnavailableReason(row), 400);
    return row;
  }

  private adgroupUsable(row: PlatformRecord) {
    if (row.is_deleted || (row.configured_status && row.configured_status !== 'AD_STATUS_NORMAL')) return false;
    if (!row.configured_status && !row.system_status) return false;
    return !/DELETED|FROZEN|STOP|VIOLATION|CLOSED|REMOVED|INVALID/i.test(String(row.system_status || ''));
  }

  private adgroupUnavailableReason(row: PlatformRecord) {
    if (row.is_deleted) return '营销单元已删除';
    if (row.configured_status === 'AD_STATUS_SUSPEND') return '营销单元已暂停，不能提交新创意';
    if (!row.configured_status && !row.system_status) return '腾讯接口未返回营销单元状态，请刷新后重试';
    return `营销单元当前不可创建创意（${row.system_status || '未知状态'}）`;
  }

  private async account(id: string, user: AdminCurrentUser, capability: PromotionAccountCapability = 'CREATIVES') {
    const scope = this.promotionAccess ? await this.promotionAccess.where(user, capability) as Prisma.PromotionAccountWhereInput : await this.accountScope(user);
    const account = await this.prisma.promotionAccount.findFirst({ where: { AND: [scope, { id, status: ContentStatus.ACTIVE, platform: { contains: '腾讯' } }] } });
    if (!account) throw new BusinessException(403851, '腾讯广告账户不存在、已停用或超出当前数据范围', 403);
    if (!account.accountNo) throw new BusinessException(400861, '账户未填写腾讯广告账户 ID', 400);
    return account;
  }

  private async currentUser(id: string): Promise<AdminCurrentUser> {
    const row = await this.prisma.adminUser.findUnique({ where: { id }, include: { customRole: true } });
    if (!row || row.status !== 'ACTIVE' || row.deletedAt) throw new BusinessException(403905, '任务创建人已停用或删除，创意任务已停止', 403);
    const permissionsRaw = row.customRole?.permissionsJson ?? row.permissionsJson;
    const scopeMembersRaw = row.customRole?.dataScopeMemberIds ?? row.dataScopeMemberIds;
    return {
      adminUserId: row.id, username: row.username, role: row.role,
      permissions: Array.isArray(permissionsRaw) ? permissionsRaw.filter((value): value is string => typeof value === 'string') : [],
      dataScope: row.role === 'SUPER_ADMIN' ? 'ALL' : row.customRole?.dataScope ?? row.dataScope,
      dataScopeMemberIds: Array.isArray(scopeMembersRaw) ? scopeMembersRaw.filter((value): value is string => typeof value === 'string') : [],
      teamId: row.teamId,
    };
  }

  private async taskOrThrow(id: string, user: AdminCurrentUser) {
    const task = await this.prisma.promotionCreativeBatchTask.findFirst({ where: { id, account: await this.accountScope(user) } });
    if (!task) throw new BusinessException(404852, '批量创意任务不存在或超出当前数据范围', 404);
    return task;
  }

  private async accountScope(user: AdminCurrentUser): Promise<Prisma.PromotionAccountWhereInput> {
    if (this.promotionAccess) return await this.promotionAccess.where(user, 'CREATIVES') as Prisma.PromotionAccountWhereInput;
    return await this.dataScopes.ownershipWhere(user, 'ownerAdminId', 'createdByAdminId') as Prisma.PromotionAccountWhereInput;
  }

  private has(user: AdminCurrentUser, permission: string) { return user.role === 'SUPER_ADMIN' || user.permissions.includes(permission) || user.permissions.includes('PROMOTION_MANAGE'); }
  private assertPermission(user: AdminCurrentUser, permission: string) { if (!this.has(user, permission)) throw new BusinessException(403852, `缺少权限：${permission}`, 403); }
  private businessUnitKey(project: string) { return `TENCENT_ADS:${project}`; }
  private tencentAccountScopeKey(accountNo: string) { return `TENCENT_ACCOUNT:${accountNo}`; }
  private assetQueryScope(assetType?: string): Prisma.PromotionCreativeMaterialSnapshotWhereInput {
    const fields: Record<string, string[]> = {
      COPY: ['title', 'description'], BRAND: ['brand', 'channels_brand'],
      ACTION_BUTTON: ['action_button', 'chosen_button'], MINI_CARD_LINK: ['mini_card_link'], TEXT_LINK: ['text_link'],
      FLOATING_ZONE: ['floating_zone', 'floating_zone_list'], LABEL: ['label'], SOCIAL_SKILL: ['social_skill'],
      LANDING_PAGE: ['main_jump_info', 'jump_info', 'end_page'],
    };
    if (assetType === 'MEDIA') return { assetType: { in: ['VIDEO', 'IMAGE'] } };
    if (assetType && fields[assetType]) return { componentField: { in: fields[assetType] } };
    return {};
  }
  private canonicalCreativeComponentField(field: unknown) {
    const value = String(field || '');
    return ({
      jump_info: 'main_jump_info',
      floating_zone_list: 'floating_zone',
    } as Record<string, string>)[value] || value;
  }
  private componentSubmissionField(field: string, requirements: Array<Record<string, any>>) {
    const requiredFields = new Set(requirements.map((item) => String(item.path || item.name || '').split('.').pop()).filter(Boolean));
    if (field === 'video' && requiredFields.has('short_video') && !requiredFields.has('video')) return 'short_video';
    if (field === 'image' && requiredFields.has('image_list') && !requiredFields.has('image')) return 'image_list';
    return field;
  }
  private componentSubmissionValue(field: string, component: unknown) {
    if (field === 'video' && component && typeof component === 'object') {
      const record = component as PlatformRecord;
      const value = record.value && typeof record.value === 'object' ? record.value as PlatformRecord : {};
      return {
        ...(record.component_id ? { component_id: record.component_id } : {}),
        value: { ...(value.video_id ? { video_id: value.video_id } : {}) },
      };
    }
    if (field !== 'image_list' || !component || typeof component !== 'object') return component;
    const record = component as PlatformRecord;
    const value = record.value && typeof record.value === 'object' ? record.value as PlatformRecord : {};
    if (Array.isArray(value.list)) {
      return {
        ...(record.component_id ? { component_id: record.component_id } : {}),
        value: { ...value, list: value.list.map((item) => this.normalizeTencentAssetIds(item)) },
      };
    }
    return {
      ...(record.component_id ? { component_id: record.component_id } : {}),
      value: { list: [{ ...(value.image_id ? { image_id: value.image_id } : {}), ...(value.image_url ? { image_url: value.image_url } : {}) }] },
    };
  }
  private aggregateImageListComponents(components: Record<string, unknown[]>) {
    const imageLists = components.image_list;
    if (!Array.isArray(imageLists) || imageLists.length < 2) return;
    const itemCounts = imageLists.map((component) => {
      const record = component && typeof component === 'object' ? component as PlatformRecord : {};
      const value = record.value && typeof record.value === 'object' ? record.value as PlatformRecord : {};
      return Array.isArray(value.list) ? value.list.length : 0;
    });
    if (itemCounts.some((count) => count > 1)) {
      throw new BusinessException(400875, '每条创意只能使用一个腾讯九图组件，且不能与单张图片混合提交', 400);
    }
    const list = imageLists.flatMap((component) => {
      const record = component && typeof component === 'object' ? component as PlatformRecord : {};
      const value = record.value && typeof record.value === 'object' ? record.value as PlatformRecord : {};
      return Array.isArray(value.list) ? value.list : [];
    });
    components.image_list = [{ value: { list } }];
  }
  private assetMatchesTemplateDimensions(asset: any, submissionField: string, requirements: Array<Record<string, any>>) {
    if (submissionField !== 'image_list') return true;
    const requirement = requirements.find((item) => String(item.path || item.name || '').split('.').pop() === 'image_list');
    const bundledCount = this.imageListItemCount(asset.payloadJson);
    if (bundledCount > 1) {
      const itemMin = Number(requirement?.itemMin || 0);
      const itemMax = Number(requirement?.itemMax || 0);
      if (itemMin && bundledCount < itemMin) return false;
      if (itemMax && bundledCount > itemMax) return false;
      const payload = asset.payloadJson as PlatformRecord;
      const subtype = String(payload.componentSubType || '');
      const supportedSubtypes = new Set((Array.isArray(requirement?.itemRules) ? requirement.itemRules : [])
        .map((rule: any) => String(rule.componentSubType || '')).filter(Boolean));
      return !supportedSubtypes.size || !subtype || supportedSubtypes.has(subtype);
    }
    const rules = Array.isArray(requirement?.itemRules) ? requirement.itemRules : [];
    const allowed = rules.filter((rule: any) => Number(rule.width) > 0 && Number(rule.height) > 0);
    if (!allowed.length) return true;
    const payload = asset.payloadJson as Record<string, unknown>;
    const width = Number(payload.width || 0); const height = Number(payload.height || 0);
    return allowed.some((rule: any) => width === Number(rule.width) && height === Number(rule.height));
  }
  private imageListItemCount(payloadJson: unknown) {
    const payload = payloadJson && typeof payloadJson === 'object' ? payloadJson as PlatformRecord : {};
    const component = payload.component && typeof payload.component === 'object' ? payload.component as PlatformRecord : {};
    const value = component.value && typeof component.value === 'object' ? component.value as PlatformRecord : {};
    return Array.isArray(value.list) ? value.list.length : 0;
  }
  private requestedAssetMatches(assetType: string | undefined, family: AssetFamily, field: string) {
    if (!assetType) return true;
    if (assetType === 'MEDIA') return family === 'VIDEO' || family === 'IMAGE';
    if (assetType === 'COPY') return family === 'TITLE';
    if (assetType === 'LANDING_PAGE') return family === 'LANDING_PAGE';
    if (assetType === 'BRAND') return family === 'BRAND' || family === 'WECHAT_CHANNELS';
    const fields = (this.assetQueryScope(assetType).componentField as { in?: string[] } | undefined)?.in || [];
    return fields.includes(field) || fields.includes(field === 'floating_zone' ? 'floating_zone_list' : field);
  }
  private async assetSpendWindows(accountNo: string) {
    const date = (daysAgo: number) => {
      const value = new Date(Date.now() - daysAgo * 86_400_000);
      return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(value);
    };
    const toMap = (items: Array<{ id: string; metrics?: { spend: number } | null }>) => new Map(items.map((item) => [String(item.id), Number(item.metrics?.spend || 0)]));
    try {
      const [seven, fifteen] = await Promise.all([
        this.sync.fetchMaterialAnalysis('TENCENT_ADS', accountNo, date(6), date(0)),
        this.sync.fetchMaterialAnalysis('TENCENT_ADS', accountNo, date(14), date(0)),
      ]);
      return { seven: toMap(seven.items), fifteen: toMap(fifteen.items), available: true };
    } catch (error) {
      this.logger.warn(`读取腾讯素材近7/15天消费失败: ${error instanceof Error ? error.message : 'unknown'}`);
      return { seven: new Map<string, number>(), fifteen: new Map<string, number>(), available: false };
    }
  }
  private async componentSpendWindows(accountNo: string, organizationId: string) {
    const date = (daysAgo: number) => {
      const value = new Date(Date.now() - daysAgo * 86_400_000);
      return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(value);
    };
    const fetch = async (daysAgo: number) => {
      const result = new Map<string, number>();
      for (let page = 1; page <= 50; page += 1) {
        const response = await this.sync.tencentApi('GET', '/daily_reports/get', accountNo, {
          organization_id: this.safeInteger(organizationId, '腾讯业务单元 ID'),
          level: 'REPORT_LEVEL_COMPONENT',
          date_range: JSON.stringify({ start_date: date(daysAgo), end_date: date(0) }),
          group_by: JSON.stringify(['component_id']),
          fields: JSON.stringify(['component_id', 'component_type', 'cost']),
          page,
          page_size: 100,
        }, false);
        const rows = this.rows(response.data);
        for (const row of rows) {
          const dimensions = row.dimensions && typeof row.dimensions === 'object' ? row.dimensions as PlatformRecord : {};
          const metrics = row.metrics && typeof row.metrics === 'object' ? row.metrics as PlatformRecord : {};
          const componentId = row.component_id ?? dimensions.component_id;
          if (componentId === undefined || componentId === null) continue;
          const spend = Number(row.cost ?? metrics.cost ?? 0) / 100;
          const key = String(componentId);
          result.set(key, (result.get(key) || 0) + spend);
        }
        const totalPage = Number((response.data as PlatformRecord)?.page_info?.total_page || 0);
        if (!rows.length || (totalPage > 0 ? page >= totalPage : rows.length < 100)) break;
      }
      return result;
    };
    try {
      const [seven, fifteen] = await Promise.all([fetch(6), fetch(14)]);
      return { seven, fifteen, available: true };
    } catch (error) {
      this.logger.warn(`读取腾讯文案组件近7/15天消费失败: ${error instanceof Error ? error.message : 'unknown'}`);
      return { seven: new Map<string, number>(), fifteen: new Map<string, number>(), available: false };
    }
  }
  private async maxBatchSize() { const config = await this.prisma.systemConfig.findUnique({ where: { key: 'promotionCreativeBatchMax' } }); const value = Number((config?.valueJson as any)?.value || 50); return Math.min(100, Math.max(1, Number.isFinite(value) ? Math.round(value) : 50)); }
  private async hasFreshAssetSnapshots(accountId: string, assetType: string | undefined, source: 'ACCOUNT' | 'BUSINESS_UNIT') {
    const rows = await this.prisma.promotionCreativeMaterialSnapshot.findMany({
      where: {
        originAccountId: accountId,
        isDeleted: false,
        ...this.assetQueryScope(assetType),
        lastSyncedAt: { gte: new Date(Date.now() - 60_000) },
      },
      select: { assetType: true, payloadJson: true },
      take: 1000,
    });
    const inScope = (row: { payloadJson: Prisma.JsonValue }) => {
      const payload = row.payloadJson && typeof row.payloadJson === 'object' ? row.payloadJson as PlatformRecord : {};
      return Array.isArray(payload.platformAssetScopes) && payload.platformAssetScopes.map(String).includes(source);
    };
    if (assetType === 'MEDIA') {
      return ['IMAGE', 'VIDEO'].every((mediaType) => rows.some((row) => {
        if (row.assetType !== mediaType || !inScope(row)) return false;
        const payload = row.payloadJson as PlatformRecord;
        return Number(payload.width) > 0 && Number(payload.height) > 0;
      }));
    }
    return rows.some(inScope);
  }
  private rows(data: any): PlatformRecord[] { const rows = data?.list || data?.items || data?.data || []; return Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : []; }
  private pageInfo(data: any, page: number, pageSize: number) { const info = data?.page_info || {}; return { page: Number(info.page || page), pageSize: Number(info.page_size || pageSize), totalNumber: Number(info.total_number || 0), totalPage: Number(info.total_page || 0) }; }
  private platformTime(value: unknown) { const numeric = Number(value); if (!numeric) return null; return new Date(numeric > 1e12 ? numeric : numeric * 1000); }
  private safeInteger(value: string, label: string) { const numeric = Number(value); if (!Number.isSafeInteger(numeric) || numeric <= 0) throw new BusinessException(400867, `${label}超出当前 JavaScript SDK 安全整数范围，已拒绝提交以避免 ID 精度丢失`, 400); return numeric; }
  private normalizeTencentCreativePayload(payload: Record<string, unknown>) {
    return {
      ...payload,
      ...(payload.creative_components && typeof payload.creative_components === 'object'
        ? { creative_components: this.normalizeTencentAssetIds(payload.creative_components) }
        : {}),
    };
  }
  private normalizeTencentAssetIds(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.normalizeTencentAssetIds(item));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (['video_id', 'cover_id', 'image_id'].includes(key) && (typeof item === 'number' || typeof item === 'string')) return [key, String(item)];
      if (['video_id_list', 'image_id_list'].includes(key) && Array.isArray(item)) return [key, item.map((id) => String(id))];
      return [key, this.normalizeTencentAssetIds(item)];
    }));
  }
  private safePlatformRecord(row: PlatformRecord) { return this.redact(row) as Record<string, unknown>; }
  private platformComponentsMatch(expected: Record<string, any>, actual: Record<string, any>) {
    const contains = (requested: unknown, returned: unknown): boolean => {
      if (Array.isArray(requested)) {
        if (!Array.isArray(returned) || requested.length > returned.length) return false;
        const remaining = [...returned];
        return requested.every((entry) => {
          const index = remaining.findIndex((candidate) => contains(entry, candidate));
          if (index < 0) return false;
          remaining.splice(index, 1);
          return true;
        });
      }
      if (requested && typeof requested === 'object') {
        if (!returned || typeof returned !== 'object') return false;
        return Object.entries(requested as Record<string, unknown>)
          .filter(([key]) => !['component_id', 'is_deleted'].includes(key))
          .every(([key, value]) => Object.prototype.hasOwnProperty.call(returned, key)
            && contains(value, (returned as Record<string, unknown>)[key]));
      }
      return String(returned) === String(requested);
    };
    return Object.entries(expected).every(([field, requested]) => {
      const expectedItems = Array.isArray(requested) ? requested : [];
      const actualItems = Array.isArray(actual[field]) ? actual[field] : [];
      if (expectedItems.length !== actualItems.length) return false;
      // Tencent normalizes landing-page components on creation and omits
      // submission-only metadata such as platform_type and
      // jumpinfo_account_id. The stable identity is page type + official page
      // ID, so compare those instead of leaving successful creatives UNKNOWN.
      if (field === 'main_jump_info') {
        const identity = (entry: any) => ({
          pageType: String(entry?.value?.page_type || ''),
          pageId: this.officialLandingPageId(entry),
        });
        const remainingIdentities = actualItems.map(identity);
        return expectedItems.every((entry: any) => {
          const expectedIdentity = identity(entry);
          const index = remainingIdentities.findIndex((candidate) => candidate.pageType === expectedIdentity.pageType
            && candidate.pageId === expectedIdentity.pageId);
          if (index < 0) return false;
          remainingIdentities.splice(index, 1);
          return true;
        });
      }
      const remaining = [...actualItems];
      return expectedItems.every((entry: any) => {
        const index = remaining.findIndex((candidate: any) => entry?.component_id
          ? String(candidate?.component_id || '') === String(entry.component_id)
          : contains(entry?.value ?? entry, candidate?.value ?? candidate));
        if (index < 0) return false;
        remaining.splice(index, 1);
        return true;
      });
    });
  }
  private hash(value: unknown) { return createHash('sha256').update(this.stableJson(value)).digest('hex'); }
  private stableJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stableJson(item)).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${this.stableJson(item)}`).join(',')}}`;
    return JSON.stringify(value);
  }
  private creativeName(pattern: string, sequence: number, assets: Array<{ assetType: string; name: string }> = [], accountName = '') {
    const suffix = String(sequence).padStart(3, '0');
    const names = (...types: string[]) => assets.filter((asset) => types.includes(asset.assetType)).map((asset) => asset.name).filter(Boolean).join('+');
    const tokens: Record<string, string> = {
      '{账户}': accountName,
      '{标题}': names('TITLE'),
      '{视频}': names('VIDEO'),
      '{图片}': names('IMAGE'),
      '{品牌形象}': names('BRAND'),
      '{营销组件}': names('MARKETING', 'CONVERSION'),
      '{落地页}': names('LANDING_PAGE'),
      '{日期}': new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date()),
      '{序号}': suffix,
    };
    // 同时兼容旧前端或直接接口传入的连续通配符，确保生成名称可读。
    let value = pattern.replace(/}\s*{/g, '}+{');
    for (const [token, replacement] of Object.entries(tokens)) value = value.replaceAll(token, replacement);
    if (!pattern.includes('{序号}')) value = `${value}+${suffix}`;
    return value.replace(/\+{2,}/g, '+').replace(/^[+\s]+|[+\s]+$/g, '').slice(0, 255);
  }
  private sortSelection(selection: PromotionCreativeBatchRequestDto['materials']) { return Object.fromEntries(Object.entries(selection).map(([key, values]) => [key, [...new Set(values)].sort()])); }
  private assetFamily(field: string): AssetFamily {
    if (field === 'title' || field === 'description') return 'TITLE';
    if (field === 'brand' || field === 'channels_brand') return 'BRAND';
    if (field === 'wechat_channels') return 'WECHAT_CHANNELS';
    if (/video/.test(field)) return 'VIDEO';
    if (/image/.test(field)) return 'IMAGE';
    if (/main_jump_info|^jump_info$|end_page/.test(field)) return 'LANDING_PAGE';
    if (/form|consult|phone|button|pendant|social_skill|floating_zone|text_link|mini_card_link|count_down|barrage|show_data/.test(field)) return 'MARKETING';
    return 'OTHER';
  }
  private componentName(row: PlatformRecord, field: string, component: unknown) {
    const record = component && typeof component === 'object' ? component as PlatformRecord : {};
    const value = record.value && typeof record.value === 'object' ? record.value as PlatformRecord : {};
    const content = [value.content, value.title, value.description, value.brand_name, record.content]
      .find((item) => typeof item === 'string' && item.trim());
    return String(row.component_custom_name || content || this.componentLabel(field, row.component_id));
  }
  private componentContent(field: string | null, component: unknown, fallback: string) {
    const record = component && typeof component === 'object' ? component as PlatformRecord : {};
    const value = record.value && typeof record.value === 'object' ? record.value as PlatformRecord : {};
    const preferredKeys = field === 'brand' || field === 'channels_brand' || field === 'wechat_channels'
      ? ['brand_name', 'wechat_channels_account_name', 'wechat_official_account_name', 'username', 'nickname']
      : field === 'text_link'
        ? ['link_name_text', 'title', 'content']
        : field === 'mini_card_link'
          ? ['mini_card_link_description', 'mini_card_link_button_text']
        : field === 'social_skill'
          ? ['social_skill_first_comment', 'reply_text', 'content']
        : field === 'floating_zone' || field === 'floating_zone_list'
          ? ['floating_zone_name', 'floating_zone_desc', 'floating_zone_button_text', 'button_base_text']
          : ['content', 'title', 'description', 'button_text', 'button_base_text', 'link_name_text', 'name', 'page_name', 'label_name', 'reply_text'];
    const findStrings = (input: unknown, keys: string[], output: string[] = []): string[] => {
      if (Array.isArray(input)) { input.forEach((item) => findStrings(item, keys, output)); return output; }
      if (!input || typeof input !== 'object') return output;
      for (const [key, item] of Object.entries(input as Record<string, unknown>)) {
        if (keys.includes(key) && (typeof item === 'string' || typeof item === 'number') && String(item).trim()) output.push(String(item).trim());
        else if (item && typeof item === 'object') findStrings(item, keys, output);
      }
      return output;
    };
    const values = findStrings(value, preferredKeys);
    if (values.length) return [...new Set(values)].join(' · ').slice(0, 500);
    if (field === 'text_link') {
      const linkNameType = findStrings(value, ['link_name_type'])[0];
      if (linkNameType) return this.textLinkCopy(linkNameType);
    }
    if (field === 'main_jump_info') return fallback;
    return fallback;
  }
  private textLinkCopy(type: string) {
    const labels: Record<string, string> = {
      VIEW_DETAILS: '查看详情', MORE_INFO: '了解更多', GET_COUPONS: '领取优惠券', MAKE_AN_APPOINTMENT: '立即预约',
      BUY_NOW: '立即购买', GO_SHOPPING: '去逛逛', ENTER_MINI_PROGRAM: '进入小程序', ENTER_MINI_GAME: '进入小游戏',
      APPLY_NOW: '立即申请', BOOK_NOW: '立即预订', RESERVATION_BUY: '预约购买', CONSULT_NOW: '立即咨询',
      BOOK_DRIVE: '预约试驾', ENTER_OFFICIAL_ACCOUNTS: '进入公众号', PLAY_NOW: '立即体验', OPEN_MINI_GAME: '打开小游戏',
      DOWNLOAD_APP: '下载应用', DOWNLOAD_GAME: '下载游戏', GET_SAMPLES: '领取样品', TRY_NOW: '立即试用',
      GET_IT_NOW: '立即领取', BUY_ASAP: '马上购买', DOWNLOAD_NOW: '立即下载', VIEW_APPS: '查看应用',
      GET_VOUCHERS: '领取代金券', FOLLOW_OFFICIAL_ACCOUNT: '关注公众号', READ_NOVELS: '阅读小说', WATCH_LIVE: '观看直播',
      RESERVE_NOW: '立即预约', FOLLOW_CHANNELS: '关注视频号', MORE_ABOUT_CHANNELS: '了解视频号', OPEN_APP: '打开应用',
      ALREADY_INSTALL: '已安装', RESERVE_LIVE: '预约直播', SETUP_NOW: '立即安装', SECKILL_NOW: '立即秒杀',
      TRY_PLAY_NOW: '立即试玩', INSTALL_NOW: '立即安装', GET_FOR_FREE: '免费领取', WATCH_VIDEO: '观看视频',
      CONTACT_CUSTOMER_SERVICE: '联系客服', CONTACT_BUSINESS: '联系商家', GO_SCAN: '扫码了解', PICK_GIFT: '领取礼物',
      SELECT_GIFT: '选择礼物', GIVING_GIFT: '赠送礼物', GIVE_FRIEND: '送给好友',
    };
    return labels[type] || type;
  }
  private componentLabel(field: string, id: unknown) { return `${({ title: '标题', description: '文案', video: '视频', image: '图片', brand: '品牌形象', main_jump_info: '落地页', form: '表单', consult: '咨询组件', phone: '电话组件', text_link: '文字链', floating_zone: '浮层卡片', marketing_pendant: '营销挂件' } as Record<string, string>)[field] || '创意组件'} ${id || ''}`; }
  private recoverySuggestion(code: string, message: string) { if (code === '11002') return '在推广数据同步设置中刷新腾讯授权后重试'; if (['11101', '11102', '11103', '11104', '11022'].includes(code) || /实名认证令牌|user.?token/i.test(message)) return '在推广数据同步设置中重新扫码获取腾讯实名认证令牌（User Token），然后仅重试失败项'; if (code === '1800355' || /新版品牌形象/.test(message)) return '选择与视频号匹配的新版品牌形象组件后仅重试失败项'; if (code === '31050' || /page_spec\/page_id|link_page_spec\/page_id/.test(message)) return '主落地页与文字链组件必须引用同一个 page_id，请重新预览；系统会自动匹配同一落地页的文字链'; if (/频率|限流|429/i.test(`${code} ${message}`)) return '等待平台限流恢复后仅重试失败项'; if (/素材|视频|图片|标题|组件/i.test(message)) return '根据错误字段替换对应素材后创建新批次'; return '核对账户、营销单元、创意规格和素材状态后重试失败项'; }
  private auditSummary(prepared: any) {
    const materials = [...new Map(prepared.itemPayloads.flatMap((item: any) => item.materialSnapshot).map((asset: any) => [asset.id, { assetRef: this.hash(asset.id).slice(0, 12), type: asset.type, source: asset.source }])).values()];
    return { accountId: prepared.account.id, accountNo: this.maskId(prepared.account.accountNo), businessUnitKey: this.hash(prepared.account.project).slice(0, 12), adgroupId: this.maskId(prepared.adgroup.id), templateId: this.maskId(prepared.template?.template?.creative_template_id), creativeCount: prepared.itemPayloads.length, materials, materialSources: materials.reduce((result: Record<string, number>, asset: any) => ({ ...result, [asset.source]: (result[asset.source] || 0) + 1 }), {}) };
  }
  private maskId(value: unknown) { const text = String(value || ''); return text.length <= 4 ? '****' : `${'*'.repeat(Math.min(8, text.length - 4))}${text.slice(-4)}`; }
  private userAgent(value?: string | string[]) { return (Array.isArray(value) ? value.join(',') : value)?.slice(0, 255); }
  private redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (/token|secret|credential|authorization/i.test(key)) return [key, '[REDACTED]'];
      if (/(^|_)(account|adgroup|campaign|creative|template|video|image|component|material)_?id$/i.test(key) || /^(account|adgroup|campaign|creative|template|video|image|component|material)Id$/i.test(key)) return [key, this.maskId(item)];
      return [key, this.redact(item)];
    }));
  }
}
