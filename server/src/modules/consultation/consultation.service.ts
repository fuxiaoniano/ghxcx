import { Injectable } from '@nestjs/common';
import {
  AdminRole,
  AdminStatus,
  ConsultationFieldType,
  ConsultationStatusCategory,
  ContentStatus,
  Prisma
} from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DataScopeService } from '../../common/data-scope/data-scope.service';
import { AdminCurrentUser } from '../../common/decorators/current-user.decorator';
import { BusinessException } from '../../common/utils/business-exception';
import {
  ConsultationAssignDto,
  ConsultationBulkAssignDto,
  ConsultationBulkTagsDto,
  ConsultationFieldDto,
  ConsultationFollowUpDto,
  ConsultationListPreferenceDto,
  ConsultationListQueryDto,
  ConsultationStatusDto,
  ConsultationTagDto,
  ConsultationValidityRuleDto,
  SaveConsultationScheduleDto,
  CreateConsultationDto,
  UpdateConsultationDto,
  UpdateConsultationFieldDto,
  UpdateConsultationStatusDto
} from './dto';

dayjs.extend(utc);
dayjs.extend(timezone);
const BUSINESS_TIME_ZONE = 'Asia/Shanghai';

const FIXED_FIELDS = [
  ['name', '姓名', true, 10, 110], ['phone', '电话', true, 20, 130], ['project', '项目', true, 30, 120],
  ['channelSource', '渠道来源', true, 40, 120], ['accountName', '账户名称', true, 45, 130], ['tags', '标签', false, 50, 160], ['status', '状态', false, 60, 100],
  ['owner', '当前负责人', false, 70, 120],
  ['lastFollowUpAt', '最近跟进时间', false, 90, 170], ['lastFollowUpContent', '最新跟进记录', false, 95, 220],
  ['nextFollowUpAt', '下次回访时间', false, 100, 170], ['overdue', '是否逾期', false, 110, 90],
  ['createdBy', '创建人', false, 120, 110], ['createdAt', '创建时间', false, 130, 170]
] as const;

const DEFAULT_STATUSES = [
  { code: 'PENDING', name: '待跟进', color: '#457ea9', sort: 10, category: ConsultationStatusCategory.IN_PROGRESS },
  { code: 'FOLLOWING', name: '跟进中', color: '#c48c4e', sort: 20, category: ConsultationStatusCategory.IN_PROGRESS },
  { code: 'VISITED', name: '已到诊', color: '#838e7c', sort: 30, category: ConsultationStatusCategory.IN_PROGRESS },
  { code: 'DEAL', name: '已成交', color: '#3f8f76', sort: 40, category: ConsultationStatusCategory.COMPLETED },
  { code: 'INVALID', name: '无效', color: '#9b6262', sort: 50, category: ConsultationStatusCategory.INVALID }
];

