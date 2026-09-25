import { Injectable } from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import { AdminCurrentUser } from '../../common/decorators/current-user.decorator';
import { BusinessException } from '../../common/utils/business-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DateRangeQueryDto, PromotionAccountDto, PromotionDailyMetricDto, PromotionDailyReportNoteDto, PromotionMetricFieldDto } from './dto';

type SummaryUnit = 'week' | 'month';

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogsService) {}

  accounts() {
    return this.prisma.promotionAccount.findMany({ orderBy: [{ status: 'asc' }, { platform: 'asc' }, { name: 'asc' }] });
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

  async dailyReport(date: string) {
    return this.periodReport(date, date, date, 'day');
  }

  async weeklyReport(date: string, dateTo?: string) {
    if (dateTo) return this.periodReport(date, dateTo, date, 'week');
    const start = this.monday(date);
    return this.periodReport(start, dayjs(start).add(6, 'day').format('YYYY-MM-DD'), start, 'week');
  }

  async monthlyReport(date: string) {
    const start = dayjs(date).startOf('month').format('YYYY-MM-DD');
    return this.periodReport(start, dayjs(date).endOf('month').format('YYYY-MM-DD'), start, 'month');
  }

  private async periodReport(dateFrom: string, dateTo: string, noteDate: string, periodType: 'day' | 'week' | 'month') {
    const noteStatDate = this.date(noteDate);
    const [metrics, notes] = await Promise.all([
      this.prisma.promotionDailyMetric.findMany({ where: { statDate: { gte: this.date(dateFrom), lte: this.date(dateTo) } }, include: { account: true }, orderBy: [{ account: { platform: 'asc' } }, { account: { name: 'asc' } }] }),
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
          const totals = this.reportTotals(accounts);
          const note = noteMap.get(`${project}:${channel}`);
          return { channel, accounts, totals, problem: note?.problem || this.autoProblem(totals), adjustment: note?.adjustment || this.autoAdjustment(totals), isManual: Boolean(note) };
        });
        return { project, channels: channelItems, totals: this.reportTotals(channelItems.flatMap((item) => item.accounts)) };
      }),
    };
  }

  async updateDailyReportNote(dto: PromotionDailyReportNoteDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const statDate = this.date(dto.statDate); const periodType = dto.periodType || 'day'; const key = { statDate_periodType_project_channel: { statDate, periodType, project: dto.project.trim(), channel: dto.channel.trim() } };
    const before = await this.prisma.promotionDailyReportNote.findUnique({ where: key });
    const note = await this.prisma.promotionDailyReportNote.upsert({ where: key, create: { statDate, periodType, project: dto.project.trim(), channel: dto.channel.trim(), problem: dto.problem.trim(), adjustment: dto.adjustment.trim() }, update: { problem: dto.problem.trim(), adjustment: dto.adjustment.trim() } });
    await this.log('UPDATE_PROMOTION_DAILY_REPORT_NOTE', 'promotion_daily_report_notes', note.id, before, note, user, ip, userAgent);
    return note;
  }

  async createAccount(dto: PromotionAccountDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const account = await this.prisma.promotionAccount.create({ data: this.accountData(dto) });
    await this.log('CREATE_PROMOTION_ACCOUNT', 'promotion_accounts', account.id, undefined, account, user, ip, userAgent);
    return account;
  }

  async updateAccount(id: string, dto: PromotionAccountDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.accountOrThrow(id);
    const account = await this.prisma.promotionAccount.update({ where: { id }, data: this.accountData(dto) });
    await this.log('UPDATE_PROMOTION_ACCOUNT', 'promotion_accounts', id, before, account, user, ip, userAgent);
    return account;
  }

  async deleteAccount(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.accountOrThrow(id);
    await this.prisma.promotionAccount.delete({ where: { id } });
    await this.log('DELETE_PROMOTION_ACCOUNT', 'promotion_accounts', id, before, undefined, user, ip, userAgent);
    return { id, deleted: true };
  }

  async daily(query: DateRangeQueryDto) {
    const where = this.dateWhere(query);
    const rows = await this.prisma.promotionDailyMetric.findMany({
      where,
      include: { account: true },
      orderBy: [{ statDate: 'desc' }, { account: { name: 'asc' } }]
    });
    return rows.map((row) => this.metricItem(row));
  }

  async createDaily(dto: PromotionDailyMetricDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    await this.accountOrThrow(dto.accountId);
    const existing = await this.prisma.promotionDailyMetric.findUnique({ where: { accountId_statDate: { accountId: dto.accountId, statDate: this.date(dto.statDate) } } });
    if (existing) throw new BusinessException(409701, '该账户当天已有数据，请编辑现有记录', 409);
    const metric = await this.prisma.promotionDailyMetric.create({ data: this.metricData(dto), include: { account: true } });
    const item = this.metricItem(metric);
    await this.log('CREATE_PROMOTION_DAILY_METRIC', 'promotion_daily_metrics', metric.id, undefined, item, user, ip, userAgent);
    return item;
  }

  async updateDaily(id: string, dto: PromotionDailyMetricDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.prisma.promotionDailyMetric.findUnique({ where: { id }, include: { account: true } });
    if (!before) throw new BusinessException(404701, '运营日数据不存在', 404);
    await this.accountOrThrow(dto.accountId);
    const sameDay = await this.prisma.promotionDailyMetric.findUnique({ where: { accountId_statDate: { accountId: dto.accountId, statDate: this.date(dto.statDate) } } });
    if (sameDay && sameDay.id !== id) throw new BusinessException(409701, '该账户当天已有数据，请编辑现有记录', 409);
    const metric = await this.prisma.promotionDailyMetric.update({ where: { id }, data: this.metricData(dto), include: { account: true } });
    const item = this.metricItem(metric);
    await this.log('UPDATE_PROMOTION_DAILY_METRIC', 'promotion_daily_metrics', id, this.metricItem(before), item, user, ip, userAgent);
    return item;
  }

  async deleteDaily(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.prisma.promotionDailyMetric.findUnique({ where: { id }, include: { account: true } });
    if (!before) throw new BusinessException(404701, '运营日数据不存在', 404);
    await this.prisma.promotionDailyMetric.delete({ where: { id } });
    await this.log('DELETE_PROMOTION_DAILY_METRIC', 'promotion_daily_metrics', id, this.metricItem(before), undefined, user, ip, userAgent);
    return { id, deleted: true };
  }

  async summary(query: DateRangeQueryDto, unit: SummaryUnit) {
    // 先按账户取完整历史，再用日期范围决定展示哪些自然周/月；这样不会把一个自然周期截成半周或半月。
    const rows = await this.prisma.promotionDailyMetric.findMany({
      where: query.accountId ? { accountId: query.accountId } : {}, include: { account: true }, orderBy: { statDate: 'asc' }
    });
    const selectedKeys = new Set(rows
      .filter((row) => this.inDateRange(dayjs(row.statDate).format('YYYY-MM-DD'), query))
      .map((row) => `${unit === 'week' ? this.monday(dayjs(row.statDate).format('YYYY-MM-DD')) : dayjs(row.statDate).startOf('month').format('YYYY-MM-DD')}:${row.accountId}`));
    const groups = new Map<string, ReturnType<OperationsService['newSummary']>>();
    for (const row of rows) {
      const date = dayjs(row.statDate).format('YYYY-MM-DD');
      const start = unit === 'week' ? this.monday(date) : dayjs(date).startOf('month').format('YYYY-MM-DD');
      const key = `${start}:${row.accountId}`;
      const group = groups.get(key) || this.newSummary(start, unit, row.account);
      this.addToSummary(group, row);
      groups.set(key, group);
    }
    return Array.from(groups.values())
      .filter((row) => selectedKeys.has(`${row.periodStart}:${row.account.id}`))
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart) || a.account.name.localeCompare(b.account.name))
      .map((row) => {
        const current = this.normalizedSummary(row);
        const previousStart = unit === 'week' ? dayjs(row.periodStart).subtract(7, 'day').format('YYYY-MM-DD') : dayjs(row.periodStart).subtract(1, 'month').format('YYYY-MM-DD');
        const previous = groups.get(`${previousStart}:${row.account.id}`);
        const previousNormalized = previous ? this.normalizedSummary(previous) : null;
        return { ...current, calculated: this.calculated(current), previous: previousNormalized ? { ...previousNormalized, calculated: this.calculated(previousNormalized) } : null };
      });
  }

  private accountData(dto: PromotionAccountDto) {
    return { name: dto.name.trim(), project: dto.project, platform: dto.platform.trim(), accountNo: dto.accountNo?.trim() || null, status: dto.status || ContentStatus.ACTIVE, remark: dto.remark?.trim() || null };
  }

  private async ensureDefaultFields() {
    const defaults = [
      ['spend', '消费', 10], ['impressions', '展现', 20], ['clicks', '点击', 30], ['clickRate', '点击率', 40], ['leads', '总表单', 50], ['validLeads', '有效表单', 60], ['validRate', '有效率', 70], ['averageCost', '平均成本', 80], ['validCost', '有效成本', 90], ['appointments', '到院', 100], ['transactions', '成交', 110], ['conversionRate', '成交率', 120], ['arrivalRate', '到诊率', 130], ['validArrivalRate', '有效到诊率', 140], ['arrivalCost', '到院成本', 150], ['revenue', '实收', 160], ['roi', '投产比', 170],
    ] as const;
    await Promise.all(defaults.map(([key, label, sort]) => this.prisma.promotionMetricField.upsert({ where: { key }, update: {}, create: { key, label, source: 'SYSTEM', dataType: 'NUMBER', sort } })));
  }

  private metricData(dto: PromotionDailyMetricDto): Prisma.PromotionDailyMetricUncheckedCreateInput {
    return { accountId: dto.accountId, statDate: this.date(dto.statDate), spend: dto.spend, impressions: dto.impressions, clicks: dto.clicks, leads: dto.leads, validLeads: dto.validLeads, appointments: dto.appointments, transactions: dto.transactions, revenue: dto.revenue, customMetrics: (dto.customMetrics && Object.keys(dto.customMetrics).length ? dto.customMetrics : Prisma.JsonNull), remark: dto.remark?.trim() || null };
  }

  private dateWhere(query: DateRangeQueryDto): Prisma.PromotionDailyMetricWhereInput {
    const where: Prisma.PromotionDailyMetricWhereInput = {};
    if (query.accountId) where.accountId = query.accountId;
    if (query.dateFrom || query.dateTo) {
      where.statDate = {};
      if (query.dateFrom) where.statDate.gte = this.date(query.dateFrom);
      if (query.dateTo) where.statDate.lte = this.date(query.dateTo);
    }
    return where;
  }

  private inDateRange(date: string, query: DateRangeQueryDto) {
    return (!query.dateFrom || date >= query.dateFrom) && (!query.dateTo || date <= query.dateTo);
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
    return { accountId: metric.accountId, accountName: metric.account.name, accountNo: metric.account.accountNo, conversions, spend, conversionCost: conversions ? spend / conversions : null, invalid, invalidRate: conversions ? invalid / conversions : null };
  }

  private mergeReportAccounts(items: Array<{ accountId: string; accountName: string; accountNo: string | null; conversions: number; spend: number; invalid: number }>) {
    const merged = new Map<string, { accountId: string; accountName: string; accountNo: string | null; conversions: number; spend: number; invalid: number }>();
    for (const item of items) {
      const key = item.accountNo?.trim() ? `no:${item.accountNo.trim()}` : `account:${item.accountId}`;
      const current = merged.get(key) || { ...item, conversions: 0, spend: 0, invalid: 0 };
      current.conversions += item.conversions;
      current.spend += item.spend;
      current.invalid += item.invalid;
      merged.set(key, current);
    }
    return Array.from(merged.values()).map((item) => ({ ...item, spend: this.money(item.spend), conversionCost: item.conversions ? this.money(item.spend / item.conversions) : null, invalidRate: item.conversions ? item.invalid / item.conversions : null }));
  }

  private reportTotals(items: Array<{ conversions: number; spend: number; invalid: number }>) {
    const totals = items.reduce((result, item) => ({ conversions: result.conversions + item.conversions, spend: result.spend + item.spend, invalid: result.invalid + item.invalid }), { conversions: 0, spend: 0, invalid: 0 });
    const spend = this.money(totals.spend);
    return { ...totals, spend, conversionCost: totals.conversions ? this.money(spend / totals.conversions) : null, invalidRate: totals.conversions ? totals.invalid / totals.conversions : null };
  }

  private autoProblem(totals: { conversions: number; invalidRate: number | null }) {
    if (!totals.conversions) return '当日暂无转化，需检查账户投放状态';
    if ((totals.invalidRate || 0) >= 0.6) return '有效率偏低，无效线索占比较高';
    if ((totals.invalidRate || 0) >= 0.4) return '无效线索占比较高，需持续优化';
    return '账户数据表现稳定，继续观察转化质量';
  }

  private autoAdjustment(totals: { conversions: number; invalidRate: number | null }) {
    if (!totals.conversions) return '检查预算、计划状态、素材及落地页后再调整投放';
    if ((totals.invalidRate || 0) >= 0.4) return '优化定向与素材，必要时更换广告策略后持续观察';
    return '保持当前投放策略，持续观察并优化高质量转化';
  }

  private addToSummary(target: ReturnType<OperationsService['newSummary']>, row: { spend: Prisma.Decimal | number; impressions: number; clicks: number; leads: number; validLeads: number; appointments: number; transactions: number; revenue: Prisma.Decimal | number }) {
    target.spend += Number(row.spend); target.impressions += row.impressions; target.clicks += row.clicks; target.leads += row.leads; target.validLeads += row.validLeads; target.appointments += row.appointments; target.transactions += row.transactions; target.revenue += Number(row.revenue); target.days += 1;
  }

  private normalizedSummary<T extends { spend: number; revenue: number }>(row: T) {
    return { ...row, spend: this.money(row.spend), revenue: this.money(row.revenue) };
  }

  private money(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }

  private date(value: string) { return dayjs(value).startOf('day').toDate(); }
  private monday(value: string) { const date = dayjs(value); return date.subtract((date.day() + 6) % 7, 'day').format('YYYY-MM-DD'); }
  private newSummary(periodStart: string, unit: SummaryUnit, account: { id: string; name: string; platform: string; accountNo: string | null }) {
    const end = unit === 'week' ? dayjs(periodStart).add(6, 'day').format('YYYY-MM-DD') : dayjs(periodStart).endOf('month').format('YYYY-MM-DD');
    return { periodStart, periodEnd: end, periodLabel: unit === 'week' ? `${periodStart} 至 ${end}` : dayjs(periodStart).format('YYYY年MM月'), account, days: 0, spend: 0, impressions: 0, clicks: 0, leads: 0, validLeads: 0, appointments: 0, transactions: 0, revenue: 0 };
  }
  private metricItem(row: any) {
    const item = { ...row, statDate: dayjs(row.statDate).format('YYYY-MM-DD'), spend: Number(row.spend), revenue: Number(row.revenue), customMetrics: row.customMetrics || {} };
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
  private async accountOrThrow(id: string) { const account = await this.prisma.promotionAccount.findUnique({ where: { id } }); if (!account) throw new BusinessException(404700, '推广账户不存在', 404); return account; }
  private async fieldOrThrow(id: string) { await this.ensureDefaultFields(); const field = await this.prisma.promotionMetricField.findUnique({ where: { id } }); if (!field) throw new BusinessException(404702, '推广数据字段不存在', 404); return field; }
  private log(action: string, resourceType: string, resourceId: string, before: unknown, after: unknown, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) { return this.audit.create({ adminUserId: user.adminUserId, action, resourceType, resourceId, beforeJson: before as Prisma.InputJsonValue, afterJson: after as Prisma.InputJsonValue, ip, userAgent: Array.isArray(userAgent) ? userAgent.join(',') : userAgent }); }
}
