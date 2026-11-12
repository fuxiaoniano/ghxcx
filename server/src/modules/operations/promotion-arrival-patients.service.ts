import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { AdminCurrentUser } from '../../common/decorators/current-user.decorator';
import { PromotionAccountAccessService } from '../../common/data-scope/promotion-account-access.service';
import { BusinessException } from '../../common/utils/business-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CryptoService } from '../crypto/crypto.service';
import { PromotionArrivalFieldDto, PromotionArrivalPatientDto, PromotionArrivalPatientQueryDto } from './promotion-arrival-patients.dto';

@Injectable()
export class PromotionArrivalPatientsService {
  private readonly fixedFieldLabels = new Set(['序号', '姓名', '电话', '就诊类型', '项目', '渠道来源', '账户名称', '账户ID', '到院日期', '成交金额', '实收金额', '网电', '咨询师']);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditLogsService,
    private readonly promotionAccess: PromotionAccountAccessService,
  ) {}

  async meta(user: AdminCurrentUser) {
    const [accounts, fields] = await Promise.all([
      this.prisma.promotionAccount.findMany({
        where: await this.promotionAccess.where(user, 'DATA') as Prisma.PromotionAccountWhereInput,
        select: { id: true, name: true, accountNo: true, project: true, platform: true, status: true },
        orderBy: [{ project: 'asc' }, { platform: 'asc' }, { name: 'asc' }],
      }),
      this.fields(),
    ]);
    return { accounts, fields };
  }

  async list(query: PromotionArrivalPatientQueryDto, user: AdminCurrentUser) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const where = await this.listWhere(query, user);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.promotionArrivalPatient.count({ where }),
      this.prisma.promotionArrivalPatient.findMany({ where, include: { account: { select: { id: true, name: true, accountNo: true, project: true, platform: true } } }, orderBy: [{ arrivalDate: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { items: rows.map((row) => this.safeItem(row, user)), total, page, pageSize };
  }

  async templateBuffer(user: AdminCurrentUser) {
    const { accounts, fields } = await this.meta(user);
    const importFields = fields.filter((field) => field.enabled && !this.fixedFieldLabels.has(field.label.trim()));
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('患者收费导入');
    const headers = ['姓名', '电话', '就诊类型', '账户ID', '到院日期', '成交金额', '实收金额', '网电', '咨询师', ...importFields.map((field) => field.label)];
    sheet.addRow(headers);
    const sampleAccount = accounts[0];
    sheet.addRow(['【示例数据，导入时自动忽略】张三', '13800000000', '初诊', sampleAccount?.accountNo || sampleAccount?.id || '请填写账户ID', dayjs().format('YYYY-MM-DD'), 1000, 600, '示例网电', '示例咨询师', ...importFields.map(() => '')]);
    sheet.getRow(2).font = { color: { argb: 'FF909399' }, italic: true };
    if (accounts.length) {
      const accountOptions = workbook.addWorksheet('可选账户');
      accountOptions.addRow(['账户ID', '账户名称']);
      accounts.forEach((account) => accountOptions.addRow([account.accountNo || account.id, account.name]));
      accountOptions.state = 'veryHidden';
      for (let row = 2; row <= 1001; row += 1) sheet.getCell(row, 4).dataValidation = { type: 'list', allowBlank: false, formulae: [`'可选账户'!$A$2:$A$${accounts.length + 1}`] };
    }
    sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.columns.forEach((column) => { column.width = 16; });
    const instructions = workbook.addWorksheet('填写说明');
    instructions.addRows([
      ['字段', '填写要求'],
      ['姓名、电话、账户ID、到院日期、成交金额、实收金额', '必填'],
      ['账户ID', '填写腾讯账户户号；系统自动匹配账户名称、项目和渠道来源'],
      ['就诊类型', '可选：初诊、复诊；留空按初诊导入'],
      ['到院日期', '格式：YYYY-MM-DD'],
      ['成交金额、实收金额', '填写大于或等于 0 的数字'],
    ]);
    instructions.getRow(1).font = { bold: true };
    instructions.columns = [{ width: 54 }, { width: 52 }];
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async importBuffer(file: any, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    if (!file?.buffer || !file.originalname?.toLowerCase().endsWith('.xlsx')) throw new BusinessException(400764, '请上传 .xlsx 文件', 400);
    if (file.buffer.length < 4 || file.buffer.subarray(0, 2).toString('ascii') !== 'PK') throw new BusinessException(400764, '文件内容不是有效的 .xlsx 文件', 400);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(file.buffer as any);
    const sheet = workbook.worksheets[0]; if (!sheet || sheet.rowCount < 2) throw new BusinessException(400765, '导入文件没有患者数据', 400);
    if (sheet.rowCount > 1001) throw new BusinessException(400766, '单次最多导入 1000 条患者收费记录', 400);
    const headers = new Map<string, number>(); sheet.getRow(1).eachCell((cell, col) => headers.set(String(cell.text || '').trim(), col));
    for (const name of ['姓名', '电话', '账户ID', '到院日期', '成交金额', '实收金额']) if (!headers.has(name)) throw new BusinessException(400767, `导入文件缺少“${name}”列`, 400);
    const [accounts, fields] = await Promise.all([
      this.prisma.promotionAccount.findMany({ where: await this.promotionAccess.where(user, 'DATA') as Prisma.PromotionAccountWhereInput }),
      this.prisma.promotionArrivalField.findMany({ where: { enabled: true }, orderBy: { sort: 'asc' } }).then((items) => items.filter((field) => !this.fixedFieldLabels.has(field.label.trim()))),
    ]);
    const cellText = (row: ExcelJS.Row, name: string) => { const col = headers.get(name); return col ? String(row.getCell(col).text || '').trim() : ''; };
    const dateText = (row: ExcelJS.Row, name: string) => { const col = headers.get(name); if (!col) return ''; const value = row.getCell(col).value; return value instanceof Date ? dayjs(value).format('YYYY-MM-DD') : cellText(row, name); };
    const normalizeAccountLabel = (value: string) => value.trim().toLowerCase().replace(/[（）()·|\-—_\s]/g, '');
    const data: Prisma.PromotionArrivalPatientUncheckedCreateInput[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber); if (!row.hasValues) continue;
      try {
        const name = cellText(row, '姓名'), phone = cellText(row, '电话').replace(/\s+/g, ''), accountName = cellText(row, '账户名称'), accountId = cellText(row, '账户ID');
        if (name.startsWith('【示例数据，导入时自动忽略】')) continue;
        const arrivalDate = dateText(row, '到院日期'), visitType = cellText(row, '就诊类型') || '初诊';
        const validDate = /^\d{4}-\d{2}-\d{2}$/.test(arrivalDate) && dayjs(arrivalDate).format('YYYY-MM-DD') === arrivalDate;
        if (!name || !/^1\d{10}$/.test(phone) || !validDate) throw new Error('姓名、11位手机号或到院日期不正确');
        if (!accountName && !accountId) throw new Error('请填写账户ID');
        if (!['初诊', '复诊'].includes(visitType)) throw new Error('就诊类型只能为初诊或复诊');
        const normalizedInput = normalizeAccountLabel(accountName);
        const matches = accounts.filter((account) => {
          if (accountId) return account.id === accountId || normalizeAccountLabel(account.accountNo || '') === normalizeAccountLabel(accountId);
          const normalizedName = normalizeAccountLabel(account.name);
          const normalizedNo = normalizeAccountLabel(account.accountNo || '');
          return normalizedInput === normalizedName
            || Boolean(normalizedNo && normalizedInput === normalizedNo)
            || Boolean(normalizedNo && normalizedInput.includes(normalizedNo))
            || Boolean(normalizedName && normalizedInput.includes(normalizedName));
        });
        const accountInputLabel = accountId ? '账户ID' : '账户名称';
        const accountInputValue = accountId || accountName;
        if (matches.length !== 1) throw new Error(matches.length ? `${accountInputLabel}对应多个账户，请检查账户配置` : `${accountInputLabel}“${accountInputValue.slice(0, 40)}”未匹配到当前人员有权限的推广账户`);
        const transactionAmount = Number(cellText(row, '成交金额') || 0), receivedAmount = Number(cellText(row, '实收金额') || 0);
        if (!Number.isFinite(transactionAmount) || transactionAmount < 0 || !Number.isFinite(receivedAmount) || receivedAmount < 0) throw new Error('成交金额和实收金额必须为非负数字');
        const customSource = Object.fromEntries(fields.map((field) => [field.key, cellText(row, field.label)]));
        const customData = await this.validCustomData(customSource);
        const account = matches[0];
        data.push({ accountId: account.id, name, phoneEncrypted: this.crypto.encryptPhone(phone), phoneHash: this.crypto.hashPhone(phone), phoneMasked: this.crypto.maskPhone(phone), project: account.project, channelSource: account.platform, accountName: account.name, arrivalDate: dayjs(arrivalDate).startOf('day').toDate(), visitType, transactionAmount, receivedAmount, onlineConsultant: cellText(row, '网电') || null, consultant: cellText(row, '咨询师') || null, customData, createdByAdminId: user.adminUserId, updatedByAdminId: user.adminUserId });
      } catch (error) { errors.push({ row: rowNumber, message: error instanceof Error ? error.message : '数据校验失败' }); }
    }
    if (data.length) await this.prisma.$transaction(data.map((item) => this.prisma.promotionArrivalPatient.create({ data: item })));
    await this.log('IMPORT_PROMOTION_PATIENT_CHARGES', 'batch', undefined, { imported: data.length, failed: errors.length }, user, ip, userAgent);
    return { imported: data.length, failed: errors.length, errors: errors.slice(0, 100) };
  }

  async exportBuffer(query: PromotionArrivalPatientQueryDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const rows = await this.prisma.promotionArrivalPatient.findMany({ where: await this.listWhere(query, user), include: { account: { select: { id: true, accountNo: true } } }, orderBy: [{ arrivalDate: 'desc' }, { createdAt: 'desc' }] });
    const fields = (await this.prisma.promotionArrivalField.findMany({ where: { enabled: true }, orderBy: { sort: 'asc' } })).filter((field) => !this.fixedFieldLabels.has(field.label.trim()));
    const fullPhone = user.role === 'SUPER_ADMIN' || user.permissions.includes('EXPORT_FULL_PHONE');
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('患者收费明细');
    sheet.addRow(['序号', '姓名', '电话', '就诊类型', '项目', '渠道来源', '账户名称', '账户ID', '到院日期', '成交金额', '实收金额', '网电', '咨询师', ...fields.map((field) => field.label)]);
    rows.forEach((row, index) => sheet.addRow([index + 1, row.name, fullPhone ? this.crypto.decryptPhone(row.phoneEncrypted) : row.phoneMasked, row.visitType, row.project, row.channelSource, row.accountName, row.accountId, dayjs(row.arrivalDate).format('YYYY-MM-DD'), Number(row.transactionAmount), Number(row.receivedAmount), row.onlineConsultant || '', row.consultant || '', ...fields.map((field) => (row.customData as any)?.[field.key] ?? '')]));
    sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.columns.forEach((column) => { column.width = 16; });
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await this.log('EXPORT_PROMOTION_PATIENT_CHARGES', 'export', undefined, { count: rows.length, fullPhone }, user, ip, userAgent);
    return buffer;
  }

  async create(dto: PromotionArrivalPatientDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const account = await this.account(dto.accountId, user);
    const phone = dto.phone?.trim() || '';
    if (!phone) throw new BusinessException(400760, '请输入患者电话', 400);
    const customData = await this.validCustomData(dto.customData);
    const saved = await this.prisma.promotionArrivalPatient.create({ data: {
      ...this.baseData(dto, account, customData), phoneEncrypted: this.crypto.encryptPhone(phone), phoneHash: this.crypto.hashPhone(phone), phoneMasked: this.crypto.maskPhone(phone), createdByAdminId: user.adminUserId, updatedByAdminId: user.adminUserId,
    }, include: { account: { select: { id: true, name: true, accountNo: true, project: true, platform: true } } } });
    const item = this.safeItem(saved, user);
    await this.log('CREATE_PROMOTION_ARRIVAL_PATIENT', saved.id, undefined, this.auditItem(saved), user, ip, userAgent);
    return item;
  }

  async update(id: string, dto: PromotionArrivalPatientDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.row(id, user);
    const account = await this.account(dto.accountId, user);
    const customData = await this.validCustomData(dto.customData);
    const phone = dto.phone?.trim();
    const saved = await this.prisma.promotionArrivalPatient.update({ where: { id }, data: {
      ...this.baseData(dto, account, customData), ...(phone ? { phoneEncrypted: this.crypto.encryptPhone(phone), phoneHash: this.crypto.hashPhone(phone), phoneMasked: this.crypto.maskPhone(phone) } : {}), updatedByAdminId: user.adminUserId,
    }, include: { account: { select: { id: true, name: true, accountNo: true, project: true, platform: true } } } });
    const item = this.safeItem(saved, user);
    await this.log('UPDATE_PROMOTION_ARRIVAL_PATIENT', id, this.auditItem(before), this.auditItem(saved), user, ip, userAgent);
    return item;
  }

  async remove(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.row(id, user);
    await this.prisma.promotionArrivalPatient.delete({ where: { id } });
    await this.log('DELETE_PROMOTION_ARRIVAL_PATIENT', id, this.auditItem(before), undefined, user, ip, userAgent);
    return { id, deleted: true };
  }

  fields() { return this.prisma.promotionArrivalField.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }); }

  async createField(dto: PromotionArrivalFieldDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    await this.assertFieldLabel(dto.label);
    const field = await this.prisma.promotionArrivalField.create({ data: { key: `arrival_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, label: dto.label.trim(), dataType: dto.dataType, required: dto.required ?? false, enabled: dto.enabled ?? true, sort: dto.sort ?? 1000 } });
    await this.log('CREATE_PROMOTION_ARRIVAL_FIELD', field.id, undefined, field, user, ip, userAgent, 'promotion_arrival_fields');
    return field;
  }

  async updateField(id: string, dto: PromotionArrivalFieldDto, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.field(id);
    await this.assertFieldLabel(dto.label, id);
    const saved = await this.prisma.promotionArrivalField.update({ where: { id }, data: { label: dto.label.trim(), dataType: dto.dataType, required: dto.required ?? before.required, enabled: dto.enabled ?? before.enabled, sort: dto.sort ?? before.sort } });
    await this.log('UPDATE_PROMOTION_ARRIVAL_FIELD', id, before, saved, user, ip, userAgent, 'promotion_arrival_fields');
    return saved;
  }

  async deleteField(id: string, user: AdminCurrentUser, ip?: string, userAgent?: string | string[]) {
    const before = await this.field(id);
    await this.prisma.promotionArrivalField.delete({ where: { id } });
    await this.log('DELETE_PROMOTION_ARRIVAL_FIELD', id, before, undefined, user, ip, userAgent, 'promotion_arrival_fields');
    return { id, deleted: true };
  }

  private baseData(dto: PromotionArrivalPatientDto, account: { id: string; name: string; project: string; platform: string }, customData: Prisma.InputJsonValue | typeof Prisma.JsonNull) {
    return { accountId: account.id, name: dto.name.trim(), project: account.project, channelSource: account.platform, accountName: account.name, arrivalDate: dayjs(dto.arrivalDate).startOf('day').toDate(), visitType: dto.visitType, transactionAmount: dto.transactionAmount, receivedAmount: dto.receivedAmount, onlineConsultant: dto.onlineConsultant?.trim() || null, consultant: dto.consultant?.trim() || null, customData };
  }

  private async validCustomData(input?: Record<string, unknown>) {
    const fields = (await this.prisma.promotionArrivalField.findMany({ where: { enabled: true } })).filter((field) => !this.fixedFieldLabels.has(field.label.trim()));
    const source = input || {};
    const result: Record<string, string | number> = {};
    for (const field of fields) {
      const value = source[field.key];
      if ((value === undefined || value === null || value === '') && field.required) throw new BusinessException(400761, `请填写${field.label}`, 400);
      if (value === undefined || value === null || value === '') continue;
      if (field.dataType === 'NUMBER') {
        const number = Number(value);
        if (!Number.isFinite(number)) throw new BusinessException(400762, `${field.label}必须为数字`, 400);
        result[field.key] = number;
      } else if (field.dataType === 'DATE') {
        if (!dayjs(String(value)).isValid()) throw new BusinessException(400763, `${field.label}日期格式不正确`, 400);
        result[field.key] = dayjs(String(value)).format('YYYY-MM-DD');
      } else result[field.key] = String(value).slice(0, 1000);
    }
    return Object.keys(result).length ? result as Prisma.InputJsonValue : Prisma.JsonNull;
  }

  private async account(id: string, user: AdminCurrentUser) {
    const account = await this.prisma.promotionAccount.findUnique({ where: { id }, select: { id: true, name: true, project: true, platform: true, ownerAdminId: true, createdByAdminId: true } });
    if (!account) throw new BusinessException(404760, '推广账户不存在', 404);
    await this.promotionAccess.assertVisible(user, account, 'DATA');
    return account;
  }

  private async row(id: string, user: AdminCurrentUser) {
    const row = await this.prisma.promotionArrivalPatient.findUnique({ where: { id }, include: { account: { select: { id: true, name: true, accountNo: true, project: true, platform: true, ownerAdminId: true, createdByAdminId: true } } } });
    if (!row) throw new BusinessException(404761, '患者收费记录不存在', 404);
    await this.promotionAccess.assertVisible(user, row.account, 'DATA');
    return row;
  }

  private field(id: string) { return this.prisma.promotionArrivalField.findUnique({ where: { id } }).then((field) => { if (!field) throw new BusinessException(404762, '自定义字段不存在', 404); return field; }); }
  private async assertFieldLabel(label: string, exceptId?: string) {
    const value = label.trim();
    if (this.fixedFieldLabels.has(value)) throw new BusinessException(400768, '自定义字段名称不能与固定字段重复', 400);
    const duplicate = await this.prisma.promotionArrivalField.findFirst({ where: { label: value, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
    if (duplicate) throw new BusinessException(409760, '已存在同名自定义字段', 409);
  }
  private safeItem(row: any, user: AdminCurrentUser) {
    const fullPhone = user.role === 'SUPER_ADMIN' || user.permissions.includes('VIEW_FULL_PHONE');
    return { id: row.id, accountId: row.accountId, name: row.name, phone: fullPhone ? this.crypto.decryptPhone(row.phoneEncrypted) : row.phoneMasked, project: row.project, channelSource: row.channelSource, accountName: row.accountName, arrivalDate: dayjs(row.arrivalDate).format('YYYY-MM-DD'), visitType: row.visitType, transactionAmount: Number(row.transactionAmount), receivedAmount: Number(row.receivedAmount), onlineConsultant: row.onlineConsultant, consultant: row.consultant, customData: row.customData || {}, createdAt: row.createdAt, updatedAt: row.updatedAt, account: row.account };
  }
  private auditItem(row: any) { return { id: row.id, accountId: row.accountId, name: row.name, phone: row.phoneMasked, project: row.project, channelSource: row.channelSource, accountName: row.accountName, arrivalDate: dayjs(row.arrivalDate).format('YYYY-MM-DD'), visitType: row.visitType, transactionAmount: Number(row.transactionAmount), receivedAmount: Number(row.receivedAmount), onlineConsultant: row.onlineConsultant, consultant: row.consultant, customFieldKeys: Object.keys(row.customData && typeof row.customData === 'object' ? row.customData : {}) }; }
  private async listWhere(query: PromotionArrivalPatientQueryDto, user: AdminCurrentUser): Promise<Prisma.PromotionArrivalPatientWhereInput> {
    const scope = await this.promotionAccess.where(user, 'DATA') as Prisma.PromotionAccountWhereInput;
    const accountSelection: Prisma.PromotionAccountWhereInput = { ...(query.accountId ? { id: query.accountId } : {}), ...(query.project ? { project: query.project } : {}), ...(query.channelSource ? { platform: query.channelSource } : {}) };
    const keyword = query.keyword?.trim(); const exactPhoneHash = keyword && /^1\d{10}$/.test(keyword) ? this.crypto.hashPhone(keyword) : undefined;
    return { account: Object.keys(accountSelection).length ? { AND: [scope, accountSelection] } : scope, ...(query.dateFrom || query.dateTo ? { arrivalDate: { ...(query.dateFrom ? { gte: dayjs(query.dateFrom).startOf('day').toDate() } : {}), ...(query.dateTo ? { lte: dayjs(query.dateTo).startOf('day').toDate() } : {}) } } : {}), ...(keyword ? { OR: [{ name: { contains: keyword } }, { phoneMasked: { contains: keyword } }, { accountName: { contains: keyword } }, { onlineConsultant: { contains: keyword } }, { consultant: { contains: keyword } }, ...(exactPhoneHash ? [{ phoneHash: exactPhoneHash }] : [])] } : {}) };
  }
  private log(action: string, id: string, before: unknown, after: unknown, user: AdminCurrentUser, ip?: string, userAgent?: string | string[], resourceType = 'promotion_arrival_patients') { return this.audit.create({ adminUserId: user.adminUserId, action, resourceType, resourceId: id, beforeJson: before as Prisma.InputJsonValue, afterJson: after as Prisma.InputJsonValue, ip, userAgent: Array.isArray(userAgent) ? userAgent.join(',') : userAgent }); }
}
