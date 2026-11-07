import ExcelJS from 'exceljs';
import { PromotionArrivalPatientsService } from '../src/modules/operations/promotion-arrival-patients.service';

describe('患者收费导入模板与账户归属', () => {
  const user = { adminUserId: 'admin-1', role: 'SUPER_ADMIN', permissions: [] } as any;
  const account = { id: 'account-1', name: '腾讯02', accountNo: '90913463', project: '重庆', platform: '腾讯营销', status: 'ACTIVE' };

  function service(fields: any[] = []) {
    const prisma = {
      promotionAccount: { findMany: jest.fn().mockResolvedValue([account]) },
      promotionArrivalField: { findMany: jest.fn().mockResolvedValue(fields) },
      promotionArrivalPatient: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)) },
      $transaction: jest.fn().mockImplementation((items) => Promise.all(items)),
    } as any;
    const crypto = { encryptPhone: jest.fn((value) => `encrypted:${value}`), hashPhone: jest.fn((value) => `hash:${value}`), maskPhone: jest.fn(() => '138****0000') } as any;
    const audit = { create: jest.fn().mockResolvedValue(undefined) } as any;
    const access = { where: jest.fn().mockResolvedValue({}) } as any;
    return { instance: new PromotionArrivalPatientsService(prisma, crypto, audit, access), prisma };
  }

  it('模板不再包含项目和渠道来源，且历史同名自定义字段不会产生第二个就诊类型', async () => {
    const { instance } = service([{ id: 'legacy', key: 'legacy_visit_type', label: '就诊类型', enabled: true, sort: 1 }, { id: 'custom', key: 'hospital', label: '院区', enabled: true, sort: 2 }]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await instance.templateBuffer(user) as any);
    const headers = workbook.worksheets[0].getRow(1).values as string[];
    expect(headers.filter((value) => value === '就诊类型')).toHaveLength(1);
    expect(headers).not.toContain('项目');
    expect(headers).not.toContain('渠道来源');
    expect(headers).not.toContain('账户名称');
    expect(headers).toContain('账户ID');
    expect(headers).toContain('院区');
    expect(workbook.worksheets[0].getRow(2).getCell(1).text).toBe('【示例数据，导入时自动忽略】张三');
    expect(workbook.worksheets[0].getRow(2).getCell(4).text).toBe('90913463');
    expect(workbook.worksheets[0].getCell(3, 4).dataValidation.formulae).toEqual(["'可选账户'!$A$2:$A$2"]);
    expect(workbook.getWorksheet('可选账户')?.state).toBe('veryHidden');
  });

  it('直接上传未修改模板时自动忽略示例行', async () => {
    const { instance, prisma } = service();
    const buffer = await instance.templateBuffer(user);
    const result = await instance.importBuffer({ buffer, originalname: '患者收费导入模板.xlsx' }, user);
    expect(result).toMatchObject({ imported: 0, failed: 0 });
    expect(prisma.promotionArrivalPatient.create).not.toHaveBeenCalled();
  });

  it('新模板仅凭腾讯账户ID自动补齐账户名称、项目和渠道', async () => {
    const { instance, prisma } = service();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('患者收费导入');
    sheet.addRow(['姓名', '电话', '就诊类型', '账户ID', '到院日期', '成交金额', '实收金额']);
    sheet.addRow(['测试患者', '13800000000', '初诊', '90913463', '2026-11-07', 800, 500]);
    const result = await instance.importBuffer({ buffer: Buffer.from(await workbook.xlsx.writeBuffer()), originalname: '患者收费.xlsx' }, user);
    expect(result).toMatchObject({ imported: 1, failed: 0 });
    expect(prisma.promotionArrivalPatient.create).toHaveBeenCalledWith({ data: expect.objectContaining({ accountName: '腾讯02', project: '重庆', channelSource: '腾讯营销' }) });
  });

  it('导入时兼容页面展示的账户名称与编号并自动写入项目和渠道来源', async () => {
    const { instance, prisma } = service();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('患者收费导入');
    sheet.addRow(['姓名', '电话', '就诊类型', '账户名称', '账户ID', '到院日期', '成交金额', '实收金额']);
    sheet.addRow(['测试患者', '13800000000', '复诊', '腾讯02 · 90913463', '', '2026-11-07', 1000, 600]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const result = await instance.importBuffer({ buffer, originalname: '患者收费.xlsx' }, user);
    expect(result).toMatchObject({ imported: 1, failed: 0 });
    expect(prisma.promotionArrivalPatient.create).toHaveBeenCalledWith({ data: expect.objectContaining({ accountId: 'account-1', accountName: '腾讯02', project: '重庆', channelSource: '腾讯营销', visitType: '复诊' }) });
  });

  it('账户信息带有额外说明时按唯一户号匹配', async () => {
    const { instance, prisma } = service();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('患者收费导入');
    sheet.addRow(['姓名', '电话', '就诊类型', '账户名称', '账户ID', '到院日期', '成交金额', '实收金额']);
    sheet.addRow(['测试患者', '13800000000', '初诊', '腾讯营销 / 重庆 / 90913463 / 智投账户', '', '2026-11-07', 0, 300]);
    const result = await instance.importBuffer({ buffer: Buffer.from(await workbook.xlsx.writeBuffer()), originalname: '患者收费.xlsx' }, user);
    expect(result).toMatchObject({ imported: 1, failed: 0 });
    expect(prisma.promotionArrivalPatient.create).toHaveBeenCalledWith({ data: expect.objectContaining({ accountId: 'account-1' }) });
  });
});