@Injectable()
export class ConsultationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditLogsService,
    private readonly dataScopes: DataScopeService,
    private readonly notifications: NotificationsService
  ) {}

  async ensureDefaults() {
    await this.prisma.$transaction([
      ...DEFAULT_STATUSES.map((status) => this.prisma.consultationStatus.upsert({
        where: { code: status.code }, update: {}, create: status
      })),
      ...FIXED_FIELDS.map(([code, name, required, listOrder, listWidth]) => this.prisma.consultationFieldConfig.upsert({
        where: { code }, update: {}, create: {
          code, name, source: 'FIXED', type: ConsultationFieldType.TEXT, required,
          enabled: true, showInForm: true, showInDetail: true, showInList: true,
          filterable: true, exportable: code !== 'lastFollowUpContent', importable: !['overdue', 'createdBy', 'createdAt', 'updatedAt', 'lastFollowUpAt', 'lastFollowUpContent'].includes(code),
          listTitle: name, listOrder, listWidth
        }
      }))
    ]);
  }

  async metadata(user: AdminCurrentUser) {
    await this.ensureDefaults();
    const [promotionAccounts, statuses, tags, fields, members, preference] = await Promise.all([
      this.prisma.promotionAccount.findMany({
        where: { status: ContentStatus.ACTIVE },
        select: { id: true, name: true, project: true, platform: true },
        orderBy: [{ project: 'asc' }, { platform: 'asc' }, { name: 'asc' }]
      }),
      this.prisma.consultationStatus.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.consultationTag.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.consultationFieldConfig.findMany({ orderBy: [{ listOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.eligibleMembers(),
      this.prisma.consultationListPreference.findUnique({ where: { adminUserId: user.adminUserId } })
    ]);
    const projects = [...new Set(promotionAccounts.map((item) => item.project))].map((name) => ({ id: name, name }));
    return {
      projects,
      promotionAccounts: promotionAccounts.map((item) => ({ id: item.id, name: item.name, project: item.project, channel: item.platform })),
      statuses,
      tags,
      fields: fields.filter((item) => !['recordedAt', 'updatedAt'].includes(item.code)).map((item) => this.fieldItem(item)),
      members,
      preference: preference?.columnsJson || null
    };
  }

  async list(query: ConsultationListQueryDto, user: AdminCurrentUser) {
    await this.ensureDefaults();
    const filterFields = await this.prisma.consultationFieldConfig.findMany({ where: { enabled: true, filterable: true }, select: { code: true } });
    const canFilter = new Set(filterFields.map((field) => field.code));
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize || 20));
    const where: Prisma.ConsultationFormWhereInput = {};
    const scope = await this.dataScopes.ownershipWhere(user, 'ownerAdminId', 'createdByAdminId');
    const and: Prisma.ConsultationFormWhereInput[] = [];
    if (Object.keys(scope).length) and.push(scope as Prisma.ConsultationFormWhereInput);
    if (query.keyword) {
      const keyword = query.keyword.trim();
      const phoneHash = /^1\d{10}$/.test(keyword) ? this.crypto.hashPhone(keyword) : undefined;
      where.OR = [{ name: { contains: keyword } }, ...(phoneHash ? [{ phoneHash }] : [])];
    }
    if (query.projectId && canFilter.has('project')) and.push({ OR: [{ promotionAccount: { project: query.projectId } }, { projectId: query.projectId }] });
    if (query.promotionAccountId && canFilter.has('accountName')) where.promotionAccountId = query.promotionAccountId;
    if (query.channelSource && canFilter.has('channelSource')) where.channelSource = query.channelSource;
    if (query.statusIds?.length && canFilter.has('status')) where.statusId = { in: query.statusIds };
    if (query.tagIds?.length && canFilter.has('tags')) where.tags = { some: { tagId: { in: query.tagIds } } };
    if (query.ownerAdminId && canFilter.has('owner')) where.ownerAdminId = query.ownerAdminId;
    if ((query.recordedFrom || query.recordedTo) && canFilter.has('recordedAt')) where.recordedAt = this.dateRange(query.recordedFrom, query.recordedTo);
    if ((query.createdFrom || query.createdTo) && canFilter.has('createdAt')) where.createdAt = this.dateRange(query.createdFrom, query.createdTo);
    if ((query.followedFrom || query.followedTo) && canFilter.has('lastFollowUpAt')) where.lastFollowUpAt = this.dateRange(query.followedFrom, query.followedTo);
    if ((query.callbackFrom || query.callbackTo) && canFilter.has('nextFollowUpAt')) where.nextFollowUpAt = this.dateRange(query.callbackFrom, query.callbackTo);
    if (query.overdue === true && canFilter.has('overdue')) {
      where.nextFollowUpAt = { lt: new Date() };
      where.status = { category: { notIn: [ConsultationStatusCategory.COMPLETED, ConsultationStatusCategory.INVALID] } };
    }
    if (query.customFilters && Object.keys(query.customFilters).length) {
      const requestedCodes = Object.keys(query.customFilters);
      const filterableFields = await this.prisma.consultationFieldConfig.findMany({
        where: { source: 'CUSTOM', enabled: true, filterable: true, code: { in: requestedCodes } },
        select: { code: true, type: true },
      });
      if (filterableFields.length !== requestedCodes.length) throw new BusinessException(400820, '筛选条件包含不可筛选或已停用字段');
      for (const field of filterableFields) {
        const value = query.customFilters[field.code];
        if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
        and.push({
          customData: field.type === ConsultationFieldType.MULTI
            ? { path: `$.${field.code}`, array_contains: value as Prisma.InputJsonValue }
            : { path: `$.${field.code}`, equals: value as Prisma.InputJsonValue },
        });
      }
    }
    if (and.length) where.AND = and;
    const [total, rows, listFields] = await Promise.all([
      this.prisma.consultationForm.count({ where }),
      this.prisma.consultationForm.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize,
        include: this.formInclude(), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      }),
      this.prisma.consultationFieldConfig.findMany({ where: { source: 'CUSTOM', enabled: true, showInList: true }, select: { code: true } }),
    ]);
    const allowedCodes = listFields.map((field) => field.code);
    return { total, page, pageSize, list: rows.map((item) => this.formItem(item, user, true, allowedCodes)) };
  }

  async detail(id: string, user: AdminCurrentUser) {
    const [row, detailFields] = await Promise.all([
      this.prisma.consultationForm.findUnique({
        where: { id }, include: { ...this.formInclude(), followUps: { include: { createdBy: { select: { id: true, username: true, nickname: true } }, resultStatus: true }, orderBy: { createdAt: 'desc' } } }
      }),
      this.prisma.consultationFieldConfig.findMany({
        where: {
          source: 'CUSTOM',
          OR: [{ showInDetail: true }, ...(user.role === AdminRole.SUPER_ADMIN || user.permissions.includes('CONSULTATION_EDIT') ? [{ showInForm: true }] : [])],
        },
        select: { code: true },
      }),
    ]);
    if (!row) throw new BusinessException(404801, '网咨表单不存在', 404);
    await this.dataScopes.assertOwned(user, row, 'ownerAdminId', 'createdByAdminId');
    return this.formItem(row, user, true, detailFields.map((field) => field.code));
  }

  async create(dto: CreateConsultationDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    await this.ensureDefaults();
    const promotionAccount = await this.resolvePromotionSelection(dto.promotionAccountId, dto.projectId, dto.channelSource);
    const status = dto.statusId
      ? await this.activeStatus(dto.statusId)
      : await this.prisma.consultationStatus.findUnique({ where: { code: 'PENDING' } });
    if (!status) throw new BusinessException(400802, '网咨状态不可用');
    this.validateInvalidReason(status.category, dto.invalidReason);
    const ownerAdminId = dto.ownerAdminId || user.adminUserId;
    if (ownerAdminId !== user.adminUserId) this.requirePermission(user, 'CONSULTATION_ASSIGN');
    if (ownerAdminId !== user.adminUserId) await this.assertEligibleOwner(ownerAdminId);
    const phoneHash = this.crypto.hashPhone(dto.phone);
    const duplicate = await this.prisma.consultationForm.findFirst({
      where: { phoneHash, status: { category: { notIn: [ConsultationStatusCategory.COMPLETED, ConsultationStatusCategory.INVALID] } } },
      include: { owner: { select: { id: true, username: true, nickname: true } }, status: true }, orderBy: { createdAt: 'desc' }
    });
    if (duplicate && !dto.forceDuplicate) {
      let visibleDuplicate: Record<string, unknown> = { restricted: true };
      try {
        await this.dataScopes.assertOwned(user, duplicate, 'ownerAdminId', 'createdByAdminId');
        visibleDuplicate = {
          id: duplicate.id, name: duplicate.name, owner: duplicate.owner.nickname || duplicate.owner.username,
          status: duplicate.status.name, lastFollowUpAt: duplicate.lastFollowUpAt
        };
      } catch {
        // 超出当前数据范围的重复记录只提示存在，不暴露姓名、负责人或记录 ID。
      }
      throw new BusinessException(409801, JSON.stringify({
        message: '手机号存在未完结网咨表单', duplicate: visibleDuplicate
      }), 409);
    }
    if (duplicate && !dto.duplicateReason?.trim()) throw new BusinessException(400803, '仍创建新表单时必须填写重复创建原因');
    const tags = await this.activeTags(dto.tagIds || []);
    const customData = await this.validateCustomData(dto.customData || {}, true);
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.consultationForm.create({ data: {
        name: dto.name.trim(), phoneEncrypted: this.crypto.encryptPhone(dto.phone), phoneHash,
        phoneMasked: this.crypto.maskPhone(dto.phone), projectId: null, promotionAccountId: promotionAccount.id, channelSource: promotionAccount.platform,
        appointmentScheduled: dto.appointmentScheduled ?? (status.code === 'VISITED' || status.code === 'DEAL'), paymentAmount: dto.paymentAmount ?? 0,
        statusId: status.id, ownerAdminId, createdByAdminId: user.adminUserId, lastOperatedByAdminId: user.adminUserId,
        recordedAt: new Date(),
        nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null,
        invalidReason: dto.invalidReason?.trim() || null, customData: customData as Prisma.InputJsonValue,
        duplicateOfId: duplicate?.id || null, duplicateReason: dto.duplicateReason?.trim() || null,
        tags: { create: tags.map((tag) => ({ tagId: tag.id })) }
      } });
      const first = dto.firstFollowUp?.trim();
      const latest = dto.latestFollowUp?.trim();
      if (first || latest) {
        const latestAt = new Date();
        if (first) await tx.consultationFollowUp.create({ data: { formId: row.id, content: first, createdByAdminId: user.adminUserId, createdAt: latest && latest !== first ? new Date(latestAt.getTime() - 1) : latestAt } });
        if (latest && latest !== first) await tx.consultationFollowUp.create({ data: { formId: row.id, content: latest, createdByAdminId: user.adminUserId, createdAt: latestAt } });
        await tx.consultationForm.update({ where: { id: row.id }, data: { lastFollowUpAt: latestAt } });
      }
      return row;
    });
    await this.log('CREATE_CONSULTATION', created.id, null, created, user, ip, userAgent);
    return this.detail(created.id, user);
  }

  async update(id: string, dto: UpdateConsultationDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.requireAccessible(id, user);
    const data: Prisma.ConsultationFormUpdateInput = { lastOperatedBy: { connect: { id: user.adminUserId } } };
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.phone !== undefined) {
      data.phoneEncrypted = this.crypto.encryptPhone(dto.phone); data.phoneHash = this.crypto.hashPhone(dto.phone); data.phoneMasked = this.crypto.maskPhone(dto.phone);
    }
    if (dto.promotionAccountId !== undefined || dto.projectId !== undefined || dto.channelSource !== undefined) {
      if (!dto.promotionAccountId || !dto.projectId || !dto.channelSource) throw new BusinessException(400801, '项目、渠道来源和账户名称必须同时选择');
      const promotionAccount = await this.resolvePromotionSelection(dto.promotionAccountId, dto.projectId, dto.channelSource);
      data.project = { disconnect: true };
      data.promotionAccount = { connect: { id: promotionAccount.id } };
      data.channelSource = promotionAccount.platform;
    }
    let category = before.status.category;
    if (dto.statusId !== undefined) {
      const status = await this.activeStatus(dto.statusId); category = status.category; data.status = { connect: { id: status.id } };
      if (dto.appointmentScheduled === undefined && ['VISITED', 'DEAL'].includes(status.code)) data.appointmentScheduled = true;
    }
    if (dto.appointmentScheduled !== undefined) data.appointmentScheduled = dto.appointmentScheduled;
    if (dto.paymentAmount !== undefined) data.paymentAmount = dto.paymentAmount;
    if (dto.nextFollowUpAt !== undefined) data.nextFollowUpAt = dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null;
    if (dto.invalidReason !== undefined) data.invalidReason = dto.invalidReason?.trim() || null;
    if (dto.customData !== undefined) data.customData = await this.validateCustomData(dto.customData, false) as Prisma.InputJsonValue;
    // Tag-only and other unrelated partial updates must not be blocked by legacy
    // invalid forms that predate the required invalid-reason field. Keep the
    // requirement when callers explicitly change the status or reason.
    if (dto.statusId !== undefined || dto.invalidReason !== undefined) {
      this.validateInvalidReason(category, dto.invalidReason === undefined ? before.invalidReason : dto.invalidReason);
    }
    const tags = dto.tagIds === undefined ? null : await this.activeTags(dto.tagIds);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (tags) {
        await tx.consultationFormTag.deleteMany({ where: { formId: id } });
        if (tags.length) await tx.consultationFormTag.createMany({ data: tags.map((tag) => ({ formId: id, tagId: tag.id })) });
      }
      return tx.consultationForm.update({ where: { id }, data, include: this.formInclude() });
    });
    await this.log('UPDATE_CONSULTATION', id, before, updated, user, ip, userAgent);
    return this.detail(id, user);
  }

  async addFollowUp(id: string, dto: ConsultationFollowUpDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.requireAccessible(id, user);
    const resultStatus = dto.resultStatusId ? await this.activeStatus(dto.resultStatusId) : null;
    const now = new Date();
    const followUp = await this.prisma.$transaction(async (tx) => {
      const row = await tx.consultationFollowUp.create({ data: {
        formId: id, content: dto.content.trim(), resultStatusId: resultStatus?.id || null,
        nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null,
        createdByAdminId: user.adminUserId
      } });
      await tx.consultationForm.update({ where: { id }, data: {
        lastFollowUpAt: now, lastOperatedByAdminId: user.adminUserId,
        ...(resultStatus ? { statusId: resultStatus.id } : {}),
        ...(resultStatus && ['VISITED', 'DEAL'].includes(resultStatus.code) ? { appointmentScheduled: true } : {}),
        // 新增跟进即表示原回访任务已处理；没有重新安排时清空旧回访时间，避免继续误报逾期。
        nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null,
      } });
      return row;
    });
    await this.log('CREATE_CONSULTATION_FOLLOW_UP', id, before, followUp, user, ip, userAgent);
    return this.detail(id, user);
  }

  async assign(id: string, dto: ConsultationAssignDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.requireAccessible(id, user);
    await this.assertEligibleOwner(dto.ownerAdminId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.consultationForm.update({ where: { id }, data: { ownerAdminId: dto.ownerAdminId, lastOperatedByAdminId: user.adminUserId } });
      if (before.ownerAdminId !== dto.ownerAdminId) await tx.consultationAssignmentNoticeJob.create({ data: {
        eventKey: `${id}:${before.updatedAt.toISOString()}:${dto.ownerAdminId}`,
        formId: id,
        ownerAdminId: dto.ownerAdminId,
      } });
      return row;
    });
    await this.log('ASSIGN_CONSULTATION', id, { ownerAdminId: before.ownerAdminId }, { ownerAdminId: dto.ownerAdminId, reason: dto.reason || '' }, user, ip, userAgent);
    return updated;
  }

  async bulkAssign(dto: ConsultationBulkAssignDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const owners = await this.bulkAssignmentOwners(dto);
    const { uniqueIds, allowed, failures } = await this.assignmentCandidates(dto.ids, user);
    if (!allowed.length) return { selected: uniqueIds.length, success: 0, failed: failures.length, failures };
    const assignments = allowed.map((row, index) => ({ row, owner: owners[index % owners.length] }));
    await this.prisma.$transaction(async (tx) => {
      for (const { row, owner } of assignments) {
        await tx.consultationForm.update({ where: { id: row.id }, data: { ownerAdminId: owner.id, lastOperatedByAdminId: user.adminUserId } });
        if (row.ownerAdminId !== owner.id) await tx.consultationAssignmentNoticeJob.create({ data: {
          eventKey: `${row.id}:${row.updatedAt.toISOString()}:${owner.id}`,
          formId: row.id,
          ownerAdminId: owner.id,
        } });
        await tx.auditLog.create({ data: {
          adminUserId: user.adminUserId, action: 'BULK_ASSIGN_CONSULTATION', resourceType: 'consultation_forms', resourceId: row.id,
          beforeJson: { ownerAdminId: row.ownerAdminId }, afterJson: { ownerAdminId: owner.id, reason: dto.reason || '' }, ip,
          userAgent: this.ua(userAgent)
        } });
      }
    });
    return { selected: uniqueIds.length, success: allowed.length, failed: failures.length, failures, distribution: owners.map((owner) => ({ id: owner.id, name: owner.nickname || owner.username, count: assignments.filter((item) => item.owner.id === owner.id).length })) };
  }

  async bulkAssignPreview(dto: ConsultationBulkAssignDto, user: AdminCurrentUser) {
    const owners = await this.bulkAssignmentOwners(dto);
    const { uniqueIds, allowed, failures } = await this.assignmentCandidates(dto.ids, user);
    return {
      selected: uniqueIds.length,
      assignable: allowed.length,
      failed: failures.length,
      failures,
      targets: owners.map((owner, index) => ({ id: owner.id, username: owner.username, nickname: owner.nickname || owner.username, count: Math.floor(allowed.length / owners.length) + (index < allowed.length % owners.length ? 1 : 0) })),
    };
  }

  private async bulkAssignmentOwners(dto: ConsultationBulkAssignDto) {
    const ids = [...new Set(dto.ownerAdminIds?.length ? dto.ownerAdminIds : dto.ownerAdminId ? [dto.ownerAdminId] : [])];
    if (!ids.length) throw new BusinessException(400807, '请至少选择一名网咨负责人');
    return Promise.all(ids.map((id) => this.assertEligibleOwner(id)));
  }

  async bulkTags(dto: ConsultationBulkTagsDto, mode: 'add' | 'remove', user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const tags = mode === 'add' ? await this.activeTags(dto.tagIds) : dto.tagIds.map((id) => ({ id }));
    const rows = await this.prisma.consultationForm.findMany({ where: { id: { in: [...new Set(dto.ids)] } } });
    for (const row of rows) await this.dataScopes.assertOwned(user, row, 'ownerAdminId', 'createdByAdminId');
    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        if (mode === 'add') await tx.consultationFormTag.createMany({ data: tags.map((tag) => ({ formId: row.id, tagId: tag.id })), skipDuplicates: true });
        else await tx.consultationFormTag.deleteMany({ where: { formId: row.id, tagId: { in: dto.tagIds } } });
        await tx.auditLog.create({ data: { adminUserId: user.adminUserId, action: mode === 'add' ? 'BULK_ADD_CONSULTATION_TAGS' : 'BULK_REMOVE_CONSULTATION_TAGS', resourceType: 'consultation_forms', resourceId: row.id, afterJson: { tagIds: dto.tagIds }, ip, userAgent: this.ua(userAgent) } });
      }
    });
    return { success: rows.length };
  }

  async todayCallbacks(user: AdminCurrentUser) {
    const businessNow = dayjs().tz(BUSINESS_TIME_ZONE);
    const start = businessNow.startOf('day').toDate();
    const end = businessNow.endOf('day').toDate();
    const scope = await this.dataScopes.ownershipWhere(user, 'ownerAdminId', 'createdByAdminId');
    const active: Prisma.ConsultationFormWhereInput = { status: { category: { notIn: [ConsultationStatusCategory.COMPLETED, ConsultationStatusCategory.INVALID] } } };
    const scoped = Object.keys(scope).length ? scope as Prisma.ConsultationFormWhereInput : {};
    const [today, overdue, completedAudits] = await Promise.all([
      this.prisma.consultationForm.findMany({ where: { AND: [active, scoped], nextFollowUpAt: { gte: start, lte: end } }, include: this.formInclude(), orderBy: { nextFollowUpAt: 'asc' } }),
      this.prisma.consultationForm.findMany({ where: { AND: [active, scoped], nextFollowUpAt: { lt: businessNow.toDate() } }, include: this.formInclude(), orderBy: { nextFollowUpAt: 'asc' } }),
      this.prisma.auditLog.findMany({
        where: {
          action: 'CREATE_CONSULTATION_FOLLOW_UP',
          resourceType: 'consultation_forms',
          resourceId: { not: null },
          createdAt: { gte: start, lte: end }
        },
        select: { resourceId: true, beforeJson: true }
      })
    ]);
    // A follow-up completed today only belongs to today's callback total when the
    // form was scheduled for today before that follow-up cleared/rescheduled it.
    const completedIds = [...new Set(completedAudits.flatMap((audit) => {
      const snapshot = audit.beforeJson;
      if (!audit.resourceId || !snapshot || Array.isArray(snapshot) || typeof snapshot !== 'object') return [];
      const scheduledValue = (snapshot as Prisma.JsonObject).nextFollowUpAt;
      if (typeof scheduledValue !== 'string') return [];
      const scheduledAt = new Date(scheduledValue);
      return Number.isNaN(scheduledAt.getTime()) || scheduledAt < start || scheduledAt > end ? [] : [audit.resourceId];
    }))];
    const completed = completedIds.length
      ? await this.prisma.consultationForm.count({ where: { AND: [scoped, { id: { in: completedIds } }] } })
      : 0;
    return { counts: { today: today.length, overdue: overdue.length, completed }, today: today.map((row) => this.formItem(row, user, false, [])), overdue: overdue.map((row) => this.formItem(row, user, false, [])) };
  }

  async eligibleMembers() {
    const rows = await this.prisma.adminUser.findMany({ where: { status: AdminStatus.ACTIVE, deletedAt: null, consultationReceivable: true }, include: { customRole: true }, orderBy: { username: 'asc' } });
    return rows.filter((row) => row.role === AdminRole.SUPER_ADMIN ||
      this.parsePermissions(row.customRole?.permissionsJson ?? row.permissionsJson).some((permission) =>
        permission === 'CONSULTATION_VIEW' || permission === 'CONSULTATION_SCHEDULE_VIEW'))
      .map((row) => ({ id: row.id, username: row.username, nickname: row.nickname || row.username, teamId: row.teamId }));
  }

  async schedule(month: string) {
    const start = new Date(`${month}-01T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 7) !== month) throw new BusinessException(400830, '月份无效');
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const members = await this.eligibleMembers();
    const rows = await this.prisma.consultationSchedule.findMany({ where: { workDate: { gte: start, lt: end }, adminUserId: { in: members.map((member) => member.id) } } });
    return { month, members, days: Math.round((end.getTime() - start.getTime()) / 86400000), entries: rows.map((row) => ({ adminUserId: row.adminUserId, date: row.workDate.toISOString().slice(0, 10), shift: row.shift })) };
  }

  async saveSchedule(dto: SaveConsultationScheduleDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const date = new Date(`${dto.date}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dto.date) throw new BusinessException(400831, '日期无效');
    if (dto.adminUserId !== user.adminUserId) this.requirePermission(user, 'CONSULTATION_SCHEDULE_MANAGE');
    const member = await this.prisma.adminUser.findFirst({ where: { id: dto.adminUserId, status: AdminStatus.ACTIVE, deletedAt: null, consultationReceivable: true }, select: { id: true } });
    if (!member) throw new BusinessException(404830, '网咨成员不存在或未启用', 404);
    const where = { adminUserId_workDate: { adminUserId: dto.adminUserId, workDate: date } };
    const before = await this.prisma.consultationSchedule.findUnique({ where });
    if (dto.shift === 'MORNING') await this.prisma.consultationSchedule.deleteMany({ where: { adminUserId: dto.adminUserId, workDate: date } });
    else await this.prisma.consultationSchedule.upsert({ where, create: { adminUserId: dto.adminUserId, workDate: date, shift: dto.shift, updatedById: user.adminUserId }, update: { shift: dto.shift, updatedById: user.adminUserId } });
    await this.log('UPDATE_CONSULTATION_SCHEDULE', `${dto.adminUserId}:${dto.date}`, { shift: before?.shift || 'MORNING' }, { shift: dto.shift }, user, ip, userAgent, 'consultation_schedules');
    return dto;
  }

  async deleteForm(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    await this.requireAccessible(id, user);
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({ where: { resourceId: id } });
      await tx.consultationForm.delete({ where: { id } });
      await tx.auditLog.create({ data: { adminUserId: user.adminUserId, action: 'DELETE_CONSULTATION', resourceType: 'consultation_forms', resourceId: id, afterJson: { deleted: true }, ip, userAgent: this.ua(userAgent) } });
    });
    return { id, deleted: true };
  }

  async fields() { await this.ensureDefaults(); return (await this.prisma.consultationFieldConfig.findMany({ where: { code: { notIn: ['recordedAt', 'updatedAt'] } }, orderBy: [{ listOrder: 'asc' }, { createdAt: 'asc' }] })).map((item) => this.fieldItem(item)); }
  async createField(dto: ConsultationFieldDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const row = await this.prisma.consultationFieldConfig.create({ data: this.fieldData(dto, user.adminUserId) });
    await this.log('CREATE_CONSULTATION_FIELD', row.id, null, row, user, ip, userAgent); return this.fieldItem(row);
  }
  async updateField(id: string, dto: UpdateConsultationFieldDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.prisma.consultationFieldConfig.findUnique({ where: { id } }); if (!before) throw new BusinessException(404803, '字段不存在', 404);
    const requiredFixed = ['name', 'phone', 'project', 'channelSource', 'accountName'].includes(before.code);
    if (requiredFixed && (dto.enabled === false || dto.showInForm === false || dto.required === false)) throw new BusinessException(400804, '姓名、电话、项目、渠道来源和账户名称不可关闭且必须必填');
    const { options, ...updates } = dto;
    const row = await this.prisma.consultationFieldConfig.update({ where: { id }, data: { ...updates, ...(options === undefined ? {} : { optionsJson: options }) } });
    await this.log('UPDATE_CONSULTATION_FIELD', id, before, row, user, ip, userAgent); return this.fieldItem(row);
  }
  async deleteField(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.prisma.consultationFieldConfig.findUnique({ where: { id } }); if (!before) throw new BusinessException(404803, '字段不存在', 404);
    if (before.source === 'FIXED') throw new BusinessException(400805, '固定字段不可删除');
    const row = await this.prisma.consultationFieldConfig.update({ where: { id }, data: { enabled: false } });
    await this.log('DISABLE_CONSULTATION_FIELD', id, before, row, user, ip, userAgent); return row;
  }

  async statuses() { await this.ensureDefaults(); return this.prisma.consultationStatus.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }); }
  async createStatus(dto: ConsultationStatusDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) { const row = await this.prisma.consultationStatus.create({ data: dto }); await this.log('CREATE_CONSULTATION_STATUS', row.id, null, row, user, ip, userAgent); return row; }
  async updateStatus(id: string, dto: UpdateConsultationStatusDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) { const before = await this.prisma.consultationStatus.findUnique({ where: { id } }); if (!before) throw new BusinessException(404804, '状态不存在', 404); const row = await this.prisma.consultationStatus.update({ where: { id }, data: dto }); await this.log('UPDATE_CONSULTATION_STATUS', id, before, row, user, ip, userAgent); return row; }
  async deleteStatus(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) { const before = await this.prisma.consultationStatus.findUnique({ where: { id }, include: { _count: { select: { forms: true, followUps: true } } } }); if (!before) throw new BusinessException(404804, '状态不存在', 404); if (before._count.forms || before._count.followUps) { const row = await this.prisma.consultationStatus.update({ where: { id }, data: { enabled: false } }); await this.log('DISABLE_CONSULTATION_STATUS', id, before, row, user, ip, userAgent); return row; } await this.prisma.consultationStatus.delete({ where: { id } }); await this.log('DELETE_CONSULTATION_STATUS', id, before, { deleted: true }, user, ip, userAgent); return { id, deleted: true }; }

  async tags() { return this.prisma.consultationTag.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }); }
  async validityRule() {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'consultationValidityRule' } });
    const value = row?.valueJson && typeof row.valueJson === 'object' && !Array.isArray(row.valueJson) ? row.valueJson as Record<string, unknown> : {};
    return {
      validTagIds: Array.isArray(value.validTagIds) ? value.validTagIds.filter((id): id is string => typeof id === 'string') : [],
      invalidTagIds: Array.isArray(value.invalidTagIds) ? value.invalidTagIds.filter((id): id is string => typeof id === 'string') : [],
    };
  }
  async saveValidityRule(dto: ConsultationValidityRuleDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const validTagIds = [...new Set(dto.validTagIds)];
    const invalidTagIds = [...new Set(dto.invalidTagIds)];
    if (validTagIds.some((id) => invalidTagIds.includes(id))) throw new BusinessException(400821, '同一标签不能同时设为有效和无效');
    const allIds = [...validTagIds, ...invalidTagIds];
    const count = await this.prisma.consultationTag.count({ where: { id: { in: allIds } } });
    if (count !== allIds.length) throw new BusinessException(400822, '包含不存在的网咨标签');
    const before = await this.validityRule();
    const after = { validTagIds, invalidTagIds };
    await this.prisma.systemConfig.upsert({ where: { key: 'consultationValidityRule' }, create: { key: 'consultationValidityRule', valueJson: after, description: '网咨报表有效无效标签统计规则' }, update: { valueJson: after } });
    await this.log('UPDATE_CONSULTATION_VALIDITY_RULE', 'consultationValidityRule', before, after, user, ip, userAgent, 'system_configs');
    return after;
  }
  async createTag(dto: ConsultationTagDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) { const row = await this.prisma.consultationTag.create({ data: { ...dto, createdByAdminId: user.adminUserId } }); await this.log('CREATE_CONSULTATION_TAG', row.id, null, row, user, ip, userAgent); return row; }
  async updateTag(id: string, dto: Partial<ConsultationTagDto>, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) { const before = await this.prisma.consultationTag.findUnique({ where: { id } }); if (!before) throw new BusinessException(404805, '标签不存在', 404); const row = await this.prisma.consultationTag.update({ where: { id }, data: dto }); await this.log('UPDATE_CONSULTATION_TAG', id, before, row, user, ip, userAgent); return row; }
  async deleteTag(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) { const before = await this.prisma.consultationTag.findUnique({ where: { id }, include: { _count: { select: { forms: true } } } }); if (!before) throw new BusinessException(404805, '标签不存在', 404); const rule = await this.validityRule(); if (before._count.forms || rule.validTagIds.includes(id) || rule.invalidTagIds.includes(id)) { const row = await this.prisma.consultationTag.update({ where: { id }, data: { enabled: false } }); await this.log('DISABLE_CONSULTATION_TAG', id, before, row, user, ip, userAgent); return row; } await this.prisma.consultationTag.delete({ where: { id } }); await this.log('DELETE_CONSULTATION_TAG', id, before, { deleted: true }, user, ip, userAgent); return { id, deleted: true }; }

  async savePreference(dto: ConsultationListPreferenceDto, user: AdminCurrentUser) {
    const before = await this.prisma.consultationListPreference.findUnique({ where: { adminUserId: user.adminUserId } });
    const row = await this.prisma.consultationListPreference.upsert({ where: { adminUserId: user.adminUserId }, create: { adminUserId: user.adminUserId, columnsJson: dto.columns as unknown as Prisma.InputJsonValue }, update: { columnsJson: dto.columns as unknown as Prisma.InputJsonValue } });
    await this.log('UPDATE_CONSULTATION_LIST_PREFERENCE', row.id, before, row, user, undefined, undefined, 'consultation_list_preferences');
    return row;
  }

  async templateBuffer(user: AdminCurrentUser) {
    await this.ensureDefaults();
    const fields = await this.prisma.consultationFieldConfig.findMany({ where: { source: 'CUSTOM', enabled: true, importable: true }, orderBy: { listOrder: 'asc' } });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('网咨数据导入');
    const headers = ['姓名*', '电话*', '项目*', '渠道来源*', '账户名称*', '标签', '状态', '已预约', '收款金额', '首次跟进记录', '最新跟进记录', '下次回访时间', '负责人', ...fields.map((field) => field.name)];
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCFE3F4' } };
    sheet.columns.forEach((column) => { column.width = 18; });
    sheet.addRow(['张三', '13800138000', '重庆', '腾讯营销', '腾讯01', '重点,待确认', '待跟进', '否', '0', '已首次联系', '客户希望下周回访', '', '']);
    const help = workbook.addWorksheet('填写说明');
    help.addRows([
      ['字段', '说明'], ['项目/渠道来源/账户名称', '必须与推广数据中的启用账户配置完全一致，三项必须匹配'],
      ['标签', '多个标签用英文逗号分隔，必须为已启用标签'], ['状态', '填写已启用状态名称或状态编码，留空默认为待跟进'],
      ['负责人', '填写登录账号；仅有分配权限时生效'], ['已预约', '填写是或否；留空时已到诊和已成交自动视为已预约'], ['收款金额', '元；留空按 0 计算'], ['最新跟进记录', '与首次跟进同时填写时，两条记录都会导入，最新跟进显示在最前'], ['时间', '建议使用 YYYY-MM-DD HH:mm:ss']
    ]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await this.log('EXPORT_CONSULTATION_IMPORT_TEMPLATE', `template-${Date.now()}`, null, { customFieldCount: fields.length }, user, undefined, undefined, 'consultation_exports');
    return buffer;
  }

  async validateImport(file: { originalname?: string; buffer?: Buffer }, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    if (!file?.buffer || !file.originalname?.toLowerCase().endsWith('.xlsx')) throw new BusinessException(400816, '请上传 .xlsx 文件');
    if (file.buffer.length < 4 || file.buffer.subarray(0, 2).toString('ascii') !== 'PK') throw new BusinessException(400816, '文件内容不是有效的 .xlsx 文件');
    await this.ensureDefaults();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BusinessException(400817, 'Excel 中没有可读取的工作表');
    if (sheet.rowCount > 10001) throw new BusinessException(400817, '单次最多导入 10000 条数据');
    const headerMap = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, col) => headerMap.set(String(cell.text || '').trim().replace(/\*$/, ''), col));
    for (const required of ['姓名', '电话', '项目', '渠道来源', '账户名称']) if (!headerMap.has(required)) throw new BusinessException(400818, `缺少必填列：${required}*`);
    const [promotionAccounts, statuses, tags, fields, members] = await Promise.all([
      this.prisma.promotionAccount.findMany({ where: { status: ContentStatus.ACTIVE } }), this.prisma.consultationStatus.findMany({ where: { enabled: true } }),
      this.prisma.consultationTag.findMany({ where: { enabled: true } }), this.prisma.consultationFieldConfig.findMany({ where: { source: 'CUSTOM', enabled: true, importable: true } }),
      this.prisma.adminUser.findMany({ where: { status: AdminStatus.ACTIVE, deletedAt: null }, include: { customRole: true } })
    ]);
    const get = (row: ExcelJS.Row, name: string) => { const col = headerMap.get(name); return col ? String(row.getCell(col).text || '').trim() : ''; };
    const preview: Array<Record<string, unknown>> = [];
    const errors: Array<{ rowNumber: number; field?: string; message: string; rowJson: Record<string, unknown> }> = [];
    let duplicateCount = 0;
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber); if (!row.hasValues) continue;
      const raw = { name: get(row, '姓名'), phone: get(row, '电话'), project: get(row, '项目'), channelSource: get(row, '渠道来源'), accountName: get(row, '账户名称'), tags: get(row, '标签'), status: get(row, '状态'), appointmentScheduled: get(row, '已预约'), paymentAmount: get(row, '收款金额'), recordedAt: get(row, '录单时间'), firstFollowUp: get(row, '首次跟进记录'), latestFollowUp: get(row, '最新跟进记录'), firstFollowUpAt: get(row, '跟进时间'), nextFollowUpAt: get(row, '下次回访时间'), owner: get(row, '负责人') };
      const rowErrors: Array<{ field: string; message: string }> = [];
      if (!raw.name) rowErrors.push({ field: '姓名', message: '姓名不能为空' });
      if (!/^1\d{10}$/.test(raw.phone)) rowErrors.push({ field: '电话', message: '手机号格式不正确' });
      const promotionAccount = promotionAccounts.find((item) => item.name === raw.accountName && item.project === raw.project && item.platform === raw.channelSource);
      if (!raw.project) rowErrors.push({ field: '项目', message: '项目不能为空' });
      if (!raw.channelSource) rowErrors.push({ field: '渠道来源', message: '渠道来源不能为空' });
      if (!raw.accountName) rowErrors.push({ field: '账户名称', message: '账户名称不能为空' });
      else if (!promotionAccount) rowErrors.push({ field: '账户名称', message: '项目、渠道来源和账户名称与推广数据中的启用账户不匹配' });
      const status = raw.status ? statuses.find((item) => item.name === raw.status || item.code === raw.status) : statuses.find((item) => item.code === 'PENDING');
      if (!status) rowErrors.push({ field: '状态', message: '状态不存在或已停用' });
      if (raw.appointmentScheduled && !['是', '否', '1', '0'].includes(raw.appointmentScheduled)) rowErrors.push({ field: '已预约', message: '请填写是或否' });
      if (raw.paymentAmount && (!/^\d+(\.\d{1,2})?$/.test(raw.paymentAmount) || Number(raw.paymentAmount) > 1000000000)) rowErrors.push({ field: '收款金额', message: '请填写非负金额，最多两位小数' });
      if (raw.firstFollowUp.length > 5000) rowErrors.push({ field: '首次跟进记录', message: '最多 5000 字' });
      if (raw.latestFollowUp.length > 5000) rowErrors.push({ field: '最新跟进记录', message: '最多 5000 字' });
      const tagNames = raw.tags.split(',').map((item) => item.trim()).filter(Boolean); const resolvedTags = tagNames.map((name) => tags.find((tag) => tag.name === name));
      if (resolvedTags.some((item) => !item)) rowErrors.push({ field: '标签', message: '包含不存在或已停用标签' });
      let owner = members.find((item) => item.username === raw.owner || item.nickname === raw.owner);
      if (raw.owner && user.role !== AdminRole.SUPER_ADMIN && !user.permissions.includes('CONSULTATION_ASSIGN')) rowErrors.push({ field: '负责人', message: '当前账号无分配负责人权限' });
      if (!raw.owner) owner = members.find((item) => item.id === user.adminUserId);
      if (!owner) rowErrors.push({ field: '负责人', message: '负责人不存在或已停用' });
      if (owner) { const permissions = this.parsePermissions(owner.customRole?.permissionsJson ?? owner.permissionsJson); if (!owner.consultationReceivable || (owner.role !== AdminRole.SUPER_ADMIN && !permissions.includes('CONSULTATION_VIEW'))) rowErrors.push({ field: '负责人', message: '负责人不具备网咨接单资格' }); }
      const customData: Record<string, unknown> = {}; for (const field of fields) { const value = get(row, field.name); if (value !== '') customData[field.code] = field.type === ConsultationFieldType.NUMBER ? Number(value) : (field.type === ConsultationFieldType.MULTI ? value.split(',').map((item) => item.trim()).filter(Boolean) : value); if (field.required && value === '') rowErrors.push({ field: field.name, message: '必填字段不能为空' }); }
      try { await this.validateCustomData(customData, true); } catch (error) { rowErrors.push({ field: '自定义字段', message: error instanceof Error ? error.message : '字段值不合法' }); }
      const duplicate = /^1\d{10}$/.test(raw.phone) ? await this.prisma.consultationForm.findFirst({ where: { phoneHash: this.crypto.hashPhone(raw.phone), status: { category: { notIn: [ConsultationStatusCategory.COMPLETED, ConsultationStatusCategory.INVALID] } } }, select: { id: true } }) : null;
      if (duplicate) duplicateCount++;
      const normalized = {
        rowNumber, name: raw.name, phoneEncrypted: /^1\d{10}$/.test(raw.phone) ? this.crypto.encryptPhone(raw.phone) : '',
        phoneMasked: /^1\d{10}$/.test(raw.phone) ? this.crypto.maskPhone(raw.phone) : '格式错误', project: raw.project,
        channelSource: raw.channelSource, tags: raw.tags, status: raw.status, recordedAt: raw.recordedAt,
        firstFollowUp: raw.firstFollowUp, latestFollowUp: raw.latestFollowUp, firstFollowUpAt: raw.firstFollowUpAt, nextFollowUpAt: raw.nextFollowUpAt,
        owner: raw.owner, projectId: raw.project, promotionAccountId: promotionAccount?.id, statusId: status?.id,
        appointmentScheduled: raw.appointmentScheduled ? ['是', '1'].includes(raw.appointmentScheduled) : undefined, paymentAmount: raw.paymentAmount ? Number(raw.paymentAmount) : 0,
        tagIds: resolvedTags.filter(Boolean).map((tag) => tag!.id), ownerAdminId: owner?.id, customData, duplicateId: duplicate?.id || null
      };
      preview.push({ ...normalized, valid: rowErrors.length === 0 });
      const safeRaw = { ...raw, phone: /^1\d{10}$/.test(raw.phone) ? this.crypto.maskPhone(raw.phone) : '格式错误' };
      for (const item of rowErrors) errors.push({ rowNumber, field: item.field, message: item.message, rowJson: safeRaw });
    }
    const batch = await this.prisma.consultationImportBatch.create({ data: {
      fileName: file.originalname, operatorAdminId: user.adminUserId, totalCount: preview.length,
      successCount: preview.filter((item) => item.valid).length, failedCount: new Set(errors.map((item) => item.rowNumber)).size,
      duplicateCount, previewJson: preview as Prisma.InputJsonValue,
      errors: { create: errors.map((item) => ({ rowNumber: item.rowNumber, field: item.field, message: item.message, rowJson: item.rowJson as Prisma.InputJsonValue })) }
    } });
    await this.log('VALIDATE_CONSULTATION_IMPORT', batch.id, null, { fileName: batch.fileName, totalCount: batch.totalCount, failedCount: batch.failedCount, duplicateCount }, user, ip, userAgent);
    const publicPreview = preview.map(({ phoneEncrypted: _phoneEncrypted, duplicateId: _duplicateId, ...row }) => row);
    return { batchId: batch.id, totalCount: batch.totalCount, validCount: batch.successCount, failedCount: batch.failedCount, duplicateCount, preview: publicPreview, errors };
  }

  async commitImport(batchId: string, duplicateMode: 'SKIP' | 'CREATE' | 'FOLLOW_UP', user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const batch = await this.prisma.consultationImportBatch.findFirst({ where: { id: batchId, operatorAdminId: user.adminUserId } });
    if (!batch || batch.status !== 'VALIDATED') throw new BusinessException(400819, '导入批次不存在或已提交');
    const rows = Array.isArray(batch.previewJson) ? batch.previewJson as Array<Record<string, any>> : [];
    let success = 0; const failures: Array<{ rowNumber: number; reason: string }> = [];
    for (const row of rows.filter((item) => item.valid)) {
      try {
        if (row.duplicateId && duplicateMode === 'SKIP') { failures.push({ rowNumber: row.rowNumber, reason: '重复手机号，已按规则跳过' }); continue; }
        if (row.duplicateId && duplicateMode === 'FOLLOW_UP') {
          this.requirePermission(user, 'CONSULTATION_FOLLOW_UP');
          const content = row.latestFollowUp || row.firstFollowUp;
          if (!content) { failures.push({ rowNumber: row.rowNumber, reason: '没有可追加的跟进内容' }); continue; }
          await this.addFollowUp(row.duplicateId, { content, nextFollowUpAt: row.nextFollowUpAt || undefined }, user, ip, userAgent); success++; continue;
        }
        const phone = row.phoneEncrypted ? this.crypto.decryptPhone(row.phoneEncrypted) : '';
        await this.create({ name: row.name, phone, projectId: row.projectId, channelSource: row.channelSource, promotionAccountId: row.promotionAccountId, statusId: row.statusId, appointmentScheduled: row.appointmentScheduled, paymentAmount: row.paymentAmount, ownerAdminId: row.ownerAdminId, tagIds: row.tagIds, recordedAt: row.recordedAt || undefined, nextFollowUpAt: row.nextFollowUpAt || undefined, customData: row.customData, firstFollowUp: row.firstFollowUp || undefined, latestFollowUp: row.latestFollowUp || undefined, firstFollowUpAt: row.firstFollowUpAt || undefined, forceDuplicate: Boolean(row.duplicateId), duplicateReason: row.duplicateId ? '批量导入明确选择创建重复记录' : undefined }, user, ip, userAgent); success++;
      } catch (error) { failures.push({ rowNumber: row.rowNumber, reason: error instanceof Error ? error.message : '导入失败' }); }
    }
    await this.prisma.consultationImportBatch.update({ where: { id: batchId }, data: { status: failures.length && !success ? 'FAILED' : 'COMMITTED', successCount: success, failedCount: failures.length + batch.failedCount, committedAt: new Date(), optionsJson: { duplicateMode, failures } } });
    await this.log('COMMIT_CONSULTATION_IMPORT', batchId, null, { success, failed: failures.length, duplicateMode }, user, ip, userAgent);
    return { batchId, success, failed: failures.length, failures };
  }

  async importErrorsBuffer(batchId: string, user: AdminCurrentUser) {
    const batch = await this.prisma.consultationImportBatch.findFirst({ where: { id: batchId, ...(user.role === AdminRole.SUPER_ADMIN ? {} : { operatorAdminId: user.adminUserId }) }, include: { errors: { orderBy: [{ rowNumber: 'asc' }, { createdAt: 'asc' }] } } });
    if (!batch) throw new BusinessException(404806, '导入批次不存在', 404);
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('错误明细'); sheet.addRow(['行号', '字段', '原因', '原始数据']);
    for (const error of batch.errors) sheet.addRow([error.rowNumber, error.field || '', error.message, JSON.stringify(error.rowJson || {})]);
    sheet.getRow(1).font = { bold: true }; sheet.columns = [{ width: 10 }, { width: 20 }, { width: 45 }, { width: 80 }];
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await this.log('EXPORT_CONSULTATION_IMPORT_ERRORS', batchId, null, { count: batch.errors.length }, user, undefined, undefined, 'consultation_exports');
    return buffer;
  }

  async exportBuffer(query: ConsultationListQueryDto, user: AdminCurrentUser) {
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('网咨数据');
    const fields = await this.prisma.consultationFieldConfig.findMany({ where: { enabled: true, exportable: true }, orderBy: { listOrder: 'asc' } });
    sheet.addRow(fields.map((field) => field.listTitle || field.name));
    let page = 1; const all: any[] = [];
    while (true) {
      const result = await this.list({ ...query, page, pageSize: 200 }, user);
      if (result.total > 10000) throw new BusinessException(400820, '单次最多导出 10000 条，请缩小筛选范围');
      all.push(...result.list);
      if (all.length >= result.total) break;
      page++;
    }
    const canFullPhone = user.role === AdminRole.SUPER_ADMIN || user.permissions.includes('CONSULTATION_EXPORT_FULL_PHONE');
    if (canFullPhone && all.length) {
      const phones = await this.prisma.consultationForm.findMany({ where: { id: { in: all.map((item) => item.id) } }, select: { id: true, phoneEncrypted: true } });
      const phoneMap = new Map(phones.map((item) => [item.id, this.crypto.decryptPhone(item.phoneEncrypted)]));
      for (const row of all) row.exportPhone = phoneMap.get(row.id) || row.phone;
    }
    for (const row of all) sheet.addRow(fields.map((field) => this.exportValue(field.code, row, canFullPhone)));
    sheet.getRow(1).font = { bold: true }; sheet.columns.forEach((column, index) => { column.width = Math.max(12, Math.min(50, Math.round((fields[index]?.listWidth || 140) / 8))); });
    await this.log('EXPORT_CONSULTATIONS', `export-${Date.now()}`, null, { count: all.length, fullPhone: canFullPhone, filters: query }, user, undefined, undefined, 'consultation_exports');
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private async requireAccessible(id: string, user: AdminCurrentUser) {
    const row = await this.prisma.consultationForm.findUnique({ where: { id }, include: { status: true } });
    if (!row) throw new BusinessException(404801, '网咨表单不存在', 404);
    await this.dataScopes.assertOwned(user, row, 'ownerAdminId', 'createdByAdminId'); return row;
  }
  private async resolvePromotionSelection(accountId: string, project: string, channel: string) {
    const account = await this.prisma.promotionAccount.findFirst({
      where: { id: accountId, status: ContentStatus.ACTIVE },
      select: { id: true, name: true, project: true, platform: true }
    });
    if (!account) throw new BusinessException(400801, '所选推广账户不存在或已停用');
    if (account.project !== project || account.platform !== channel.trim()) {
      throw new BusinessException(400801, '项目、渠道来源与推广账户不匹配，请重新选择');
    }
    return account;
  }
  private async assignmentCandidates(ids: string[], user: AdminCurrentUser) {
    const uniqueIds = [...new Set(ids)];
    const rows = await this.prisma.consultationForm.findMany({ where: { id: { in: uniqueIds } } });
    const rowMap = new Map(rows.map((row) => [row.id, row]));
    const failures: Array<{ id: string; reason: string }> = [];
    const allowed: typeof rows = [];
    for (const id of uniqueIds) {
      const row = rowMap.get(id);
      if (!row) { failures.push({ id, reason: '表单不存在' }); continue; }
      try { await this.dataScopes.assertOwned(user, row, 'ownerAdminId', 'createdByAdminId'); allowed.push(row); }
      catch { failures.push({ id, reason: '超出当前数据范围' }); }
    }
    return { uniqueIds, allowed, failures };
  }
  private async activeStatus(id: string) { const row = await this.prisma.consultationStatus.findFirst({ where: { id, enabled: true } }); if (!row) throw new BusinessException(400802, '状态不存在或已停用'); return row; }
  private async activeTags(ids: string[]) { const unique = [...new Set(ids)]; if (!unique.length) return []; const rows = await this.prisma.consultationTag.findMany({ where: { id: { in: unique }, enabled: true } }); if (rows.length !== unique.length) throw new BusinessException(400806, '标签中包含不存在或已停用项'); return rows; }
  private async assertEligibleOwner(id: string) { const row = await this.prisma.adminUser.findFirst({ where: { id, status: AdminStatus.ACTIVE, deletedAt: null, consultationReceivable: true }, include: { customRole: true } }); if (!row) throw new BusinessException(400807, '负责人不存在、已停用或不可接收网咨表单'); const permissions = this.parsePermissions(row.customRole?.permissionsJson ?? row.permissionsJson); if (row.role !== AdminRole.SUPER_ADMIN && !permissions.includes('CONSULTATION_VIEW')) throw new BusinessException(400808, '负责人缺少网咨数据查看权限'); return row; }
  private requirePermission(user: AdminCurrentUser, permission: string) { if (user.role !== AdminRole.SUPER_ADMIN && !user.permissions.includes(permission)) throw new BusinessException(403801, '当前账号无此操作权限', 403); }
  private validateInvalidReason(category: ConsultationStatusCategory, reason?: string | null) { if (category === ConsultationStatusCategory.INVALID && !reason?.trim()) throw new BusinessException(400809, '无效状态必须填写无效原因'); }
  private async validateCustomData(data: Record<string, unknown>, creating: boolean) { const fields = await this.prisma.consultationFieldConfig.findMany({ where: { source: 'CUSTOM', enabled: true } }); const allowed = new Map(fields.map((field) => [field.code, field])); for (const key of Object.keys(data)) if (!allowed.has(key)) throw new BusinessException(400810, `自定义字段 ${key} 不存在或已停用`); for (const field of fields) { const value = data[field.code]; if (creating && field.required && (value === undefined || value === null || value === '')) throw new BusinessException(400811, `${field.name}不能为空`); if (value === undefined || value === null || value === '') continue; this.validateFieldValue(field, value); } return data; }
  private validateFieldValue(field: { name: string; type: ConsultationFieldType; optionsJson: Prisma.JsonValue | null }, value: unknown) { const options = this.parseStringArray(field.optionsJson); if (field.type === ConsultationFieldType.NUMBER && (typeof value !== 'number' || !Number.isFinite(value))) throw new BusinessException(400812, `${field.name}必须为数字`); if ((field.type === ConsultationFieldType.DATE || field.type === ConsultationFieldType.DATETIME) && Number.isNaN(new Date(String(value)).getTime())) throw new BusinessException(400813, `${field.name}日期格式不正确`); if (field.type === ConsultationFieldType.SINGLE && (!options.includes(String(value)))) throw new BusinessException(400814, `${field.name}选项无效`); if (field.type === ConsultationFieldType.MULTI && (!Array.isArray(value) || value.some((item) => !options.includes(String(item))))) throw new BusinessException(400815, `${field.name}选项无效`); }
  private fieldData(dto: ConsultationFieldDto, adminUserId: string): Prisma.ConsultationFieldConfigCreateInput { return { name: dto.name.trim(), code: dto.code, source: 'CUSTOM', type: dto.type, required: dto.required || false, enabled: dto.enabled !== false, showInForm: dto.showInForm !== false, showInDetail: dto.showInDetail !== false, showInList: dto.showInList || false, filterable: dto.filterable || false, exportable: dto.exportable || false, importable: dto.importable || false, listTitle: dto.listTitle?.trim() || dto.name.trim(), listOrder: dto.listOrder || 0, listWidth: dto.listWidth || 140, optionsJson: (dto.options || []) as Prisma.InputJsonValue, createdBy: { connect: { id: adminUserId } } }; }
  private fieldItem<T extends { optionsJson: Prisma.JsonValue | null }>(item: T) { return { ...item, options: this.parseStringArray(item.optionsJson), optionsJson: undefined }; }
  private exportValue(code: string, row: any, fullPhone: boolean) {
    const fixed: Record<string, unknown> = {
      name: row.name, phone: fullPhone ? row.exportPhone : row.phoneMasked, project: row.project?.name,
      channelSource: row.channelSource, accountName: row.accountName, tags: (row.tags || []).map((tag: any) => tag.name).join(','), status: row.status?.name,
      owner: row.owner?.nickname || row.owner?.username, recordedAt: this.formatDateTime(row.recordedAt),
      lastFollowUpAt: this.formatDateTime(row.lastFollowUpAt), lastFollowUpContent: row.lastFollowUpContent || '',
      nextFollowUpAt: this.formatDateTime(row.nextFollowUpAt),
      overdue: row.overdue ? '是' : '否', createdBy: row.createdBy?.nickname || row.createdBy?.username,
      createdAt: this.formatDateTime(row.createdAt), updatedAt: this.formatDateTime(row.updatedAt)
    };
    const value = code in fixed ? fixed[code] : row.customData?.[code];
    return Array.isArray(value) ? value.join(',') : value ?? '';
  }
  private formatDateTime(value?: Date | string | null) { return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : ''; }
  private formInclude() { return { project: { select: { id: true, name: true } }, promotionAccount: { select: { id: true, name: true, project: true, platform: true } }, status: true, owner: { select: { id: true, username: true, nickname: true } }, createdBy: { select: { id: true, username: true, nickname: true } }, lastOperatedBy: { select: { id: true, username: true, nickname: true } }, tags: { include: { tag: true } }, followUps: { take: 1, orderBy: { createdAt: 'desc' }, select: { content: true, createdAt: true } } } as const; }
  private formItem(row: any, user: AdminCurrentUser, includePhone = false, allowedCustomCodes: string[] = []) {
    const fullPhone = user.role === AdminRole.SUPER_ADMIN || user.permissions.includes('VIEW_FULL_PHONE');
    const sourceCustomData = row.customData && typeof row.customData === 'object' && !Array.isArray(row.customData) ? row.customData : {};
    const customData = Object.fromEntries(allowedCustomCodes.filter((code) => Object.prototype.hasOwnProperty.call(sourceCustomData, code)).map((code) => [code, sourceCustomData[code]]));
    const projectName = row.promotionAccount?.project || row.project?.name || '';
    return {
      ...row,
      phoneEncrypted: undefined,
      phoneHash: undefined,
      projectId: projectName || row.projectId,
      promotionAccountId: row.promotionAccount?.id || row.promotionAccountId || null,
      project: { id: projectName || row.projectId || '', name: projectName || '—' },
      accountName: row.promotionAccount?.name || '—',
      lastFollowUpContent: row.followUps?.[0]?.content || '',
      customData,
      phone: includePhone && fullPhone ? this.crypto.decryptPhone(row.phoneEncrypted) : row.phoneMasked,
      tags: (row.tags || []).map((item: any) => item.tag),
      overdue: Boolean(row.nextFollowUpAt && new Date(row.nextFollowUpAt) < new Date() && ![ConsultationStatusCategory.COMPLETED, ConsultationStatusCategory.INVALID].includes(row.status.category))
    };
  }
  private dateRange(from?: string, to?: string): Prisma.DateTimeFilter { return { ...(from ? { gte: dayjs.tz(from, BUSINESS_TIME_ZONE).startOf('day').toDate() } : {}), ...(to ? { lte: dayjs.tz(to, BUSINESS_TIME_ZONE).endOf('day').toDate() } : {}) }; }
  private parsePermissions(value: Prisma.JsonValue): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
  private parseStringArray(value: Prisma.JsonValue | null | undefined): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
  private async log(action: string, resourceId: string, before: unknown, after: unknown, user: AdminCurrentUser, ip?: string, userAgent?: string | string[], resourceType = 'consultation_forms') { await this.audit.create({ adminUserId: user.adminUserId, action, resourceType, resourceId, beforeJson: before === null ? undefined : before as Prisma.InputJsonValue, afterJson: after as Prisma.InputJsonValue, ip, userAgent: this.ua(userAgent) }); }
  private ua(value?: string | string[]) { return Array.isArray(value) ? value.join(',') : value; }
}
