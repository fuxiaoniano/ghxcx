import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContentStatus, Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import dayjs from 'dayjs';
import Redis from 'ioredis';
import { AdminCurrentUser } from '../../common/decorators/current-user.decorator';
import { BusinessException } from '../../common/utils/business-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CryptoService } from '../crypto/crypto.service';
import { ArchivePromotionDailyMetricDto, DateRangeQueryDto, PromotionAccountCredentialDto, PromotionAccountDto, PromotionAccountGrantsDto, PromotionDailyMetricDto, PromotionDailyReportNoteDto, PromotionDataSyncConfigDto, TencentBusinessUnitCredentialDto, PromotionHealthAnalyzeDto, PromotionMaterialAnalyzeDto, PromotionMetricFieldDto, PromotionSalaryConfigDto, SyncPromotionDailyMetricsDto } from './dto';
import { PromotionDataSyncService } from './promotion-data-sync.service';
import { DataScopeService } from '../../common/data-scope/data-scope.service';
import { PromotionAccountAccessService, PromotionAccountCapability } from '../../common/data-scope/promotion-account-access.service';
import { TencentUserTokenDto } from './dto';
import { aggregatePromotionHealth, diagnosePromotionHealth } from './promotion-health';
import { diagnosePromotionMaterial, PromotionMaterialType } from './promotion-material-health';

type SummaryUnit = 'week' | 'month';
type SyncExtraConfig = {
  clientId?: string;
  clientSecretCipher?: string;
  refreshTokenCipher?: string;
  userTokenCipher?: string;
  userTokenExpiresAt?: string;
  authorizedAccountId?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  sharedAccountNos?: string[];
};

type SalaryProject = '重庆' | '绵阳';
type SalaryRegionRule = { minDailyLeads: number; minValidRate: number; maxAverageCost: number };
type SalaryTierConfig = { salary: number; chongqing: SalaryRegionRule; mianyang: SalaryRegionRule };
type SalaryConfig = { baseSalary: number; recentDays: number; tiers: SalaryTierConfig[] };

const DEFAULT_PROMOTION_SALARY_CONFIG: SalaryConfig = {
  baseSalary: 6000,
  recentDays: 7,
  tiers: [
    { salary: 8000, chongqing: { minDailyLeads: 1.67, minValidRate: 0.5, maxAverageCost: 200 }, mianyang: { minDailyLeads: 1, minValidRate: 0.5, maxAverageCost: 200 } },
    { salary: 12000, chongqing: { minDailyLeads: 3.33, minValidRate: 0.5, maxAverageCost: 200 }, mianyang: { minDailyLeads: 1, minValidRate: 0.5, maxAverageCost: 200 } },
    { salary: 15000, chongqing: { minDailyLeads: 3.33, minValidRate: 0.5, maxAverageCost: 200 }, mianyang: { minDailyLeads: 1.67, minValidRate: 0.5, maxAverageCost: 200 } },
  ],
};

