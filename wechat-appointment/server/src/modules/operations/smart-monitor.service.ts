import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AdminCurrentUser } from '../../common/decorators/current-user.decorator';
import { PromotionAccountAccessService } from '../../common/data-scope/promotion-account-access.service';
import { BusinessException } from '../../common/utils/business-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PromotionDataSyncService } from './promotion-data-sync.service';
import { actualCpa, assessMonitorThresholds, resolveAdgroupTargetCpa } from './smart-monitor-rules';
import type { SmartMonitorChannelPolicyDto, SmartMonitorPolicyDto } from './smart-monitor.controller';

type PlatformRow = Record<string, any>;
const ADGROUP_FIELDS = JSON.stringify(['adgroup_id', 'adgroup_name', 'configured_status', 'system_status', 'optimization_goal', 'bid_mode', 'bid_amount', 'deep_conversion_behavior_bid', 'begin_date', 'end_date', 'last_modified_time']);
const CREATIVE_FIELDS = JSON.stringify(['dynamic_creative_id', 'dynamic_creative_name', 'adgroup_id', 'configured_status', 'creative_set_approval_status', 'created_time']);
const ENDPOINTS = ['/dynamic_creatives/get', '/dynamic_creative_review_results/get', '/dynamic_creatives/update', '/dynamic_creatives/delete', '/dynamic_creatives/add', '/adgroups/get', '/adgroups/update_configured_status', '/adgroups/update_datetime', '/daily_reports/get', '/hourly_reports/get'];

export function reviewResultStatus(row: PlatformRow): string | null {
  if (row.is_all_component_compose_pending === true) return 'CREATIVE_SET_APPROVAL_STATUS_PENDING';
  if (row.total_component_compose_count == null || row.pass_component_compose_count == null || row.reject_component_compose_count == null) return null;
  const total = Number(row.total_component_compose_count);
  const passed = Number(row.pass_component_compose_count);
  const rejected = Number(row.reject_component_compose_count);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(passed) || !Number.isFinite(rejected)) return null;
  if (passed === total) return 'CREATIVE_SET_APPROVAL_STATUS_NORMAL';
  if (rejected === total) return 'CREATIVE_SET_APPROVAL_STATUS_DENIED';
  if (passed > 0 && rejected > 0) return 'CREATIVE_SET_APPROVAL_STATUS_PARTIAL_NORMAL';
  if (passed + rejected < total) return 'CREATIVE_SET_APPROVAL_STATUS_PENDING';
  return null;
}

