import { Injectable } from '@nestjs/common';
import { ConsultationStatusCategory, ConsultationFieldType, Prisma } from '@prisma/client';
import { AdminCurrentUser } from '../../common/decorators/current-user.decorator';
import { DataScopeService } from '../../common/data-scope/data-scope.service';
import { BusinessException } from '../../common/utils/business-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { defaultConsultationValidityRule, isConsultationValid, type ConsultationValidityRule } from './consultation-validity-rule';

type Query = { mode: 'channel' | 'daily'; from: string; to: string; project?: string; channel?: string; customFields?: string };
type Totals = { total: number; valid: number; appointment: number; arrived: number; payment: number; custom: Record<string, number> };
type TreeNode = { key: string; label: string; level: 'TEAM' | 'MEMBER' | 'PROJECT' | 'CHANNEL' | 'ACCOUNT'; totals: Totals; children: Map<string, TreeNode> };
const emptyTotals = (): Totals => ({ total: 0, valid: 0, appointment: 0, arrived: 0, payment: 0, custom: {} });
const percent = (top: number, bottom: number) => bottom > 0 ? Math.round(top / bottom * 10000) / 100 : 0;

@Injectable()
export class ConsultationReportService {
  constructor(private readonly prisma: PrismaService, private readonly dataScopes: DataScopeService) {}

  async report(query: Query, user: AdminCurrentUser) {
    const from = new Date(`${query.from}T00:00:00+08:00`);
    const to = new Date(`${query.to}T23:59:59.999+08:00`);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to || to.getTime() - from.getTime() > 366 * 86400000) throw new BusinessException(400940, '报表日期范围无效或超过一年');
    const requested = [...new Set((query.customFields || '').split(',').map(value => value.trim()).filter(Boolean))];
    if (requested.length > 6) throw new BusinessException(400941, '最多选择六个自定义数值字段');
    const fields = await this.prisma.consultationFieldConfig.findMany({ where: { source: 'CUSTOM', enabled: true, type: ConsultationFieldType.NUMBER }, select: { code: true, name: true }, orderBy: { listOrder: 'asc' } });
    const ruleConfig = await this.prisma.systemConfig.findUnique({ where: { key: 'consultationValidityRule' } });
    const configured = ruleConfig?.valueJson && typeof ruleConfig.valueJson === 'object' && !Array.isArray(ruleConfig.valueJson) ? ruleConfig.valueJson as Record<string, unknown> : {};
    const rule: ConsultationValidityRule = {
      validTagIds: Array.isArray(configured.validTagIds) ? configured.validTagIds.filter((id): id is string => typeof id === 'string') : defaultConsultationValidityRule().validTagIds,
      invalidTagIds: Array.isArray(configured.invalidTagIds) ? configured.invalidTagIds.filter((id): id is string => typeof id === 'string') : defaultConsultationValidityRule().invalidTagIds,
    };
    if (requested.some(code => !fields.some(field => field.code === code))) throw new BusinessException(400942, '包含不可用于报表的自定义字段');
    const scope = await this.dataScopes.ownershipWhere(user, 'ownerAdminId', 'createdByAdminId');
    const where: Prisma.ConsultationFormWhereInput = { AND: [
      scope,
      { recordedAt: { gte: from, lte: to } },
      ...(query.project ? [{ OR: [{ promotionAccount: { project: query.project } }, { project: { name: query.project } }] }] : []),
      ...(query.channel ? [{ channelSource: query.channel }] : [])
    ] };
    const groups = new Map<string, Totals>();
    const treeRoots = new Map<string, TreeNode>();
    const summary = emptyTotals();
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.prisma.consultationForm.findMany({
        where, orderBy: { id: 'asc' }, take: 1000,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, recordedAt: true, channelSource: true, appointmentScheduled: true, paymentAmount: true, customData: true,
          project: { select: { name: true } }, promotionAccount: { select: { id: true, name: true, project: true } },
          owner: { select: { id: true, username: true, nickname: true, team: { select: { id: true, name: true } } } },
          status: { select: { code: true, category: true } }, tags: { select: { tagId: true } } }
      });
      for (const row of rows) {
        const key = query.mode === 'channel' ? row.channelSource : new Date(row.recordedAt.getTime() + 8 * 3600000).toISOString().slice(0, 10);
        const group = groups.get(key) || emptyTotals();
        groups.set(key, group);
        const project = row.promotionAccount?.project || row.project?.name || '未设置项目';
        const team = row.owner?.team;
        const path: Array<{ key: string; label: string; level: TreeNode['level'] }> = query.mode === 'daily'
          ? [
              { key: team?.id || 'unassigned', label: team?.name || '未分组', level: 'TEAM' },
              { key: row.owner.id, label: row.owner.nickname || row.owner.username, level: 'MEMBER' },
            ]
          : [
              { key: project, label: project, level: 'PROJECT' },
              { key: row.channelSource || '未设置渠道', label: row.channelSource || '未设置渠道', level: 'CHANNEL' },
              { key: row.promotionAccount?.id || 'unassigned', label: row.promotionAccount?.name || '未关联账户', level: 'ACCOUNT' },
            ];
        let siblings = treeRoots;
        const branch: TreeNode[] = [];
        for (const part of path) {
          let node = siblings.get(part.key);
          if (!node) {
            node = { key: part.key, label: part.label, level: part.level, totals: emptyTotals(), children: new Map() };
            siblings.set(part.key, node);
          }
          branch.push(node);
          siblings = node.children;
        }
        const valid = isConsultationValid(row.status.category === ConsultationStatusCategory.INVALID, row.tags.map((item) => item.tagId), rule);
        const arrived = row.status.code === 'VISITED' || row.status.code === 'DEAL';
        const custom = row.customData && typeof row.customData === 'object' && !Array.isArray(row.customData) ? row.customData as Record<string, unknown> : {};
        for (const target of [summary, group, ...branch.map(node => node.totals)]) {
          target.total++;
          if (valid) target.valid++;
          if (valid && row.appointmentScheduled) target.appointment++;
          if (arrived) target.arrived++;
          target.payment += Number(row.paymentAmount);
          for (const code of requested) { const value = Number(custom[code]); if (Number.isFinite(value)) target.custom[code] = (target.custom[code] || 0) + value; }
        }
      }
      if (rows.length < 1000) break;
      cursor = rows[rows.length - 1].id;
    }
    const output = (key: string, totals: Totals) => ({ key, ...totals, payment: Math.round(totals.payment * 100) / 100, effectiveRate: percent(totals.valid, totals.total), appointmentRate: percent(totals.appointment, totals.total), arrivalRate: percent(totals.arrived, totals.total) });
    type TreeOutput = ReturnType<typeof output> & { id: string; label: string; level: TreeNode['level']; children: TreeOutput[] };
    const tree = (siblings: Map<string, TreeNode>, parentId = ''): TreeOutput[] =>
      [...siblings.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')).map(node => {
        const id = `${parentId}/${encodeURIComponent(node.key)}`;
        return { ...output(node.key, node.totals), id, label: node.label, level: node.level, children: tree(node.children, id) };
      });
    return { mode: query.mode, from: query.from, to: query.to, fields: fields.filter(field => requested.includes(field.code)), availableFields: fields, summary: output('合计', summary), rows: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, totals]) => output(key, totals)), tree: tree(treeRoots) };
  }
}
