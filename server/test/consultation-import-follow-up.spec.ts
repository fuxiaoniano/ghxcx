import ExcelJS from 'exceljs';
import { ConsultationService } from '../src/modules/consultation/consultation.service';

describe('Consultation import follow-up columns', () => {
  it('adds the latest follow-up to the template while keeping the first follow-up column', async () => {
    const prisma = { consultationFieldConfig: { findMany: jest.fn().mockResolvedValue([]) } } as any;
    const service = new ConsultationService(prisma, {} as any, {} as any, {} as any, {} as any);
    jest.spyOn(service as any, 'ensureDefaults').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'log').mockResolvedValue(undefined);
    const buffer = await service.templateBuffer({ adminUserId: 'member-1' } as any);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const headers = (workbook.worksheets[0].getRow(1).values as string[]).filter(Boolean);
    expect(headers).toContain('首次跟进记录');
    expect(headers).toContain('最新跟进记录');
    expect(headers.indexOf('最新跟进记录')).toBe(headers.indexOf('首次跟进记录') + 1);
  });
});