@Injectable()
export class SmartMonitorService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private polling = false;
  private readonly logger = new Logger(SmartMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PromotionAccountAccessService,
    private readonly sync: PromotionDataSyncService,
    private readonly audit: AuditLogsService,
  ) {}

  onModuleInit() {
    // Read-only polling, not a Tencent ten-minute report. Disabled per account by default.
    this.timer = setInterval(() => void this.pollEnabledAccounts(), 10 * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async accounts(user: AdminCurrentUser) {
    const rows = await this.prisma.promotionAccount.findMany({
      where: { AND: [await this.access.where(user, 'DATA'), { status: 'ACTIVE', platform: { contains: '腾讯' }, accountNo: { not: null } }] },
      select: { id: true, name: true, accountNo: true, platform: true, project: true, status: true, smartMonitorPolicies: { where: { scopeKey: '*' }, select: { enabled: true, autoEnabled: true, emergencyStop: true } } },
      orderBy: [{ project: 'asc' }, { name: 'asc' }],
    });
    const channels = await this.prisma.smartMonitorChannelPolicy.findMany({ where: { channelKey: { in: [...new Set(rows.map((row) => row.platform))] } }, select: { channelKey: true, enabled: true } });
    const enabledByChannel = new Map(channels.map((row) => [row.channelKey, row.enabled]));
    return rows.map(({ smartMonitorPolicies, ...account }) => ({ ...account, policy: { enabled: enabledByChannel.get(account.platform) ?? smartMonitorPolicies[0]?.enabled ?? false, autoEnabled: false, emergencyStop: true } }));
  }

  async saveChannelPolicy(channelKey: string, dto: SmartMonitorChannelPolicyDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    if (!channelKey || channelKey.length > 80 || !channelKey.includes('腾讯')) throw new BusinessException(400976, '当前渠道不支持腾讯智能监控规则', 400);
    const accounts = await this.prisma.promotionAccount.findMany({ where: { platform: channelKey, status: 'ACTIVE', accountNo: { not: null } }, select: { id: true, ownerAdminId: true, createdByAdminId: true } });
    if (!accounts.length) throw new BusinessException(404976, '当前渠道没有可监控的账户', 404);
    // A channel rule changes polling for every account, including accounts the
    // operator might not normally see. Require authority over the full set.
    for (const account of accounts) {
      await this.access.assertVisible(user, account, 'DATA');
      await this.access.assertCanCreateCreatives(user, account);
    }
    const before = await this.prisma.smartMonitorChannelPolicy.findUnique({ where: { channelKey } });
    const values = { enabled: dto.enabled, spendThreshold: dto.spendThreshold, emptySpendThreshold: dto.emptySpendThreshold,
      cpaThreshold: dto.cpaThreshold, maxReportAgeMinutes: dto.maxReportAgeMinutes,
      autoEnabled: false, emergencyStop: true, updatedByAdminId: user.adminUserId };
    const after = await this.prisma.smartMonitorChannelPolicy.upsert({ where: { channelKey }, create: { channelKey, ...values }, update: values });
    await this.audit.create({ adminUserId: user.adminUserId, action: 'UPDATE_SMART_MONITOR_CHANNEL_POLICY', resourceType: 'smart_monitor_channel_policies', resourceId: after.id,
      beforeJson: before ? { enabled: before.enabled, spendThreshold: Number(before.spendThreshold), emptySpendThreshold: Number(before.emptySpendThreshold), cpaThreshold: Number(before.cpaThreshold), maxReportAgeMinutes: before.maxReportAgeMinutes } : undefined,
      afterJson: { enabled: after.enabled, spendThreshold: Number(after.spendThreshold), emptySpendThreshold: Number(after.emptySpendThreshold), cpaThreshold: Number(after.cpaThreshold), maxReportAgeMinutes: after.maxReportAgeMinutes, autoEnabled: false, emergencyStop: true },
      ip, userAgent: Array.isArray(userAgent) ? userAgent.join('; ').slice(0, 500) : userAgent?.slice(0, 500) });
    return { enabled: after.enabled, spendThreshold: Number(after.spendThreshold), emptySpendThreshold: Number(after.emptySpendThreshold),
      cpaThreshold: Number(after.cpaThreshold), maxReportAgeMinutes: after.maxReportAgeMinutes, autoEnabled: false, emergencyStop: true };
  }

  async savePolicy(accountId: string, dto: SmartMonitorPolicyDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const account = await this.account(accountId, user);
    await this.access.assertCanCreateCreatives(user, account);
    const before = await this.prisma.smartMonitorPolicy.findUnique({ where: { accountId_scopeKey: { accountId, scopeKey: '*' } } });
    const values = { enabled: dto.enabled, ratioThreshold: dto.ratioThreshold, minSpend: dto.minSpend, minConversions: dto.minConversions, maxReportAgeMinutes: dto.maxReportAgeMinutes, autoEnabled: false, emergencyStop: true, updatedByAdminId: user.adminUserId };
    const after = await this.prisma.smartMonitorPolicy.upsert({ where: { accountId_scopeKey: { accountId, scopeKey: '*' } }, create: { accountId, scopeKey: '*', ...values }, update: values });
    await this.audit.create({ adminUserId: user.adminUserId, action: 'UPDATE_SMART_MONITOR_POLICY', resourceType: 'smart_monitor_policies', resourceId: after.id,
      beforeJson: before ? { enabled: before.enabled, ratioThreshold: Number(before.ratioThreshold), minSpend: Number(before.minSpend), minConversions: before.minConversions, maxReportAgeMinutes: before.maxReportAgeMinutes } : undefined,
      afterJson: { enabled: after.enabled, ratioThreshold: Number(after.ratioThreshold), minSpend: Number(after.minSpend), minConversions: after.minConversions, maxReportAgeMinutes: after.maxReportAgeMinutes, autoEnabled: false, emergencyStop: true }, ip, userAgent: Array.isArray(userAgent) ? userAgent.join('; ').slice(0, 500) : userAgent?.slice(0, 500) });
    return { enabled: after.enabled, ratioThreshold: Number(after.ratioThreshold), minSpend: Number(after.minSpend), minConversions: after.minConversions, maxReportAgeMinutes: after.maxReportAgeMinutes, autoEnabled: false, emergencyStop: true };
  }

  async dashboard(accountId: string, user: AdminCurrentUser, refresh = false) {
    const account = await this.account(accountId, user);
    const credential = await this.sync.tencentAccountCredentialStatus(account.id, user.adminUserId);
    const [channelPolicy, legacyPolicy] = await Promise.all([
      this.prisma.smartMonitorChannelPolicy.findUnique({ where: { channelKey: account.platform } }),
      this.prisma.smartMonitorPolicy.findUnique({ where: { accountId_scopeKey: { accountId, scopeKey: '*' } } }),
    ]);
    const policy = channelPolicy ? {
      enabled: channelPolicy.enabled, autoEnabled: false, emergencyStop: true,
      spendThreshold: Number(channelPolicy.spendThreshold), emptySpendThreshold: Number(channelPolicy.emptySpendThreshold),
      cpaThreshold: Number(channelPolicy.cpaThreshold), maxReportAgeMinutes: channelPolicy.maxReportAgeMinutes,
    } : { enabled: legacyPolicy?.enabled ?? false, autoEnabled: false, emergencyStop: true,
      spendThreshold: 1000, emptySpendThreshold: 200, cpaThreshold: 300,
      maxReportAgeMinutes: legacyPolicy?.maxReportAgeMinutes ?? 360 };
    const warnings: string[] = [];
    let adgroups: PlatformRow[] = [];
    let creatives: PlatformRow[] = [];
    let canReadCreatives = false;
    try { await this.access.assertVisible(user, account, 'CREATIVES'); canReadCreatives = true; } catch { /* Do not expose creative records through DATA access alone. */ }
    let adgroupsRequestId: string | undefined;
    let creativesRequestId: string | undefined;
    if (refresh) {
      try {
        const result = await this.pagedRead('/adgroups/get', account.accountNo!, { fields: ADGROUP_FIELDS, is_deleted: false }, user.adminUserId);
        adgroups = result.rows; adgroupsRequestId = result.requestId;
        if (!result.complete) warnings.push('营销单元超过当前只读查询的 1000 条安全上限；当前列表与趋势不完整，不用于自动判断');
        await this.capability(accountId, '/adgroups/get', true, result.requestId, result.complete ? '已通过当前账户完整分页只读查询' : '查询可用但超过分页安全上限，结果不完整');
      } catch (error) { warnings.push(`营销单元查询：${this.safeError(error)}`); await this.capability(accountId, '/adgroups/get', false, undefined, '当前账户只读查询失败'); }
      if (canReadCreatives) try {
        const result = await this.pagedRead('/dynamic_creatives/get', account.accountNo!, { fields: CREATIVE_FIELDS, is_deleted: false }, user.adminUserId);
        creatives = result.rows; creativesRequestId = result.requestId;
        if (!result.complete) warnings.push('创意超过当前只读查询的 1000 条安全上限；当前创意列表不完整');
        await this.capability(accountId, '/dynamic_creatives/get', true, result.requestId, result.complete ? '已通过当前账户完整分页只读查询' : '查询可用但超过分页安全上限，结果不完整');
      } catch (error) { warnings.push(`创意查询：${this.safeError(error)}`); await this.capability(accountId, '/dynamic_creatives/get', false, undefined, '当前账户只读查询失败'); }
      const missingAudit = creatives.filter((row) => !row.creative_set_approval_status && Number.isSafeInteger(Number(row.dynamic_creative_id)));
      if (missingAudit.length) {
        try {
          let reviewRequestId: string | undefined;
          const reviewRows: PlatformRow[] = [];
          for (let index = 0; index < Math.min(missingAudit.length, 500); index += 50) {
            const ids = missingAudit.slice(index, index + 50).map((row) => Number(row.dynamic_creative_id));
            const result = await this.sync.tencentApi('GET', '/dynamic_creative_review_results/get', account.accountNo!, { dynamic_creative_id_list: JSON.stringify(ids) }, true, user.adminUserId);
            reviewRequestId = result.requestId;
            reviewRows.push(...this.rows(result.data));
          }
          const reviewById = new Map(reviewRows.map((row) => [String(row.dynamic_creative_id || ''), reviewResultStatus(row)]));
          for (const row of missingAudit) row.creative_set_approval_status = reviewById.get(String(row.dynamic_creative_id || '')) || null;
          await this.capability(accountId, '/dynamic_creative_review_results/get', true, reviewRequestId, `已按腾讯审核结果接口补查 ${reviewRows.length} 条创意`);
          if (missingAudit.length > 500) warnings.push('审核状态补查限于前 500 条；其余创意保持腾讯未返回状态');
        } catch (error) {
          warnings.push(`创意审核结果查询：${this.safeError(error)}`);
          await this.capability(accountId, '/dynamic_creative_review_results/get', false, undefined, '当前账户审核结果只读查询失败');
        }
      }
      if (adgroups.length && adgroups.length < 1000) await this.collectHourly(account.id, account.accountNo!, adgroups, creatives).catch((error) => warnings.push(`小时报表：${this.safeError(error)}`));
    }
    // Read a rolling window, not the newest 200 rows. The latter can contain
    // only provisional hours for a large account and hide all stable evidence.
    const windowStart = new Date(Date.now() - 27 * 3_600_000);
    const snapshots = await this.prisma.smartMonitorSnapshot.findMany({
      where: { accountId, level: { in: ['ADGROUP', 'CREATIVE'] }, periodStart: { gte: windowStart } },
      orderBy: { periodStart: 'desc' }, take: 5001,
    });
    if (snapshots.length > 5000) warnings.push('近 27 小时监控快照超出 5000 条安全上限；当前仅展示状态，成本判断已暂停');
    const usableSnapshots = snapshots.length > 5000 ? [] : snapshots;
    const byObject = new Map<string, typeof usableSnapshots>();
    for (const item of usableSnapshots) {
      const key = `${item.level}:${item.platformObjectId}`;
      const list = byObject.get(key) || [];
      list.push(item);
      byObject.set(key, list);
    }
    const summarize = (level: 'ADGROUP' | 'CREATIVE', id: string, targetCpa: number | null) => {
      const rows = byObject.get(`${level}:${id}`) || [];
      const stable = rows.filter((item) => item.backfillStatus === 'BACKFILLED' && item.periodEnd.getTime() <= Date.now() - 3 * 3_600_000);
      const newest = rows[0];
      const spend = stable.length ? Number(stable.reduce((sum, item) => sum + Number(item.spend), 0).toFixed(2)) : newest ? Number(newest.spend) : null;
      const conversions = stable.length ? stable.reduce((sum, item) => sum + item.conversions, 0) : newest?.conversions ?? null;
      const lastStable = stable[0];
      const reportAgeMinutes = lastStable ? Math.max(0, (Date.now() - lastStable.periodEnd.getTime()) / 60_000) : null;
      const maxAge = policy?.maxReportAgeMinutes ?? 360;
      const staleSnapshots = stable.some((item) => !item.fetchedAt || !Number.isFinite(new Date(item.fetchedAt).getTime()) || Date.now() - new Date(item.fetchedAt).getTime() > maxAge * 60_000);
      const assessment = staleSnapshots
        ? { state: 'INSUFFICIENT' as const, evidence: '观察期内存在抓取过期的小时快照，请刷新腾讯报表后再判断', ratio: null }
        : lastStable && reportAgeMinutes !== null
        ? assessMonitorThresholds({ spend: spend!, conversions: conversions!, targetCpa, reportAgeMinutes,
          spendThreshold: policy.spendThreshold, emptySpendThreshold: policy.emptySpendThreshold,
          cpaThreshold: policy.cpaThreshold, maxReportAgeMinutes: policy.maxReportAgeMinutes })
        : { state: 'INSUFFICIENT' as const, evidence: newest ? '只有归因回补中的小时数据，暂不建议调整投放' : '尚无可核验的小时报表', ratio: null };
      const recommendation = assessment.state === 'WARNING'
        ? level === 'CREATIVE' ? '建议人工核查该创意的素材、审核和转化归因；确认异常后再决定是否暂停，不自动操作。' : '建议人工核查该营销单元的出价、创意与转化归因；确认异常后再决定调整，不自动操作。'
        : assessment.state === 'NORMAL' ? '消费和转化成本未达到异常阈值，继续观察。'
          : `暂不建议调整：${assessment.evidence}`;
      return { spend, impressions: stable.length ? stable.reduce((sum, item) => sum + item.impressions, 0) : newest?.impressions ?? null,
        clicks: stable.length ? stable.reduce((sum, item) => sum + item.clicks, 0) : newest?.clicks ?? null,
        conversions, actualCpa: spend !== null && conversions !== null ? actualCpa(spend, conversions) : null,
        costRatio: assessment.ratio, assessment, recommendation,
        reportSource: lastStable?.reportSource || newest?.reportSource || null,
        reportPeriodStart: stable.length ? stable[stable.length - 1].periodStart : newest?.periodStart || null,
        reportPeriodEnd: lastStable?.periodEnd || newest?.periodEnd || null,
        fetchedAt: newest?.fetchedAt || null, reportAgeMinutes, backfillStatus: lastStable ? 'BACKFILLED' : newest?.backfillStatus || null,
        evidenceHours: stable.length };
    };
    const adgroupTargets = new Map(adgroups.map((row) => [String(row.adgroup_id || ''), resolveAdgroupTargetCpa(row)]));
    const resolved = adgroups.map((row) => {
      const id = String(row.adgroup_id || '');
      const target = adgroupTargets.get(id)!;
      const metrics = summarize('ADGROUP', id, target.targetCpa);
      return {
        id, name: String(row.adgroup_name || id), configuredStatus: row.configured_status || null, systemStatus: row.system_status || null,
        beginDate: row.begin_date || null, endDate: row.end_date || null, optimizationGoal: row.optimization_goal || null, bidMode: row.bid_mode || null,
        targetCpa: target.targetCpa, targetSource: target.targetSource, targetUnit: target.targetUnit, targetStatus: target.targetStatus,
        targetUpdatedAt: row.last_modified_time || null,
        ...metrics,
      };
    });
    const capabilities = await this.prisma.smartMonitorCapability.findMany({ where: { accountId }, select: { endpoint: true, interfaceExists: true, projectImplemented: true, accountVerified: true, validationStatus: true, requestId: true, verifiedAt: true, safeNote: true } });
    const byEndpoint = new Map(capabilities.map((item) => [item.endpoint, item]));
    const trendByHour = new Map<string, number>();
    for (const item of usableSnapshots.filter((row) => row.level === 'ADGROUP')) {
      const hour = item.periodStart.toISOString();
      trendByHour.set(hour, Number((trendByHour.get(hour) || 0) + Number(item.spend)));
    }
    const trend = [...trendByHour].sort(([left], [right]) => left.localeCompare(right)).slice(-24);
    return {
      account: { id: account.id, name: account.name, accountNo: account.accountNo, platform: account.platform, project: account.project, status: account.status },
      credential, policy, policySource: channelPolicy ? 'CHANNEL' : 'LEGACY_ACCOUNT',
      granularity: '小时数据，约每十分钟刷新一次；不是腾讯原生十分钟报表',
      adgroups: resolved, creatives: creatives.map((row) => {
        const id = String(row.dynamic_creative_id || '');
        const adgroupId = String(row.adgroup_id || '');
        const target = adgroupTargets.get(adgroupId);
        const metrics = summarize('CREATIVE', id, target?.targetCpa ?? null);
        return { id, name: row.dynamic_creative_name || '', adgroupId, configuredStatus: row.configured_status || null, systemStatus: null,
          auditStatus: row.creative_set_approval_status || null, createdTime: row.created_time || null,
          targetCpa: target?.targetCpa ?? null, targetSource: target?.targetSource ?? null,
          metricsStatus: metrics.evidenceHours ? `近 27 小时内 ${metrics.evidenceHours} 个已稳定小时` : '暂无稳定的创意级小时数据', ...metrics };
      }),
      warnings, fetchedAt: refresh ? new Date() : null, requestIds: { adgroups: adgroupsRequestId, creatives: creativesRequestId },
      trend: { labels: trend.map(([hour]) => hour), spend: trend.map(([, spend]) => Number(spend.toFixed(2))) },
      capabilities: ENDPOINTS.map((endpoint) => byEndpoint.get(endpoint) || { endpoint,
        interfaceExists: true,
        projectImplemented: ['/adgroups/get', '/dynamic_creatives/get', '/dynamic_creative_review_results/get', '/dynamic_creatives/update', '/dynamic_creatives/delete', '/hourly_reports/get', '/daily_reports/get', '/dynamic_creatives/add'].includes(endpoint),
        accountVerified: false, validationStatus: 'UNVERIFIED', requestId: null, verifiedAt: null,
        safeNote: endpoint === '/dynamic_creatives/delete' ? '腾讯官方 SDK v3.0 列出删除接口；当前账户写入和回读尚未验证' : '接口存在不代表当前账户有权调用' }),
    };
  }

  private async collectHourly(accountId: string, accountNo: string, adgroups: PlatformRow[], creatives: PlatformRow[] = []) {
    const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' });
    const dates = [formatter.format(new Date(Date.now() - 86_400_000)), formatter.format(new Date())];
    const adgroupById = new Map(adgroups.map((row) => [String(row.adgroup_id), row]));
    const creativeById = new Map(creatives.map((row) => [String(row.dynamic_creative_id), row]));
    const sources = [
      { level: 'ADGROUP' as const, reportLevel: 'REPORT_LEVEL_ADGROUP', field: 'adgroup_id', objects: adgroupById },
      ...(creatives.length ? [{ level: 'CREATIVE' as const, reportLevel: 'REPORT_LEVEL_DYNAMIC_CREATIVE', field: 'dynamic_creative_id', objects: creativeById }] : []),
    ];
    let saved = 0;
    let lastRequestId: string | undefined;
    for (const source of sources) for (const date of dates) {
      let result;
      try {
        result = await this.pagedRead('/hourly_reports/get', accountNo, {
          level: source.reportLevel, date_range: JSON.stringify({ start_date: date, end_date: date }),
          group_by: JSON.stringify(['hour', source.field]), fields: JSON.stringify(['hour', source.field, 'cost', 'view_count', 'valid_click_count', 'conversions_count']),
        });
      } catch (error) {
        await this.capability(accountId, '/hourly_reports/get', false, undefined, `${source.level === 'CREATIVE' ? '创意' : '营销单元'}小时报表查询失败`);
        throw error;
      }
      lastRequestId = result.requestId;
      if (!result.complete) {
        await this.capability(accountId, '/hourly_reports/get', false, result.requestId, '报表超过 1000 条分页安全上限；未写入不完整快照');
        throw new BusinessException(503972, '小时报表超过分页安全上限，未将不完整报表写入监控快照', 503);
      }
      for (const row of result.rows) {
        const dimensions = (row.dimensions || {}) as PlatformRow;
        const metrics = (row.metrics || {}) as PlatformRow;
        const id = String(row[source.field] ?? dimensions[source.field] ?? '');
        const hour = Number(row.hour ?? dimensions.hour ?? row.time_line ?? dimensions.time_line);
        // A single-day query makes Tencent's 0..23 hour dimension unambiguous.
        if (!id || !source.objects.has(id) || !Number.isInteger(hour) || hour < 0 || hour > 23) continue;
        const periodStart = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+08:00`);
        const periodEnd = new Date(periodStart.getTime() + 3_600_000);
        const spend = Number(row.cost ?? metrics.cost ?? 0) / 100;
        const impressions = Number(row.view_count ?? metrics.view_count ?? 0);
        const clicks = Number(row.valid_click_count ?? metrics.valid_click_count ?? 0);
        const conversions = Number(row.conversions_count ?? metrics.conversions_count ?? 0);
        if (![spend, impressions, clicks, conversions].every((value) => Number.isFinite(value) && value >= 0)) continue;
        const object = source.objects.get(id)!;
        const adgroupId = source.level === 'ADGROUP' ? id : String(object.adgroup_id || '');
        const adgroup = adgroupById.get(adgroupId);
        if (!adgroup) continue;
        const target = resolveAdgroupTargetCpa(adgroup);
        const values = { spend, impressions, clicks, conversions, actualCpa: actualCpa(spend, conversions), targetCpa: target.targetCpa,
          targetSource: target.targetSource, targetStatus: target.targetStatus, configuredStatus: object.configured_status || null,
          systemStatus: object.system_status || null, reportAt: periodEnd,
          backfillStatus: periodEnd.getTime() + 3 * 3_600_000 < Date.now() ? 'BACKFILLED' : 'PROVISIONAL' };
        await this.prisma.smartMonitorSnapshot.upsert({
          where: { accountId_level_platformObjectId_periodStart: { accountId, level: source.level, platformObjectId: id, periodStart } },
          create: { accountId, level: source.level, platformObjectId: id, adgroupId, periodStart, periodEnd,
            ...values, reportSource: 'TENCENT_HOURLY_REPORT' },
          update: { ...values, fetchedAt: new Date() },
        });
        saved += 1;
      }
    }
    await this.capability(accountId, '/hourly_reports/get', saved > 0, lastRequestId,
      saved ? `已回读并覆盖 ${saved} 条有明确小时的营销单元／创意数据` : '接口可读，但未返回可确认小时的数据；未写入快照');
  }

  private async pollEnabledAccounts() {
    if (this.polling) return;
    this.polling = true;
    try {
      const [channelPolicies, legacyPolicies] = await Promise.all([
        this.prisma.smartMonitorChannelPolicy.findMany({ select: { channelKey: true, enabled: true } }),
        this.prisma.smartMonitorPolicy.findMany({ where: { enabled: true, scopeKey: '*' }, include: { account: true }, orderBy: { accountId: 'asc' } }),
      ]);
      const channelByKey = new Map(channelPolicies.map((policy) => [policy.channelKey, policy.enabled]));
      const channelAccounts = channelPolicies.some((policy) => policy.enabled)
        ? await this.prisma.promotionAccount.findMany({ where: { status: 'ACTIVE', accountNo: { not: null }, platform: { in: channelPolicies.filter((policy) => policy.enabled).map((policy) => policy.channelKey) } },
          select: { id: true, accountNo: true, status: true, platform: true }, orderBy: { id: 'asc' } }) : [];
      const targets = [
        ...channelAccounts.map((account) => ({ accountId: account.id, account })),
        ...legacyPolicies.filter((policy) => !channelByKey.has(policy.account.platform)).map((policy) => ({ accountId: policy.accountId, account: policy.account })),
      ];
      if (!targets.length) return;
      // One account at a time: each cycle reads two dates and two object levels.
      const pollOne = async (target: typeof targets[number]) => {
        if (!target.account.accountNo || target.account.status !== 'ACTIVE') return;
        let rows: PlatformRow[];
        try {
          const result = await this.pagedRead('/adgroups/get', target.account.accountNo, { fields: ADGROUP_FIELDS, is_deleted: false });
          rows = result.complete ? result.rows : [];
          await this.capability(target.accountId, '/adgroups/get', result.complete, result.requestId, result.complete ? '定时只读完整分页查询通过' : '超过 1000 条分页安全上限，跳过不完整报表');
        } catch { await this.capability(target.accountId, '/adgroups/get', false, undefined, '定时只读查询失败；请检查授权及接口权限'); return; }
        if (rows.length) {
          let creatives: PlatformRow[] = [];
          try {
            const result = await this.pagedRead('/dynamic_creatives/get', target.account.accountNo, { fields: CREATIVE_FIELDS, is_deleted: false });
            creatives = result.complete ? result.rows : [];
            await this.capability(target.accountId, '/dynamic_creatives/get', result.complete, result.requestId,
              result.complete ? '定时只读完整分页查询通过' : '创意超过 1000 条安全上限，跳过创意级报表');
          } catch { await this.capability(target.accountId, '/dynamic_creatives/get', false, undefined, '定时只读创意查询失败；仅保留营销单元监控'); }
          try { await this.collectHourly(target.accountId, target.account.accountNo, rows, creatives); }
          catch { /* collectHourly records its own endpoint failure; the adgroup read remains verified. */ }
        }
      };
      for (const target of targets) {
        try { await pollOne(target); }
        catch { this.logger.warn('某个账户监控轮询失败，已保留历史数据并继续其他账户；下轮重试'); }
      }
    } catch {
      // Timer callbacks must never produce unhandled promise rejections.
      // Do not log raw database/API errors, which may contain credentials.
      this.logger.warn('监控轮询暂时失败，下轮重试；未执行投放写操作');
    } finally { this.polling = false; }
  }

  private async account(accountId: string, user: AdminCurrentUser) {
    const account = await this.prisma.promotionAccount.findFirst({ where: { AND: [await this.access.where(user, 'DATA'), { id: accountId, status: 'ACTIVE', platform: { contains: '腾讯' }, accountNo: { not: null } }] } });
    if (!account) throw new BusinessException(403971, '账户不存在或不在当前数据范围', 403);
    return account;
  }

  private rows(data: unknown): PlatformRow[] {
    const value = data as PlatformRow;
    return Array.isArray(value?.list) ? value.list : Array.isArray(value?.items) ? value.items : [];
  }

  private async pagedRead(path: string, accountNo: string, input: Record<string, unknown>, actorAdminId?: string) {
    const all: PlatformRow[] = [];
    let requestId: string | undefined;
    for (let page = 1; page <= 10; page += 1) {
      const response = await this.sync.tencentApi('GET', path, accountNo, { ...input, page, page_size: 100 }, true, actorAdminId);
      const batch = this.rows(response.data);
      requestId = response.requestId;
      all.push(...batch);
      if (batch.length < 100) return { rows: all, complete: true, requestId };
    }
    return { rows: all, complete: false, requestId };
  }

  private async capability(accountId: string, endpoint: string, passed: boolean, requestId?: string, safeNote?: string) {
    await this.prisma.smartMonitorCapability.upsert({ where: { accountId_endpoint: { accountId, endpoint } },
      create: { accountId, endpoint, interfaceExists: true, projectImplemented: true, accountVerified: passed, validationStatus: passed ? 'READ_VERIFIED' : 'READ_FAILED', requestId, verifiedAt: new Date(), safeNote },
      update: { accountVerified: passed, validationStatus: passed ? 'READ_VERIFIED' : 'READ_FAILED', requestId, verifiedAt: new Date(), safeNote },
    });
  }

  private safeError(error: unknown) {
    const value = error as { code?: string; requestId?: string };
    return `平台查询失败${value?.code ? `（${String(value.code).slice(0, 40)}）` : ''}${value?.requestId ? `，请求 ${String(value.requestId).slice(0, 60)}` : ''}`;
  }
}