function normalizeAccessToken(input?: string) {
  let value = input?.trim() || '';
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    value = String(parsed?.access_token || parsed?.data?.access_token || value).trim();
  } catch {
    const match = value.match(/(?:^|[?&])access_token=([^&\s]+)/i);
    if (match) value = decodeURIComponent(match[1]);
  }
  return value.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
}

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly crypto: CryptoService,
    private readonly syncService: PromotionDataSyncService,
    @Optional() private readonly dataScopes?: DataScopeService,
    @Optional() private readonly promotionAccess?: PromotionAccountAccessService,
    @Inject('REDIS') @Optional() private readonly redis?: Redis,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async accounts(user?: AdminCurrentUser) {
    const rows = await this.prisma.promotionAccount.findMany({
      where: await this.accountScope(user),
      include: { owner: { select: { id: true, username: true, nickname: true } } },
      orderBy: [{ status: 'asc' }, { platform: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => ({ ...row, canManageCredentials: Boolean(user && (user.role === 'SUPER_ADMIN' || user.role === 'MANAGER' || row.ownerAdminId === user.adminUserId || row.createdByAdminId === user.adminUserId)) }));
  }

  async fields() {
    await this.ensureDefaultFields();
    return this.prisma.promotionMetricField.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] });
  }

  async createField(dto: PromotionMetricFieldDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const field = await this.prisma.promotionMetricField.create({
      data: { key: `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, label: dto.label.trim(), source: 'CUSTOM', dataType: dto.dataType || 'NUMBER', isVisible: dto.isVisible ?? true, sort: dto.sort ?? 1000 },
    });
    await this.log('CREATE_PROMOTION_METRIC_FIELD', 'promotion_metric_fields', field.id, undefined, field, user, ip, userAgent);
    return field;
  }

  async updateField(id: string, dto: PromotionMetricFieldDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.fieldOrThrow(id);
    const field = await this.prisma.promotionMetricField.update({ where: { id }, data: { label: dto.label.trim(), ...(before.source === 'CUSTOM' && dto.dataType ? { dataType: dto.dataType } : {}), ...(dto.isVisible === undefined ? {} : { isVisible: dto.isVisible }), ...(dto.sort === undefined ? {} : { sort: dto.sort }) } });
    await this.log('UPDATE_PROMOTION_METRIC_FIELD', 'promotion_metric_fields', id, before, field, user, ip, userAgent);
    return field;
  }

  async deleteField(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.fieldOrThrow(id);
    if (before.source === 'SYSTEM') {
      const field = await this.prisma.promotionMetricField.update({ where: { id }, data: { isVisible: false } });
      await this.log('HIDE_PROMOTION_METRIC_FIELD', 'promotion_metric_fields', id, before, field, user, ip, userAgent);
      return { id, hidden: true };
    }
    await this.prisma.promotionMetricField.delete({ where: { id } });
    await this.log('DELETE_PROMOTION_METRIC_FIELD', 'promotion_metric_fields', id, before, undefined, user, ip, userAgent);
    return { id, deleted: true };
  }

  async dailyReport(date: string, user?: AdminCurrentUser) {
    return this.periodReport(date, date, date, 'day', user);
  }

  async weeklyReport(date: string, dateTo?: string, user?: AdminCurrentUser) {
    if (dateTo) return this.periodReport(date, dateTo, date, 'week', user);
    const start = this.monday(date);
    return this.periodReport(start, dayjs(start).add(6, 'day').format('YYYY-MM-DD'), start, 'week', user);
  }

  async monthlyReport(date: string, user?: AdminCurrentUser) {
    const start = dayjs(date).startOf('month').format('YYYY-MM-DD');
    return this.periodReport(start, dayjs(date).endOf('month').format('YYYY-MM-DD'), start, 'month', user);
  }

  async salary(month: string, user?: AdminCurrentUser) {
    const monthStart = dayjs(`${month}-01`).startOf('month');
    const monthEnd = monthStart.endOf('month');
    const dateFrom = monthStart.format('YYYY-MM-DD');
    const dateTo = monthEnd.format('YYYY-MM-DD');
    const [rows, config] = await Promise.all([
      this.prisma.promotionDailyMetric.findMany({ where: { statDate: { gte: monthStart.toDate(), lte: monthEnd.toDate() }, account: await this.accountScope(user) }, include: { account: true }, orderBy: { statDate: 'asc' } }),
      this.salaryConfig(),
    ]);
    const now = dayjs();
    const totalDays = monthEnd.date();
    const isCurrentMonth = monthStart.format('YYYY-MM') === now.format('YYYY-MM');
    const isPastMonth = monthStart.isBefore(now.startOf('month'));
    const latestDay = rows.length ? dayjs(rows[rows.length - 1].statDate).date() : 0;
    const elapsedDays = isPastMonth ? totalDays : isCurrentMonth ? Math.max(latestDay, Math.max(0, Math.min(totalDays, now.date() - 1))) : 0;
    const remainingDays = Math.max(0, totalDays - elapsedDays);
    const aggregate = (source: typeof rows, averageDays: number) => {
      const buckets = new Map<SalaryProject, { project: SalaryProject; leads: number; validLeads: number; spend: number; dates: Set<string> }>([
        ['重庆', { project: '重庆', leads: 0, validLeads: 0, spend: 0, dates: new Set<string>() }],
        ['绵阳', { project: '绵阳', leads: 0, validLeads: 0, spend: 0, dates: new Set<string>() }],
      ]);
      for (const row of source) {
        const project: SalaryProject | null = row.account.project.includes('绵阳') ? '绵阳' : row.account.project.includes('重庆') ? '重庆' : null;
        if (!project) continue;
        const bucket = buckets.get(project)!;
        bucket.leads += row.leads; bucket.validLeads += row.validLeads; bucket.spend += Number(row.spend); bucket.dates.add(dayjs(row.statDate).format('YYYY-MM-DD'));
      }
      const summarize = (item: { project?: SalaryProject; leads: number; validLeads: number; spend: number; dates: Set<string> }) => ({
        ...(item.project ? { project: item.project } : {}), leads: item.leads, validLeads: item.validLeads, spend: this.money(item.spend),
        validRate: item.leads ? Number((item.validLeads / item.leads).toFixed(6)) : null,
        averageCost: item.leads ? this.money(item.spend / item.leads) : null, recordedDays: item.dates.size,
        averageDailyLeads: averageDays ? this.money(item.leads / averageDays) : 0,
      });
      const regions = Array.from(buckets.values()).map(summarize);
      const combined = Array.from(buckets.values()).reduce((result, item) => {
        result.leads += item.leads; result.validLeads += item.validLeads; result.spend += item.spend; item.dates.forEach((date) => result.dates.add(date)); return result;
      }, { leads: 0, validLeads: 0, spend: 0, dates: new Set<string>() });
      return { regions, overall: summarize(combined) };
    };
    const monthMetrics = aggregate(rows, elapsedDays);
    const observedEnd = elapsedDays ? monthStart.add(elapsedDays - 1, 'day') : monthStart.subtract(1, 'day');
    const recentDays = Math.min(config.recentDays, elapsedDays);
    const recentStart = recentDays ? observedEnd.subtract(recentDays - 1, 'day') : observedEnd;
    const recentRows = recentDays ? rows.filter((row) => { const value = dayjs(row.statDate); return !value.isBefore(recentStart, 'day') && !value.isAfter(observedEnd, 'day'); }) : [];
    const recentMetrics = aggregate(recentRows, recentDays);
    const qualifies = (tier: SalaryTierConfig, metrics: ReturnType<typeof aggregate>) => (['重庆', '绵阳'] as SalaryProject[]).every((project) => {
      const current = metrics.regions.find((item) => item.project === project)!;
      const rule = project === '重庆' ? tier.chongqing : tier.mianyang;
      return current.averageDailyLeads >= rule.minDailyLeads && current.validRate !== null && current.validRate >= rule.minValidRate && current.averageCost !== null && current.averageCost < rule.maxAverageCost;
    });
    const tiers = config.tiers.map((tier) => ({ ...tier, achieved: qualifies(tier, monthMetrics), recentAchieved: qualifies(tier, recentMetrics) }));
    const currentSalary = [...tiers].reverse().find((tier) => tier.achieved)?.salary || config.baseSalary;
    const forecastSalary = [...tiers].reverse().find((tier) => tier.recentAchieved)?.salary || config.baseSalary;
    const next = tiers.find((tier) => tier.salary > forecastSalary) || null;
    const recommendations: string[] = [];
    let nextTier = null;
    if (next) {
      const criteria = (['重庆', '绵阳'] as SalaryProject[]).flatMap((project) => {
        const metrics = recentMetrics.regions.find((item) => item.project === project)!; const rule = project === '重庆' ? next.chongqing : next.mianyang;
        const leadGap = Math.max(0, rule.minDailyLeads - metrics.averageDailyLeads);
        const leadText = leadGap ? `${project}最近日均表单量还需提升 ${leadGap.toFixed(2)}，建议增加高转化计划预算并优化素材` : `${project}日均表单量已达标`;
        const rateGap = Math.max(0, rule.minValidRate - (metrics.validRate || 0));
        const rateText = rateGap ? `${project}有效率需从 ${((metrics.validRate || 0) * 100).toFixed(2)}% 提升至 ${(rule.minValidRate * 100).toFixed(2)}%` : `${project}有效率已达标`;
        const costAchieved = metrics.averageCost !== null && metrics.averageCost < rule.maxAverageCost;
        const costGap = metrics.averageCost === null ? rule.maxAverageCost : Math.max(0, metrics.averageCost - rule.maxAverageCost);
        const costText = costAchieved ? `${project}表单成本已达标` : metrics.averageCost === null ? `${project}暂无表单，需先产生投放数据` : `${project}表单成本需从 ${metrics.averageCost.toFixed(2)} 元降至 ${rule.maxAverageCost.toFixed(2)} 元以下`;
        [leadText, rateText, costText].forEach((text, index) => { if ([leadGap > 0, rateGap > 0, !costAchieved][index]) recommendations.push(text); });
        return [
          { key: `${project}-dailyLeads`, project, label: '日均表单量', current: metrics.averageDailyLeads, target: rule.minDailyLeads, achieved: leadGap === 0, gap: leadGap, unit: 'count' as const, recommendation: leadText },
          { key: `${project}-validRate`, project, label: '有效率', current: metrics.validRate, target: rule.minValidRate, achieved: rateGap === 0, gap: rateGap, unit: 'rate' as const, recommendation: rateText },
          { key: `${project}-averageCost`, project, label: '表单成本', current: metrics.averageCost, target: rule.maxAverageCost, achieved: costAchieved, gap: costGap, unit: 'money' as const, recommendation: costText },
        ];
      });
      nextTier = { ...next, criteria };
    } else {
      recommendations.push('最近数据已达到最高工资档位，请继续保持重庆、绵阳各项指标');
    }
    return {
      month, dateFrom, dateTo, dataThrough: rows.length ? dayjs(rows[rows.length - 1].statDate).format('YYYY-MM-DD') : null,
      elapsedDays, remainingDays, totalDays, currentSalary: currentSalary || config.baseSalary, forecastSalary,
      regions: monthMetrics.regions, overall: monthMetrics.overall,
      recent: { dateFrom: recentDays ? recentStart.format('YYYY-MM-DD') : null, dateTo: recentDays ? observedEnd.format('YYYY-MM-DD') : null, days: recentDays, regions: recentMetrics.regions, overall: recentMetrics.overall },
      tiers, nextTier, recommendations, config,
    };
  }

  async updateSalaryConfig(dto: PromotionSalaryConfigDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const config = this.normalizeSalaryConfig(dto);
    const before = await this.prisma.systemConfig.findUnique({ where: { key: 'promotionSalaryRules' } });
    const saved = await this.prisma.systemConfig.upsert({
      where: { key: 'promotionSalaryRules' },
      create: { key: 'promotionSalaryRules', valueJson: config as unknown as Prisma.InputJsonValue, description: '推广数据工资测算规则' },
      update: { valueJson: config as unknown as Prisma.InputJsonValue, description: '推广数据工资测算规则' },
    });
    await this.log('UPDATE_PROMOTION_SALARY_CONFIG', 'system_configs', saved.id, before, saved, user, ip, userAgent);
    return config;
  }

  private async periodReport(dateFrom: string, dateTo: string, noteDate: string, periodType: 'day' | 'week' | 'month', user?: AdminCurrentUser) {
    const noteStatDate = this.date(noteDate);
    const [metrics, notes] = await Promise.all([
      this.mergedMetrics({ dateFrom, dateTo }, user),
      this.prisma.promotionDailyReportNote.findMany({ where: { statDate: noteStatDate, periodType } }),
    ]);
    const noteMap = new Map(notes.map((note) => [`${note.project}:${note.channel}`, note]));
    const projects = new Map<string, Map<string, any[]>>();
    for (const metric of metrics) {
      const project = metric.account.project;
      const channel = metric.account.platform;
      const channels = projects.get(project) || new Map<string, any[]>();
      channels.set(channel, [...(channels.get(channel) || []), this.reportMetric(metric)]);
      projects.set(project, channels);
    }
    return {
      statDate: dayjs(noteStatDate).format('YYYY-MM-DD'), dateFrom, dateTo,
      projects: Array.from(projects.entries()).sort(([left], [right]) => this.reportProjectOrder(left) - this.reportProjectOrder(right) || left.localeCompare(right, 'zh-CN')).map(([project, channels]) => {
        const channelItems = Array.from(channels.entries()).sort(([left], [right]) => this.reportChannelOrder(left) - this.reportChannelOrder(right) || left.localeCompare(right, 'zh-CN')).map(([channel, sourceAccounts]) => {
          const accounts = this.mergeReportAccounts(sourceAccounts);
          const totals = this.reportTotals(sourceAccounts);
          const note = noteMap.get(`${project}:${channel}`);
          return { channel, accounts, totals, problem: note?.problem || this.autoProblem(totals), adjustment: note?.adjustment || this.autoAdjustment(totals), isManual: Boolean(note) };
        });
        return { project, channels: channelItems, totals: this.reportTotals(Array.from(channels.values()).flat()) };
      }),
    };
  }

  async updateDailyReportNote(dto: PromotionDailyReportNoteDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const visibleAccount = await this.prisma.promotionAccount.count({ where: { AND: [await this.accountScope(user), { project: dto.project.trim(), platform: dto.channel.trim() }] } });
    if (!visibleAccount) throw new BusinessException(403706, '无权修改该项目和渠道的报表说明', 403);
    const statDate = this.date(dto.statDate); const periodType = dto.periodType || 'day'; const key = { statDate_periodType_project_channel: { statDate, periodType, project: dto.project.trim(), channel: dto.channel.trim() } };
    const before = await this.prisma.promotionDailyReportNote.findUnique({ where: key });
    const note = await this.prisma.promotionDailyReportNote.upsert({ where: key, create: { statDate, periodType, project: dto.project.trim(), channel: dto.channel.trim(), problem: dto.problem.trim(), adjustment: dto.adjustment.trim() }, update: { problem: dto.problem.trim(), adjustment: dto.adjustment.trim() } });
    await this.log('UPDATE_PROMOTION_DAILY_REPORT_NOTE', 'promotion_daily_report_notes', note.id, before, note, user, ip, userAgent);
    return note;
  }

  async createAccount(dto: PromotionAccountDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const account = await this.prisma.promotionAccount.create({ data: { ...this.accountData(dto), ownerAdminId: user.adminUserId, createdByAdminId: user.adminUserId } });
    await this.log('CREATE_PROMOTION_ACCOUNT', 'promotion_accounts', account.id, undefined, account, user, ip, userAgent);
    return account;
  }

  async updateAccount(id: string, dto: PromotionAccountDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.accountOrThrow(id, user);
    await this.promotionAccess?.assertCredentialManager(user, before);
    const account = await this.prisma.promotionAccount.update({ where: { id }, data: this.accountData(dto) });
    await this.log('UPDATE_PROMOTION_ACCOUNT', 'promotion_accounts', id, before, account, user, ip, userAgent);
    return account;
  }

  async promotionAccountCredential(accountId: string, user: AdminCurrentUser) {
    const account = await this.accountOrThrow(accountId, user);
    await this.promotionAccess?.assertCredentialManager(user, account);
    return this.safeAccountCredential(await this.prisma.promotionAccountCredential.findUnique({ where: { accountId } }));
  }

  async myTencentUserToken(user: AdminCurrentUser) {
    const row = await this.prisma.tencentUserToken.findUnique({ where: { adminUserId: user.adminUserId } });
    return { hasUserToken: Boolean(row?.tokenCipher && (!row.expiresAt || row.expiresAt > new Date())), userTokenExpiresAt: row?.expiresAt || null };
  }

  async createTencentUserTokenAuthorization(user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    if (!this.redis || !this.config) throw new BusinessException(503912, '腾讯授权服务暂不可用，请稍后重试', 503);
    const serverBase = this.validHttpsBase(this.config.get<string>('SERVER_BASE_URL'), 'SERVER_BASE_URL');
    const state = randomBytes(32).toString('hex');
    const stateKey = this.tencentUserTokenStateKey(state);
    const stored = await this.redis.set(stateKey, JSON.stringify({ adminUserId: user.adminUserId }), 'EX', 600, 'NX');
    if (stored !== 'OK') throw new BusinessException(503912, '腾讯授权会话创建失败，请稍后重试', 503);
    const redirectUri = `${serverBase}/api/admin/operations/tencent-user-token-auth/callback`;
    const authorizationUrl = `https://ad.qq.com/account-center/single/user-authorize?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
    await this.audit.create({ adminUserId: user.adminUserId, action: 'START_TENCENT_USER_TOKEN_AUTH', resourceType: 'tencent_user_tokens', resourceId: user.adminUserId, ip, userAgent: Array.isArray(userAgent) ? userAgent.join(',') : userAgent });
    return { authorizationUrl, expiresIn: 600 };
  }

  async completeTencentUserTokenAuthorization(input: { state?: string; userStatus?: string; userToken?: string; expireTime?: string }, ip?: string, userAgent?: string | string[]) {
    const frontendBase = this.validHttpsBase(this.config?.get<string>('FRONTEND_BASE_URL'), 'FRONTEND_BASE_URL');
    const callback = (status: 'success' | 'cancelled' | 'error') => `${frontendBase}/promotion/accounts?user_token_status=${status}`;
    if (!this.redis || !/^[a-f0-9]{64}$/i.test(input.state || '')) return { redirectUrl: callback('error') };
    const stateKey = this.tencentUserTokenStateKey(input.state!);
    const raw = await this.redis.eval("local value=redis.call('get',KEYS[1]); if value then redis.call('del',KEYS[1]) end; return value", 1, stateKey);
    if (typeof raw !== 'string') return { redirectUrl: callback('error') };
    let adminUserId = '';
    try { adminUserId = String((JSON.parse(raw) as { adminUserId?: string }).adminUserId || ''); } catch { return { redirectUrl: callback('error') }; }
    const member = adminUserId ? await this.prisma.adminUser.findFirst({ where: { id: adminUserId, status: 'ACTIVE', deletedAt: null }, select: { id: true } }) : null;
    if (!member) return { redirectUrl: callback('error') };
    if (input.userStatus !== '2') {
      await this.audit.create({ adminUserId, action: 'CANCEL_TENCENT_USER_TOKEN_AUTH', resourceType: 'tencent_user_tokens', resourceId: adminUserId, ip, userAgent: Array.isArray(userAgent) ? userAgent.join(',') : userAgent });
      return { redirectUrl: callback('cancelled') };
    }
    const token = input.userToken?.trim() || '';
    if (!token || token.length > 4000) return { redirectUrl: callback('error') };
    const expirySeconds = Number(input.expireTime || 0);
    const expiresAt = Number.isFinite(expirySeconds) && expirySeconds > Math.floor(Date.now() / 1000)
      ? new Date(expirySeconds * 1000)
      : new Date(Date.now() + 15 * 86400_000);
    const tokenCipher = this.crypto.encryptText(token);
    await this.prisma.tencentUserToken.upsert({
      where: { adminUserId },
      create: { adminUserId, tokenCipher, expiresAt },
      update: { tokenCipher, expiresAt },
    });
    await this.audit.create({ adminUserId, action: 'COMPLETE_TENCENT_USER_TOKEN_AUTH', resourceType: 'tencent_user_tokens', resourceId: adminUserId, afterJson: { hasUserToken: true, userTokenExpiresAt: expiresAt.toISOString() }, ip, userAgent: Array.isArray(userAgent) ? userAgent.join(',') : userAgent });
    return { redirectUrl: callback('success') };
  }

  async saveMyTencentUserToken(dto: TencentUserTokenDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    if (dto.clearUserToken && dto.userToken?.trim()) throw new BusinessException(400908, '不能同时保存和清除 User Token', 400);
    if (!dto.clearUserToken && !dto.userToken?.trim()) throw new BusinessException(400909, '请输入 User Token 或选择清除', 400);
    const before = await this.myTencentUserToken(user);
    if (dto.clearUserToken) await this.prisma.tencentUserToken.deleteMany({ where: { adminUserId: user.adminUserId } });
    else {
      const expiresAt = dto.userTokenExpiresAt ? new Date(dto.userTokenExpiresAt) : new Date(Date.now() + 15 * 86400_000);
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) throw new BusinessException(400910, 'User Token 已过期，请重新扫码获取', 400);
      const data = { tokenCipher: this.crypto.encryptText(dto.userToken!.trim()), expiresAt };
      await this.prisma.tencentUserToken.upsert({ where: { adminUserId: user.adminUserId }, create: { adminUserId: user.adminUserId, ...data }, update: data });
    }
    const after = await this.myTencentUserToken(user);
    await this.log('UPDATE_TENCENT_USER_TOKEN', 'tencent_user_tokens', user.adminUserId, before, after, user, ip, userAgent);
    return after;
  }

  async savePromotionAccountCredential(accountId: string, dto: PromotionAccountCredentialDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const account = await this.accountOrThrow(accountId, user);
    await this.promotionAccess?.assertCredentialManager(user, account);
    const current = await this.prisma.promotionAccountCredential.findUnique({ where: { accountId } });
    const data = {
      ...(dto.accessToken?.trim() ? { accessTokenCipher: this.crypto.encryptText(normalizeAccessToken(dto.accessToken)) } : {}),
      ...(dto.clientId?.trim() ? { clientId: dto.clientId.trim() } : {}),
      ...(dto.clientSecret?.trim() ? { clientSecretCipher: this.crypto.encryptText(dto.clientSecret.trim()) } : {}),
      ...(dto.refreshToken?.trim() ? { refreshTokenCipher: this.crypto.encryptText(dto.refreshToken.trim()) } : {}),
      ...(dto.userToken?.trim() ? { userTokenCipher: this.crypto.encryptText(dto.userToken.trim()), userTokenExpiresAt: dto.userTokenExpiresAt ? new Date(dto.userTokenExpiresAt) : new Date(Date.now() + 15 * 86400_000) } : {}),
      ...(dto.clearAccessToken ? { accessTokenCipher: null, accessTokenExpiresAt: null } : {}),
      ...(dto.clearClientSecret ? { clientSecretCipher: null } : {}),
      ...(dto.clearRefreshToken ? { refreshTokenCipher: null, refreshTokenExpiresAt: null } : {}),
      ...(dto.clearUserToken ? { userTokenCipher: null, userTokenExpiresAt: null } : {}),
      updatedByAdminId: user.adminUserId,
    };
    const saved = await this.prisma.promotionAccountCredential.upsert({ where: { accountId }, create: { accountId, ...data }, update: data });
    await this.log('UPDATE_PROMOTION_ACCOUNT_CREDENTIAL', 'promotion_account_credentials', accountId, this.safeAccountCredential(current), this.safeAccountCredential(saved), user, ip, userAgent);
    return this.safeAccountCredential(saved);
  }

  async promotionAccountGrants(accountId: string, user: AdminCurrentUser) {
    this.promotionAccess?.assertGrantAdministrator(user);
    await this.accountOrThrow(accountId, user);
    const [members, grants] = await Promise.all([
      this.prisma.adminUser.findMany({ where: { status: 'ACTIVE', deletedAt: null, role: 'STAFF' }, select: { id: true, username: true, nickname: true, role: true }, orderBy: [{ role: 'asc' }, { nickname: 'asc' }] }),
      this.prisma.promotionAccountAccessGrant.findMany({ where: { accountId }, select: { adminUserId: true, canViewData: true, canViewMaterials: true, canViewCreatives: true, canCreateCreatives: true } }),
    ]);
    const byUserId = new Map(grants.map((grant) => [grant.adminUserId, grant]));
    return members.map((member) => ({ ...member, grant: byUserId.get(member.id) || { canViewData: false, canViewMaterials: false, canViewCreatives: false, canCreateCreatives: false } }));
  }

  async savePromotionAccountGrants(accountId: string, dto: PromotionAccountGrantsDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    this.promotionAccess?.assertGrantAdministrator(user);
    await this.accountOrThrow(accountId, user);
    const unique = new Map(dto.grants.map((grant) => [grant.adminUserId, grant]));
    if (unique.size !== dto.grants.length) throw new BusinessException(400904, '授权成员不能重复', 400);
    if (dto.grants.some((grant) => grant.canCreateCreatives && !grant.canViewCreatives)) throw new BusinessException(400906, '授予创意创建权限时必须同时授予创意查看权限', 400);
    const memberIds = [...unique.keys()];
    const validCount = memberIds.length ? await this.prisma.adminUser.count({ where: { id: { in: memberIds }, role: 'STAFF', status: 'ACTIVE', deletedAt: null } }) : 0;
    if (validCount !== memberIds.length) throw new BusinessException(400905, '授权列表包含无效、停用或超级管理员成员', 400);
    const before = await this.prisma.promotionAccountAccessGrant.findMany({ where: { accountId }, select: { adminUserId: true, canViewData: true, canViewMaterials: true, canViewCreatives: true, canCreateCreatives: true } });
    await this.prisma.$transaction(async (tx) => {
      await tx.promotionAccountAccessGrant.deleteMany({ where: { accountId } });
      const enabled = dto.grants.filter((grant) => grant.canViewData || grant.canViewMaterials || grant.canViewCreatives || grant.canCreateCreatives);
      if (enabled.length) await tx.promotionAccountAccessGrant.createMany({ data: enabled.map((grant) => ({ accountId, adminUserId: grant.adminUserId, grantedByAdminId: user.adminUserId, canViewData: grant.canViewData, canViewMaterials: grant.canViewMaterials, canViewCreatives: grant.canViewCreatives, canCreateCreatives: grant.canCreateCreatives })) });
    });
    const after = await this.prisma.promotionAccountAccessGrant.findMany({ where: { accountId }, select: { adminUserId: true, canViewData: true, canViewMaterials: true, canViewCreatives: true, canCreateCreatives: true } });
    await this.log('SET_PROMOTION_ACCOUNT_ACCESS_GRANTS', 'promotion_accounts', accountId, before, after, user, ip, userAgent);
    return { accountId, grants: after };
  }

  async deleteAccount(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    if (user.role !== 'SUPER_ADMIN') throw new BusinessException(403705, '仅超级管理员可删除推广账户，普通成员仅可查看或编辑', 403);
    const before = await this.accountOrThrow(id, user);
    await this.prisma.promotionAccount.delete({ where: { id } });
    await this.log('DELETE_PROMOTION_ACCOUNT', 'promotion_accounts', id, before, undefined, user, ip, userAgent);
    return { id, deleted: true };
  }

  async daily(query: DateRangeQueryDto, user?: AdminCurrentUser) {
    const rows = await this.mergedMetrics(query, user);
    return rows.sort((left, right) => dayjs(right.statDate).valueOf() - dayjs(left.statDate).valueOf() || left.account.name.localeCompare(right.account.name, 'zh-CN')).map((row) => this.metricItem(row));
  }

  async filterData(query: DateRangeQueryDto, user?: AdminCurrentUser) {
    // 筛选项不能依赖所选日期内是否已有日统计，否则默认昨天无数据时项目、渠道和账户都会变成空。
    const [rows, fields, accounts] = await Promise.all([this.daily(query, user), this.fields(), this.accounts(user)]);
    return { rows, fields, accounts };
  }

  async createDaily(dto: PromotionDailyMetricDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    await this.accountOrThrow(dto.accountId, user);
    const existing = await this.prisma.promotionDailyMetric.findUnique({ where: { accountId_statDate: { accountId: dto.accountId, statDate: this.date(dto.statDate) } } });
    if (existing) throw new BusinessException(409701, '该账户当天已有数据，请编辑现有记录', 409);
    const metric = await this.prisma.promotionDailyMetric.create({ data: this.metricData(dto), include: { account: true } });
    const item = this.metricItem(metric);
    await this.log('CREATE_PROMOTION_DAILY_METRIC', 'promotion_daily_metrics', metric.id, undefined, item, user, ip, userAgent);
    return item;
  }

  async updateDaily(id: string, dto: PromotionDailyMetricDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.prisma.promotionDailyMetric.findUnique({ where: { id }, include: { account: true } });
    if (!before) throw new BusinessException(404701, '运营日统计不存在', 404);
    await this.assertAccountScope(before.account, user);
    this.assertArchivedDailyWritable(before, user);
    await this.accountOrThrow(dto.accountId, user);
    const sameDay = await this.prisma.promotionDailyMetric.findUnique({ where: { accountId_statDate: { accountId: dto.accountId, statDate: this.date(dto.statDate) } } });
    if (sameDay && sameDay.id !== id) throw new BusinessException(409701, '该账户当天已有数据，请编辑现有记录', 409);
    const metric = await this.prisma.promotionDailyMetric.update({ where: { id }, data: { ...this.metricData(dto), syncSource: 'MANUAL' }, include: { account: true } });
    const item = this.metricItem(metric);
    await this.log('UPDATE_PROMOTION_DAILY_METRIC', 'promotion_daily_metrics', id, this.metricItem(before), item, user, ip, userAgent);
    return item;
  }

  async deleteDaily(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    if (user.role !== 'SUPER_ADMIN') throw new BusinessException(403705, '仅超级管理员可删除日统计，普通成员仅可查看或编辑', 403);
    const before = await this.prisma.promotionDailyMetric.findUnique({ where: { id }, include: { account: true } });
    if (!before) throw new BusinessException(404701, '运营日统计不存在', 404);
    await this.assertAccountScope(before.account, user);
    this.assertArchivedDailyWritable(before, user);
    await this.prisma.promotionDailyMetric.delete({ where: { id } });
    await this.log('DELETE_PROMOTION_DAILY_METRIC', 'promotion_daily_metrics', id, this.metricItem(before), undefined, user, ip, userAgent);
    return { id, deleted: true };
  }

  async archiveDaily(id: string, dto: ArchivePromotionDailyMetricDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.prisma.promotionDailyMetric.findUnique({ where: { id }, include: { account: true } });
    if (!before) throw new BusinessException(404701, '运营日统计不存在', 404);
    await this.assertAccountScope(before.account, user);
    this.assertArchivedDailyWritable(before, user);
    const metric = await this.prisma.promotionDailyMetric.update({ where: { id }, data: { isArchived: Boolean(dto.isArchived) }, include: { account: true } });
    const item = this.metricItem(metric);
    await this.log(dto.isArchived ? 'ARCHIVE_PROMOTION_DAILY_METRIC' : 'UNARCHIVE_PROMOTION_DAILY_METRIC', 'promotion_daily_metrics', id, this.metricItem(before), item, user, ip, userAgent);
    return item;
  }

  async syncConfigs() {
    const defaults = [
      { provider: 'TENCENT_ADS', reportUrl: 'https://api.e.qq.com/v3.0/daily_reports/get' },
      { provider: 'OCEANENGINE', reportUrl: 'https://ad.oceanengine.com/open_api/2/report/custom/get/' }
    ];
    await this.prisma.promotionDataSyncConfig.updateMany({
      where: { provider: 'TENCENT_ADS', reportUrl: { in: ['https://api.e.qq.com/v1.3/report/advertiser_daily', 'https://api.e.qq.com/v1.3/daily_reports/get'] } },
      data: { reportUrl: 'https://api.e.qq.com/v3.0/daily_reports/get' },
    });
    await Promise.all(defaults.map((item) => this.prisma.promotionDataSyncConfig.upsert({ where: { provider: item.provider }, update: {}, create: item })));
    const rows = await this.prisma.promotionDataSyncConfig.findMany({ orderBy: { provider: 'asc' } });
    return rows.map((row) => {
      const extra = (row.extraConfig || {}) as { clientId?: string; clientSecretCipher?: string; refreshTokenCipher?: string; userTokenCipher?: string; userTokenExpiresAt?: string; authorizedAccountId?: string; accessTokenExpiresAt?: string; refreshTokenExpiresAt?: string };
      return {
        ...row,
        accessTokenCipher: undefined,
        extraConfig: undefined,
        hasAccessToken: Boolean(row.accessTokenCipher),
        clientId: extra.clientId || '', hasClientSecret: Boolean(extra.clientSecretCipher), hasRefreshToken: Boolean(extra.refreshTokenCipher), hasUserToken: Boolean(extra.userTokenCipher),
        userTokenExpiresAt: extra.userTokenExpiresAt || null, authorizedAccountId: extra.authorizedAccountId || null,
        accessTokenExpiresAt: extra.accessTokenExpiresAt || null, refreshTokenExpiresAt: extra.refreshTokenExpiresAt || null,
      };
    });
  }

  async updateSyncConfig(dto: PromotionDataSyncConfigDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.prisma.promotionDataSyncConfig.findUnique({ where: { provider: dto.provider } });
    if ([dto.accessToken, dto.clientSecret, dto.refreshToken, dto.userToken].some((value) => value?.trim())) throw new BusinessException(400906, '令牌必须配置在对应推广账户中，不能再保存到全局同步设置', 400);
    const config = await this.prisma.promotionDataSyncConfig.upsert({
      where: { provider: dto.provider }, create: { provider: dto.provider, enabled: dto.enabled, reportUrl: dto.reportUrl.trim() },
      update: { enabled: dto.enabled, reportUrl: dto.reportUrl.trim() }
    });
    const safeBefore = before ? { ...before, accessTokenCipher: undefined, extraConfig: undefined } : undefined;
    const safeConfig = { ...config, accessTokenCipher: undefined, extraConfig: undefined };
    await this.log('UPDATE_PROMOTION_SYNC_CONFIG', 'promotion_data_sync_configs', config.id, safeBefore, safeConfig, user, ip, userAgent);
    return { ...safeConfig, hasAccessToken: false, clientId: '', hasClientSecret: false, hasRefreshToken: false, hasUserToken: false, userTokenExpiresAt: null };
  }

  async tencentBusinessUnitCredential(user: AdminCurrentUser) {
    this.promotionAccess?.assertGrantAdministrator(user);
    if (!this.promotionAccess && !['SUPER_ADMIN', 'MANAGER'].includes(user.role)) throw new BusinessException(403903, '仅管理员可维护业务单元授权', 403);
    const [config, accounts] = await Promise.all([
      this.prisma.promotionDataSyncConfig.findUnique({ where: { provider: 'TENCENT_ADS' } }),
      this.prisma.promotionAccount.findMany({ where: { status: 'ACTIVE', platform: { contains: '腾讯' }, accountNo: { not: null } }, select: { id: true, accountNo: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    const extra = (config?.extraConfig || {}) as SyncExtraConfig;
    const covered = Array.isArray(extra.sharedAccountNos) ? new Set(extra.sharedAccountNos) : null;
    return {
      hasAccessToken: Boolean(config?.accessTokenCipher),
      hasRefreshToken: Boolean(extra.refreshTokenCipher),
      hasClientSecret: Boolean(extra.clientSecretCipher),
      clientId: extra.clientId || '',
      updatedAt: config?.updatedAt || null,
      accounts: accounts.map((account) => ({ id: account.id, accountNo: account.accountNo, name: account.name, covered: covered ? covered.has(String(account.accountNo)) : Boolean(config?.accessTokenCipher) })),
    };
  }

  async updateTencentBusinessUnitCredential(dto: TencentBusinessUnitCredentialDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    this.promotionAccess?.assertGrantAdministrator(user);
    if (!this.promotionAccess && !['SUPER_ADMIN', 'MANAGER'].includes(user.role)) throw new BusinessException(403903, '仅管理员可维护业务单元授权', 403);
    const clientId = dto.clientId?.trim();
    const clientSecret = dto.clientSecret?.trim();
    const accessToken = normalizeAccessToken(dto.accessToken);
    const refreshToken = dto.refreshToken?.trim();
    if (!clientId || !clientSecret || !accessToken || !refreshToken) throw new BusinessException(400926, '请完整填写应用 ID、Client Secret、Access Token 和 Refresh Token', 400);
    const accounts = await this.prisma.promotionAccount.findMany({ where: { status: 'ACTIVE', platform: { contains: '腾讯' }, accountNo: { not: null } }, select: { accountNo: true, name: true }, orderBy: { name: 'asc' } });
    if (!accounts.length) throw new BusinessException(400927, '没有可校验的腾讯推广账户', 400);
    const validation = await this.syncService.validateTencentBusinessUnitAccess(accessToken, accounts.map((account) => ({ accountNo: String(account.accountNo), name: account.name })));
    if (!validation.covered.length) throw new BusinessException(400928, '新令牌无法读取任何启用的腾讯账户，未保存授权', 400);
    const before = await this.prisma.promotionDataSyncConfig.findUnique({ where: { provider: 'TENCENT_ADS' } });
    const previousExtra = (before?.extraConfig || {}) as SyncExtraConfig;
    const extra: SyncExtraConfig = {
      ...previousExtra,
      clientId,
      clientSecretCipher: this.crypto.encryptText(clientSecret),
      refreshTokenCipher: this.crypto.encryptText(refreshToken),
      sharedAccountNos: validation.covered.map((item) => item.accountNo),
    };
    const saved = await this.prisma.promotionDataSyncConfig.upsert({
      where: { provider: 'TENCENT_ADS' },
      create: { provider: 'TENCENT_ADS', enabled: true, reportUrl: 'https://api.e.qq.com/v3.0/daily_reports/get', accessTokenCipher: this.crypto.encryptText(accessToken), extraConfig: extra as Prisma.InputJsonValue },
      update: { enabled: true, accessTokenCipher: this.crypto.encryptText(accessToken), extraConfig: extra as Prisma.InputJsonValue },
    });
    await this.log('UPDATE_TENCENT_BUSINESS_UNIT_CREDENTIAL', 'promotion_data_sync_configs', saved.id,
      { coveredAccountNos: ((before?.extraConfig || {}) as SyncExtraConfig).sharedAccountNos || [], hasAccessToken: Boolean(before?.accessTokenCipher) },
      { coveredAccountNos: extra.sharedAccountNos, hasAccessToken: true, rejectedAccountNos: validation.rejected.map((item) => item.accountNo) }, user, ip, userAgent);
    return { covered: validation.covered, rejected: validation.rejected, updatedAt: saved.updatedAt };
  }

  async syncDaily(dto: SyncPromotionDailyMetricsDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const accessible = await this.prisma.promotionAccount.findMany({ where: await this.accountScope(user), select: { id: true } });
    const accessibleIds = new Set(accessible.map((item) => item.id));
    const requestedIds = dto.accountIds?.length ? [...new Set(dto.accountIds)] : [...accessibleIds];
    if (requestedIds.some((id) => !accessibleIds.has(id))) throw new BusinessException(403706, '同步请求中包含超出当前数据范围的推广账户', 403);
    const result = await this.syncService.sync(dto.statDate, dto.provider, requestedIds);
    await this.log('SYNC_PROMOTION_DAILY_METRICS', 'promotion_daily_metrics', dto.statDate, undefined, result, user, ip, userAgent);
    return result;
  }

  async healthAccounts(user: AdminCurrentUser) {
    const [accounts, configs] = await Promise.all([
      this.prisma.promotionAccount.findMany({
        where: { AND: [await this.accountScope(user, 'DATA'), { status: ContentStatus.ACTIVE }] },
        orderBy: [{ platform: 'asc' }, { project: 'asc' }, { name: 'asc' }, { accountNo: 'asc' }],
      }),
      this.syncConfigs(),
    ]);
    const credentials = await this.prisma.promotionAccountCredential.findMany({ where: { accountId: { in: accounts.map((account) => account.id) } }, select: { accountId: true, accessTokenCipher: true, clientId: true, clientSecretCipher: true, refreshTokenCipher: true, userTokenCipher: true, userTokenExpiresAt: true } });
    const credentialMap = new Map(credentials.map((credential) => [credential.accountId, credential]));
    const tencentConfig = await this.prisma.promotionDataSyncConfig.findUnique({ where: { provider: 'TENCENT_ADS' } });
    const sharedUserToken = await this.prisma.tencentUserToken.findUnique({ where: { adminUserId: user.adminUserId } });
    const accountResults = await Promise.all(accounts.map(async (account) => {
      const credential = credentialMap.get(account.id);
      const credentialStatus = account.platform.includes('腾讯') ? this.syncService.credentialStatus(credential, tencentConfig, sharedUserToken, account.accountNo) : {
        authorized: Boolean(credential?.accessTokenCipher || (credential?.clientId && credential?.clientSecretCipher && credential?.refreshTokenCipher)),
        hasUserToken: Boolean(credential?.userTokenCipher && (!credential.userTokenExpiresAt || credential.userTokenExpiresAt > new Date())),
      };
      const authorized = Boolean((account.platform.includes('腾讯') ? tencentConfig?.enabled : true) && credentialStatus.authorized);
      const hasUserToken = credentialStatus.hasUserToken;
      return { ...account, authorized, hasUserToken, canCreate: authorized && hasUserToken && (this.promotionAccess ? await this.promotionAccess.canCreateCreatives(user, account) : true) };
    }));
    return {
      accounts: accountResults,
      connections: configs.map((item) => ({
        provider: item.provider,
        enabled: item.enabled,
        connected: item.enabled && accountResults.some((account) => account.platform.includes(item.provider === 'TENCENT_ADS' ? '腾讯' : '巨量') && account.authorized),
        lastSyncedAt: item.lastSyncedAt,
        lastSyncMessage: item.lastSyncMessage,
      })),
    };
  }

  async analyzeHealth(dto: PromotionHealthAnalyzeDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const dateFrom = dayjs(dto.dateFrom).startOf('day');
    const dateTo = dayjs(dto.dateTo).startOf('day');
    if (!dateFrom.isValid() || !dateTo.isValid() || dateTo.isBefore(dateFrom)) throw new BusinessException(400730, '分析日期范围无效', 400);
    const days = dateTo.diff(dateFrom, 'day') + 1;
    if (days > 90) throw new BusinessException(400731, '单次健康分析最长支持 90 天', 400);
    const requestedIds = [...new Set(dto.accountIds)];
    if (requestedIds.length > 50) throw new BusinessException(400732, '单次最多分析 50 个账户', 400);
    const accounts = await this.prisma.promotionAccount.findMany({
      where: { AND: [await this.accountScope(user, 'DATA'), { id: { in: requestedIds }, status: ContentStatus.ACTIVE }] },
      orderBy: [{ platform: 'asc' }, { project: 'asc' }, { name: 'asc' }],
    });
    if (accounts.length !== requestedIds.length) throw new BusinessException(403733, '分析请求包含无权限、已停用或不存在的账户', 403);

    let syncResults: unknown[] = [];
    if (dto.syncEndDate) {
      const tencentIds = accounts.filter((item) => item.platform.includes('腾讯')).map((item) => item.id);
      const oceanIds = accounts.filter((item) => item.platform.includes('巨量')).map((item) => item.id);
      if (tencentIds.length) syncResults.push(...await this.syncDaily({ statDate: dto.dateTo, provider: 'TENCENT_ADS', accountIds: tencentIds }, user, ip, userAgent));
      if (oceanIds.length) syncResults.push(...await this.syncDaily({ statDate: dto.dateTo, provider: 'OCEANENGINE', accountIds: oceanIds }, user, ip, userAgent));
    }

    const previousFrom = dateFrom.subtract(days, 'day');
    const previousTo = dateFrom.subtract(1, 'day');
    const rows = await this.prisma.promotionDailyMetric.findMany({
      where: { accountId: { in: requestedIds }, statDate: { gte: previousFrom.toDate(), lte: dateTo.toDate() } },
      orderBy: { statDate: 'asc' },
    });
    const results = accounts.map((account) => {
      const accountRows = rows.filter((row) => row.accountId === account.id);
      const currentRows = accountRows.filter((row) => !dayjs(row.statDate).isBefore(dateFrom, 'day'));
      const previousRows = accountRows.filter((row) => !dayjs(row.statDate).isBefore(previousFrom, 'day') && !dayjs(row.statDate).isAfter(previousTo, 'day'));
      const current = aggregatePromotionHealth(currentRows);
      const previous = aggregatePromotionHealth(previousRows);
      const recordedDays = new Set(currentRows.map((row) => dayjs(row.statDate).format('YYYY-MM-DD'))).size;
      const diagnosis = diagnosePromotionHealth(current, previous, recordedDays);
      const latestSyncedAt = currentRows.reduce<Date | null>((latest, row) => row.syncedAt && (!latest || row.syncedAt > latest) ? row.syncedAt : latest, null);
      return { account, current, previous, recordedDays, latestSyncedAt, ...diagnosis };
    });
    const scored = results.filter((item) => item.score !== null);
    const overallScore = scored.length ? Math.round(scored.reduce((total, item) => total + Number(item.score), 0) / scored.length) : null;
    const response = {
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      previousDateFrom: previousFrom.format('YYYY-MM-DD'),
      previousDateTo: previousTo.format('YYYY-MM-DD'),
      overallScore,
      summary: {
        healthy: results.filter((item) => item.status === 'HEALTHY').length,
        attention: results.filter((item) => item.status === 'ATTENTION').length,
        risk: results.filter((item) => item.status === 'RISK').length,
        insufficient: results.filter((item) => item.status === 'INSUFFICIENT').length,
      },
      accounts: results,
      syncResults,
      methodology: {
        statement: '曝光、点击、消费和转化等字段采用平台报表口径；健康等级为本系统结合环比趋势与内部运营基线生成，不代表平台官方评级。',
        internalBaselines: { maxCostPerLead: 210, minValidRate: 0.5, trendWarning: 0.2, trendRisk: 0.4 },
        sources: [
          { provider: 'TENCENT_ADS', label: '腾讯广告 Marketing API 日报表', url: 'https://developers.e.qq.com/docs/api/insights/ad_insights/daily_reports' },
          { provider: 'OCEANENGINE', label: '巨量引擎 Marketing API 自定义报表', url: 'https://open.oceanengine.com/tools/visual_debug.html?docId=1741387668314126' },
        ],
      },
    };
    await this.log('ANALYZE_PROMOTION_HEALTH', 'promotion_daily_metrics', `${dto.dateFrom}_${dto.dateTo}`, undefined, { accountIds: requestedIds, overallScore, summary: response.summary, syncEndDate: Boolean(dto.syncEndDate) }, user, ip, userAgent);
    return response;
  }

  async analyzeMaterials(dto: PromotionMaterialAnalyzeDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const dateFrom = dayjs(dto.dateFrom).startOf('day');
    const dateTo = dayjs(dto.dateTo).startOf('day');
    if (!dateFrom.isValid() || !dateTo.isValid() || dateTo.isBefore(dateFrom)) throw new BusinessException(400734, '素材分析日期范围无效', 400);
    if (dateTo.diff(dateFrom, 'day') + 1 > 90) throw new BusinessException(400735, '单次素材分析最长支持 90 天', 400);
    if (!dto.provider && !dto.accountId) throw new BusinessException(400736, '请选择需要分析的业务单元', 400);
    const requestedAccount = dto.accountId ? await this.prisma.promotionAccount.findFirst({
      where: { AND: [await this.accountScope(user, 'MATERIALS'), { id: dto.accountId, status: ContentStatus.ACTIVE }] },
    }) : null;
    if (dto.accountId && !requestedAccount) throw new BusinessException(403736, '账户不存在、已停用或超出当前数据范围', 403);
    const provider = dto.provider || (requestedAccount?.platform.includes('腾讯') ? 'TENCENT_ADS' : requestedAccount?.platform.includes('巨量') ? 'OCEANENGINE' : null);
    if (!provider) throw new BusinessException(400738, '该账户渠道暂不支持平台素材分析', 400);
    const platformKeyword = provider === 'TENCENT_ADS' ? '腾讯' : '巨量';
    const accounts = requestedAccount ? [requestedAccount] : await this.prisma.promotionAccount.findMany({
      where: { AND: [await this.accountScope(user, 'MATERIALS'), { status: ContentStatus.ACTIVE, platform: { contains: platformKeyword }, accountNo: { not: null } }] },
      orderBy: [{ project: 'asc' }, { name: 'asc' }, { accountNo: 'asc' }],
    });
    if (!accounts.length) throw new BusinessException(400737, `当前数据范围内没有已填写户号的${platformKeyword}启用账户`, 400);
    if (accounts.length > 50) throw new BusinessException(400740, '单个业务单元最多支持分析 50 个账户，请先缩小当前数据范围', 400);

    const fetchedResults: Array<{ account: typeof accounts[number]; fetched: Awaited<ReturnType<PromotionDataSyncService['fetchMaterialAnalysis']>> }> = [];
    const requestWarnings: string[] = [];
    for (const account of accounts) {
      try {
        const fetched = await this.syncService.fetchMaterialAnalysis(provider, String(account.accountNo), dto.dateFrom, dto.dateTo);
        fetchedResults.push({ account, fetched });
      } catch (error) {
        requestWarnings.push(`${account.name}（${account.accountNo}）：${error instanceof Error ? error.message : '平台素材接口请求失败'}`);
      }
    }
    if (!fetchedResults.length) throw new BusinessException(502739, requestWarnings.join('；') || '平台素材接口请求失败', 502);
    const items = fetchedResults.flatMap(({ account, fetched }) => fetched.items.map((item) => ({
      ...item,
      id: `${account.id}:${item.id}`,
      sourceId: item.id,
      account: { id: account.id, name: account.name, accountNo: account.accountNo, project: account.project, platform: account.platform },
      ...diagnosePromotionMaterial(item),
    })));
    const coverage = (['VIDEO', 'IMAGE', 'COPY', 'LANDING_PAGE', 'BRAND', 'ACTION_BUTTON', 'MINI_CARD_LINK', 'TEXT_LINK', 'FLOATING_ZONE', 'LABEL', 'SOCIAL_SKILL'] as PromotionMaterialType[]).map((type) => {
      const entries = fetchedResults.flatMap(({ fetched }) => fetched.coverage.filter((item) => item.type === type));
      const availableAccounts = entries.filter((item) => item.available).length;
      const metricAccounts = entries.filter((item) => item.metricsAvailable).length;
      return {
        type,
        available: availableAccounts > 0,
        metricsAvailable: metricAccounts > 0,
        message: `${availableAccounts}/${accounts.length} 个账户返回配置，${metricAccounts}/${accounts.length} 个账户返回独立效果指标`,
      };
    });
    const warnings = [...requestWarnings, ...fetchedResults.flatMap(({ account, fetched }) => fetched.warnings.map((message) => `${account.name}（${account.accountNo}）：${message}`))];
    const types: PromotionMaterialType[] = ['VIDEO', 'IMAGE', 'COPY', 'LANDING_PAGE', 'BRAND', 'ACTION_BUTTON', 'MINI_CARD_LINK', 'TEXT_LINK', 'FLOATING_ZONE', 'LABEL', 'SOCIAL_SKILL'];
    const summary = {
      total: items.length,
      healthy: items.filter((item) => item.health === 'HEALTHY').length,
      attention: items.filter((item) => item.health === 'ATTENTION').length,
      risk: items.filter((item) => item.health === 'RISK').length,
      unassessed: items.filter((item) => item.health === 'UNASSESSED').length,
      byType: Object.fromEntries(types.map((type) => [type, items.filter((item) => item.type === type).length])),
    };
    const response = {
      businessUnit: { provider, name: requestedAccount ? `${requestedAccount.name}（单账户）` : provider === 'TENCENT_ADS' ? '腾讯广告业务单元' : '巨量引擎业务单元', accountCount: accounts.length, analyzedAccountCount: fetchedResults.length },
      accounts: accounts.map((account) => ({ id: account.id, name: account.name, accountNo: account.accountNo, project: account.project, platform: account.platform })),
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      summary,
      items,
      coverage,
      warnings,
      methodology: {
        statement: '素材效果指标采用平台接口返回口径；健康等级及建议由本系统根据效果数据、素材状态与内部成本基线生成，不代表平台官方评级。未提供独立归因的类型仅做配置检查。',
        sources: [
          { provider: 'TENCENT_ADS', label: '腾讯广告 Marketing API 官方 SDK', url: 'https://github.com/TencentAd/marketing-api-go-sdk' },
          { provider: 'OCEANENGINE', label: '巨量引擎：获取投放项目下素材', url: 'https://open.oceanengine.com/labels/43/docs/1854927239666825' },
          { provider: 'OCEANENGINE', label: '巨量引擎：获取低效素材', url: 'https://open.oceanengine.com/labels/7/docs/1733880964883467' },
        ],
      },
    };
    await this.log('ANALYZE_PROMOTION_MATERIALS', 'promotion_accounts', provider, undefined, { dateFrom: dto.dateFrom, dateTo: dto.dateTo, provider, accountIds: accounts.map((item) => item.id), summary, warnings }, user, ip, userAgent);
    return response;
  }

  async summary(query: DateRangeQueryDto, unit: SummaryUnit, user?: AdminCurrentUser) {
    if (unit === 'week' && query.dateFrom && query.dateTo) return this.customRangeSummary(query, user);
    // 先按账户取完整历史，再用日期范围决定展示哪些自然周/月；这样不会把一个自然周期截成半周或半月。
    const rows = await this.mergedMetrics({ accountId: query.accountId, accountName: query.accountName, project: query.project, platform: query.platform }, user);
    const selectedKeys = new Set(rows
      .filter((row) => this.inDateRange(dayjs(row.statDate).format('YYYY-MM-DD'), query))
      .map((row) => `${unit === 'week' ? this.monday(dayjs(row.statDate).format('YYYY-MM-DD')) : dayjs(row.statDate).startOf('month').format('YYYY-MM-DD')}:${this.accountGroupKey(row.account)}`));
    const groups = new Map<string, ReturnType<OperationsService['newSummary']>>();
    for (const row of rows) {
      const date = dayjs(row.statDate).format('YYYY-MM-DD');
      const start = unit === 'week' ? this.monday(date) : dayjs(date).startOf('month').format('YYYY-MM-DD');
      const key = `${start}:${this.accountGroupKey(row.account)}`;
      const group = groups.get(key) || this.newSummary(start, unit, row.account);
      this.addToSummary(group, row);
      groups.set(key, group);
    }
    return Array.from(groups.values())
      .filter((row) => selectedKeys.has(`${row.periodStart}:${this.accountGroupKey(row.account)}`))
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart) || a.account.name.localeCompare(b.account.name))
      .map((row) => {
        const current = this.normalizedSummary(row);
        const previousStart = unit === 'week' ? dayjs(row.periodStart).subtract(7, 'day').format('YYYY-MM-DD') : dayjs(row.periodStart).subtract(1, 'month').format('YYYY-MM-DD');
        const previous = groups.get(`${previousStart}:${this.accountGroupKey(row.account)}`);
        const previousNormalized = previous ? this.normalizedSummary(previous) : null;
        return { ...current, calculated: this.calculated(current), previous: previousNormalized ? { ...previousNormalized, calculated: this.calculated(previousNormalized) } : null };
      });
  }

  private async customRangeSummary(query: DateRangeQueryDto, user?: AdminCurrentUser) {
    const dateFrom = query.dateFrom!;
    const dateTo = query.dateTo!;
    const dayCount = Math.max(1, dayjs(dateTo).diff(dayjs(dateFrom), 'day') + 1);
    const previousFrom = dayjs(dateFrom).subtract(dayCount, 'day').format('YYYY-MM-DD');
    const previousTo = dayjs(dateFrom).subtract(1, 'day').format('YYYY-MM-DD');
    const rows = await this.mergedMetrics({ ...query, dateFrom: previousFrom, dateTo }, user);
    const currentGroups = new Map<string, ReturnType<OperationsService['newRangeSummary']>>();
    const previousGroups = new Map<string, ReturnType<OperationsService['newRangeSummary']>>();
    for (const row of rows) {
      const date = dayjs(row.statDate).format('YYYY-MM-DD');
      const target = date >= dateFrom ? currentGroups : previousGroups;
      const rangeStart = date >= dateFrom ? dateFrom : previousFrom;
      const rangeEnd = date >= dateFrom ? dateTo : previousTo;
      const key = this.accountGroupKey(row.account);
      const group = target.get(key) || this.newRangeSummary(rangeStart, rangeEnd, row.account);
      this.addToSummary(group, row);
      target.set(key, group);
    }
    return Array.from(currentGroups.values())
      .sort((a, b) => a.account.name.localeCompare(b.account.name, 'zh-CN'))
      .map((row) => {
        const current = this.normalizedSummary(row);
        const previous = previousGroups.get(this.accountGroupKey(row.account));
        const previousNormalized = previous ? this.normalizedSummary(previous) : null;
        return { ...current, calculated: this.calculated(current), previous: previousNormalized ? { ...previousNormalized, calculated: this.calculated(previousNormalized) } : null };
      });
  }

  private accountData(dto: PromotionAccountDto) {
    return { name: dto.name.trim(), project: dto.project, platform: dto.platform.trim(), accountNo: dto.accountNo?.trim() || null, status: dto.status || ContentStatus.ACTIVE, remark: dto.remark?.trim() || null };
  }

  private async ensureDefaultFields() {
    const defaults = [
      ['spend', '消费', 10], ['impressions', '展现', 20], ['clicks', '点击', 30], ['clickRate', '点击率', 40], ['leads', '总表单', 50], ['validLeads', '有效表单', 60], ['validRate', '有效率', 70], ['averageCost', '平均成本', 80], ['validCost', '有效成本', 90], ['appointments', '到院', 100], ['transactions', '成交', 110], ['transactionAmount', '成交金额', 115], ['conversionRate', '成交率', 120], ['arrivalRate', '到诊率', 130], ['validArrivalRate', '有效到诊率', 140], ['arrivalCost', '到院成本', 150], ['revenue', '实收', 160], ['roi', '投产比', 170],
    ] as const;
    await Promise.all(defaults.map(([key, label, sort]) => this.prisma.promotionMetricField.upsert({ where: { key }, update: {}, create: { key, label, source: 'SYSTEM', dataType: 'NUMBER', sort } })));
  }

  private metricData(dto: PromotionDailyMetricDto): Prisma.PromotionDailyMetricUncheckedCreateInput {
    return { accountId: dto.accountId, statDate: this.date(dto.statDate), spend: dto.spend, impressions: dto.impressions, clicks: dto.clicks, leads: dto.leads, validLeads: dto.validLeads, appointments: dto.appointments, transactions: dto.transactions, revenue: 0, customMetrics: (dto.customMetrics && Object.keys(dto.customMetrics).length ? dto.customMetrics : Prisma.JsonNull), remark: dto.remark?.trim() || null };
  }

  private async dateWhere(query: DateRangeQueryDto, user?: AdminCurrentUser): Promise<Prisma.PromotionDailyMetricWhereInput> {
    const where: Prisma.PromotionDailyMetricWhereInput = {};
    where.account = await this.accountFilter(query, user);
    if (query.accountId) where.accountId = query.accountId;
    if (query.dateFrom || query.dateTo) {
      where.statDate = {};
      if (query.dateFrom) where.statDate.gte = this.date(query.dateFrom);
      if (query.dateTo) where.statDate.lte = this.date(query.dateTo);
    }
    return where;
  }

  /**
   * 患者收费是成交金额、实收金额的唯一统计来源，按账户和日期合并。
   * 到院和成交人数始终使用日统计中的人工录入值，不能根据收费记录或手机号推导。
   */
  private async mergedMetrics(query: DateRangeQueryDto, user?: AdminCurrentUser): Promise<any[]> {
    const metrics = await this.prisma.promotionDailyMetric.findMany({ where: await this.dateWhere(query, user), include: { account: true }, orderBy: [{ statDate: 'asc' }, { account: { name: 'asc' } }] });
    const arrivalDelegate = (this.prisma as any).promotionArrivalPatient;
    if (!arrivalDelegate?.findMany) return metrics;
    const account = await this.accountFilter(query, user);
    const arrivals = await arrivalDelegate.findMany({
      where: {
        account: account,
        ...(query.accountId ? { accountId: query.accountId } : {}),
        ...(query.dateFrom || query.dateTo ? { arrivalDate: {
          ...(query.dateFrom ? { gte: this.date(query.dateFrom) } : {}),
          ...(query.dateTo ? { lte: this.date(query.dateTo) } : {}),
        } } : {}),
      },
      include: { account: true },
      orderBy: { arrivalDate: 'asc' },
    });
    const byKey = new Map<string, any>();
    for (const metric of metrics) {
      const key = `${metric.accountId}:${dayjs(metric.statDate).format('YYYY-MM-DD')}`;
      byKey.set(key, { ...metric, transactionAmount: 0, revenue: 0, patientOnly: false });
    }
    for (const patient of arrivals) {
      const date = dayjs(patient.arrivalDate).format('YYYY-MM-DD');
      const key = `${patient.accountId}:${date}`;
      const current = byKey.get(key) || {
        id: `arrival:${key}`, accountId: patient.accountId, statDate: patient.arrivalDate,
        spend: 0, impressions: 0, clicks: 0, leads: 0, validLeads: 0, appointments: 0, transactions: 0, revenue: 0,
        transactionAmount: 0, customMetrics: {}, remark: null, syncSource: 'ARRIVAL_PATIENTS', syncedAt: null, isArchived: false,
        createdAt: patient.createdAt, updatedAt: patient.updatedAt, account: patient.account, patientOnly: true,
      };
      current.transactionAmount = Number(current.transactionAmount || 0) + Number(patient.transactionAmount || 0);
      current.revenue = Number(current.revenue) + Number(patient.receivedAmount || 0);
      current.chargeRecordCount = Number(current.chargeRecordCount || 0) + 1;
      byKey.set(key, current);
    }
    return Array.from(byKey.values()).sort((left, right) => dayjs(left.statDate).valueOf() - dayjs(right.statDate).valueOf() || left.account.name.localeCompare(right.account.name, 'zh-CN'));
  }

  private inDateRange(date: string, query: DateRangeQueryDto) {
    return (!query.dateFrom || date >= query.dateFrom) && (!query.dateTo || date <= query.dateTo);
  }

  private accountGroupKey(account: { project: string; platform: string; name: string }) {
    return JSON.stringify([account.project, account.platform, account.name]);
  }

  private async accountFilter(query: DateRangeQueryDto, user?: AdminCurrentUser): Promise<Prisma.PromotionAccountWhereInput> {
    const scope = await this.accountScope(user);
    const selection = {
      ...(query.accountName ? { name: query.accountName } : {}),
      ...(query.project ? { project: query.project } : {}),
      ...(query.platform ? { platform: query.platform } : {}),
    };
    return Object.keys(selection).length ? { AND: [scope, selection] } : scope;
  }

  private reportProjectOrder(project: string) {
    if (project.includes('重庆')) return 10;
    if (project.includes('绵阳')) return 20;
    return 100;
  }

  private reportChannelOrder(channel: string) {
    if (channel.includes('腾讯')) return 10;
    if (channel.includes('本地')) return 20;
    return 100;
  }

  private reportMetric(metric: any) {
    const conversions = metric.leads; const invalid = Math.max(0, metric.leads - metric.validLeads); const spend = Number(metric.spend);
    return { accountId: metric.accountId, accountName: metric.account.name, accountNo: metric.account.accountNo, statDate: dayjs(metric.statDate).format('YYYY-MM-DD'), conversions, spend, conversionCost: conversions ? spend / conversions : null, invalid, invalidRate: conversions ? invalid / conversions : null };
  }

  private mergeReportAccounts(items: Array<{ accountId: string; accountName: string; accountNo: string | null; statDate: string; conversions: number; spend: number; invalid: number }>) {
    const merged = new Map<string, { accountId: string; accountName: string; accountNos: Set<string>; conversions: number; spend: number; invalid: number; recordedDates: Set<string> }>();
    for (const item of items) {
      // A report channel already isolates project and platform; the account name is its logical key.
      const key = item.accountName;
      const current = merged.get(key) || { accountId: item.accountId, accountName: item.accountName, accountNos: new Set<string>(), conversions: 0, spend: 0, invalid: 0, recordedDates: new Set<string>() };
      current.conversions += item.conversions;
      current.spend += item.spend;
      current.invalid += item.invalid;
      current.recordedDates.add(item.statDate);
      if (item.accountNo?.trim()) current.accountNos.add(item.accountNo.trim());
      merged.set(key, current);
    }
    return Array.from(merged.values()).map(({ recordedDates, accountNos, ...item }) => {
      const recordedDays = recordedDates.size;
      return { ...item, accountNo: [...accountNos].join('、') || null, spend: this.money(item.spend), conversionCost: item.conversions ? this.money(item.spend / item.conversions) : null, invalidRate: item.conversions ? item.invalid / item.conversions : null, recordedDays, averageDailyConversions: recordedDays ? this.money(item.conversions / recordedDays) : null };
    });
  }

  private reportTotals(items: Array<{ statDate: string; conversions: number; spend: number; invalid: number }>) {
    const totals = items.reduce((result, item) => ({ conversions: result.conversions + item.conversions, spend: result.spend + item.spend, invalid: result.invalid + item.invalid }), { conversions: 0, spend: 0, invalid: 0 });
    const spend = this.money(totals.spend);
    const recordedDays = new Set(items.map((item) => item.statDate)).size;
    return { ...totals, spend, conversionCost: totals.conversions ? this.money(spend / totals.conversions) : null, invalidRate: totals.conversions ? totals.invalid / totals.conversions : null, recordedDays, averageDailyConversions: recordedDays ? this.money(totals.conversions / recordedDays) : null };
  }

  private autoProblem(totals: { conversions: number; invalidRate: number | null; conversionCost: number | null }) {
    if (!totals.conversions) return '当日暂无转化，需检查账户投放状态';
    const validRate = 1 - (totals.invalidRate || 0);
    const costTooHigh = (totals.conversionCost || 0) > 210;
    if (validRate > 0.5 && !costTooHigh) return '账户正常';
    if (validRate > 0.5 && costTooHigh) return '表单成本过高';
    if (costTooHigh) return '有效率偏低且表单成本过高';
    return '有效率偏低';
  }

  private autoAdjustment(totals: { conversions: number; invalidRate: number | null; conversionCost: number | null }) {
    if (!totals.conversions) return '检查预算、计划状态、素材及落地页后再调整投放';
    const validRate = 1 - (totals.invalidRate || 0);
    const costTooHigh = (totals.conversionCost || 0) > 210;
    if (validRate > 0.5 && !costTooHigh) return '保持当前投放策略，持续观察账户表现';
    if (validRate > 0.5 && costTooHigh) return '有效率正常，优化出价、定向和素材，降低表单成本';
    if (costTooHigh) return '优先优化线索质量，并调整出价、定向和素材以降低表单成本';
    return '优化定向、素材和落地页，提高有效表单占比';
  }

  private addToSummary(target: ReturnType<OperationsService['newSummary']>, row: { statDate: Date; spend: Prisma.Decimal | number; impressions: number; clicks: number; leads: number; validLeads: number; appointments: number; transactions: number; transactionAmount?: Prisma.Decimal | number; revenue: Prisma.Decimal | number; customMetrics?: Prisma.JsonValue | null }) {
    target.spend += Number(row.spend); target.impressions += row.impressions; target.clicks += row.clicks; target.leads += row.leads; target.validLeads += row.validLeads; target.appointments += row.appointments; target.transactions += row.transactions; target.transactionAmount += Number(row.transactionAmount || 0); target.revenue += Number(row.revenue);
    target.recordedDates.add(dayjs(row.statDate).format('YYYY-MM-DD'));
    target.days = target.recordedDates.size;
    const metrics = row.customMetrics && typeof row.customMetrics === 'object' && !Array.isArray(row.customMetrics) ? row.customMetrics : {};
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value === 'number' && Number.isFinite(value)) target.customMetrics[key] = Number(target.customMetrics[key] || 0) + value;
      else if (typeof value === 'string' && value.trim()) target.customMetrics[key] = value;
    }
  }

  private normalizedSummary<T extends { spend: number; transactionAmount?: number; revenue: number; recordedDates: Set<string> }>(row: T) {
    const { recordedDates: _recordedDates, ...values } = row;
    return { ...values, spend: this.money(row.spend), transactionAmount: this.money(row.transactionAmount || 0), revenue: this.money(row.revenue) };
  }

  private async salaryConfig(): Promise<SalaryConfig> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'promotionSalaryRules' } });
    return this.normalizeSalaryConfig(row?.valueJson);
  }

  private normalizeSalaryConfig(value: unknown): SalaryConfig {
    const source = value && typeof value === 'object' ? value as Record<string, any> : {};
    const fallback = JSON.parse(JSON.stringify(DEFAULT_PROMOTION_SALARY_CONFIG)) as SalaryConfig;
    const finite = (input: unknown, defaultValue: number) => Number.isFinite(Number(input)) ? Number(input) : defaultValue;
    const normalizeRegion = (input: unknown, defaultValue: SalaryRegionRule): SalaryRegionRule => {
      const region = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      return {
        minDailyLeads: Math.max(0, finite(region.minDailyLeads, defaultValue.minDailyLeads)),
        minValidRate: Math.min(1, Math.max(0, finite(region.minValidRate, defaultValue.minValidRate))),
        maxAverageCost: Math.max(0, finite(region.maxAverageCost, defaultValue.maxAverageCost)),
      };
    };
    const sourceTiers = Array.isArray(source.tiers) && source.tiers.length ? source.tiers : fallback.tiers;
    const tiers = sourceTiers.map((item: any, index: number) => {
      const defaultTier = fallback.tiers[Math.min(index, fallback.tiers.length - 1)];
      return {
        salary: Math.max(0, Math.round(finite(item?.salary, defaultTier.salary))),
        chongqing: normalizeRegion(item?.chongqing, defaultTier.chongqing),
        mianyang: normalizeRegion(item?.mianyang, defaultTier.mianyang),
      };
    }).sort((left: SalaryTierConfig, right: SalaryTierConfig) => left.salary - right.salary);
    return {
      baseSalary: Math.max(0, Math.round(finite(source.baseSalary, fallback.baseSalary))),
      recentDays: Math.min(31, Math.max(1, Math.round(finite(source.recentDays, fallback.recentDays)))),
      tiers,
    };
  }

  private money(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }

  private date(value: string) { return dayjs(value).startOf('day').toDate(); }
  private monday(value: string) { const date = dayjs(value); return date.subtract((date.day() + 6) % 7, 'day').format('YYYY-MM-DD'); }
  private newSummary(periodStart: string, unit: SummaryUnit, account: { id: string; name: string; project: string; platform: string; accountNo: string | null }) {
    const end = unit === 'week' ? dayjs(periodStart).add(6, 'day').format('YYYY-MM-DD') : dayjs(periodStart).endOf('month').format('YYYY-MM-DD');
    return { periodStart, periodEnd: end, periodLabel: unit === 'week' ? `${periodStart} 至 ${end}` : dayjs(periodStart).format('YYYY年MM月'), account, days: 0, recordedDates: new Set<string>(), spend: 0, impressions: 0, clicks: 0, leads: 0, validLeads: 0, appointments: 0, transactions: 0, transactionAmount: 0, revenue: 0, customMetrics: {} as Record<string, string | number> };
  }
  private newRangeSummary(periodStart: string, periodEnd: string, account: { id: string; name: string; project: string; platform: string; accountNo: string | null }) {
    return { periodStart, periodEnd, periodLabel: `${periodStart} 至 ${periodEnd}`, account, days: 0, recordedDates: new Set<string>(), spend: 0, impressions: 0, clicks: 0, leads: 0, validLeads: 0, appointments: 0, transactions: 0, transactionAmount: 0, revenue: 0, customMetrics: {} as Record<string, string | number> };
  }
  private metricItem(row: any) {
    const item = { ...row, statDate: dayjs(row.statDate).format('YYYY-MM-DD'), spend: Number(row.spend), transactionAmount: Number(row.transactionAmount || 0), revenue: Number(row.revenue), customMetrics: row.customMetrics || {} };
    return { ...item, calculated: this.calculated(item) };
  }
  /** 所有页面共用同一统计口径；分母为 0 时返回 null，避免展示 NaN / Infinity。 */
  private calculated(row: { spend: number; impressions: number; clicks: number; leads: number; validLeads: number; appointments: number; transactions: number; revenue: number }) {
    const divide = (numerator: number, denominator: number) => denominator > 0 ? Number((numerator / denominator).toFixed(6)) : null;
    return {
      clickRate: divide(row.clicks, row.impressions),
      validRate: divide(row.validLeads, row.leads),
      averageCost: divide(row.spend, row.leads),
      validCost: divide(row.spend, row.validLeads),
      conversionRate: divide(row.transactions, row.appointments),
      arrivalRate: divide(row.appointments, row.leads),
      validArrivalRate: divide(row.appointments, row.validLeads),
      arrivalCost: divide(row.spend, row.appointments),
      roi: divide(row.revenue, row.spend)
    };
  }
  private safeAccountCredential(row: any) {
    if (!row) return { hasAccessToken: false, hasClientSecret: false, hasRefreshToken: false, hasUserToken: false };
    return { accountId: row.accountId, clientId: row.clientId || '', authorizedAccountId: row.authorizedAccountId || null, userTokenExpiresAt: row.userTokenExpiresAt || null, accessTokenExpiresAt: row.accessTokenExpiresAt || null, refreshTokenExpiresAt: row.refreshTokenExpiresAt || null, hasAccessToken: Boolean(row.accessTokenCipher), hasClientSecret: Boolean(row.clientSecretCipher), hasRefreshToken: Boolean(row.refreshTokenCipher), hasUserToken: Boolean(row.userTokenCipher), lastValidatedAt: row.lastValidatedAt || null, updatedAt: row.updatedAt || null };
  }
  private tencentUserTokenStateKey(state: string) { return `tencent:user-token-auth:${createHash('sha256').update(state).digest('hex')}`; }
  private validHttpsBase(value: string | undefined, name: string) {
    try {
      const url = new URL(String(value || ''));
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('invalid');
      return url.toString().replace(/\/$/, '');
    } catch { throw new BusinessException(503912, `${name} 配置无效，暂不能发起腾讯授权`, 503); }
  }
  private async accountScope(user?: AdminCurrentUser, capability: PromotionAccountCapability = 'DATA'): Promise<Prisma.PromotionAccountWhereInput> {
    if (!user) return {};
    if (this.promotionAccess) return await this.promotionAccess.where(user, capability) as Prisma.PromotionAccountWhereInput;
    if (!this.dataScopes) return {};
    return await this.dataScopes.ownershipWhere(user, 'ownerAdminId', 'createdByAdminId') as Prisma.PromotionAccountWhereInput;
  }
  private async assertAccountScope(account: { id?: string; ownerAdminId?: string | null; createdByAdminId?: string | null }, user: AdminCurrentUser) {
    if (this.promotionAccess && account.id) return this.promotionAccess.assertVisible(user, account as { id: string; ownerAdminId?: string | null; createdByAdminId?: string | null });
    if (this.dataScopes) await this.dataScopes.assertOwned(user, account, 'ownerAdminId', 'createdByAdminId', '无权访问该推广账户数据');
  }
  private async accountOrThrow(id: string, user?: AdminCurrentUser) { const account = await this.prisma.promotionAccount.findUnique({ where: { id } }); if (!account) throw new BusinessException(404700, '推广账户不存在', 404); if (user) await this.assertAccountScope(account, user); return account; }
  private assertArchivedDailyWritable(metric: { isArchived?: boolean }, user: AdminCurrentUser) {
    if (metric.isArchived && user.role !== 'SUPER_ADMIN') {
      throw new BusinessException(403704, '已归档日统计仅超级管理员可修改，当前账号仅可查看', 403);
    }
  }
  private async fieldOrThrow(id: string) { await this.ensureDefaultFields(); const field = await this.prisma.promotionMetricField.findUnique({ where: { id } }); if (!field) throw new BusinessException(404702, '推广数据字段不存在', 404); return field; }
  private log(action: string, resourceType: string, resourceId: string, before: unknown, after: unknown, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) { return this.audit.create({ adminUserId: user.adminUserId, action, resourceType, resourceId, beforeJson: before as Prisma.InputJsonValue, afterJson: after as Prisma.InputJsonValue, ip, userAgent: Array.isArray(userAgent) ? userAgent.join(',') : userAgent }); }
}
