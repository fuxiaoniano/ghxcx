import { ContentStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ConsultationService } from '../src/modules/consultation/consultation.service';
import { CreateConsultationDto } from '../src/modules/consultation/dto';

describe('ConsultationService promotion account selection', () => {
  const promotionAccount = {
    id: 'account-1',
    name: '腾讯01',
    project: '重庆',
    platform: '腾讯营销'
  };
  const prisma = {
    promotionAccount: {
      findFirst: jest.fn().mockResolvedValue(promotionAccount)
    }
  };
  const dataScopes = {
    ownershipWhere: jest.fn().mockResolvedValue({ OR: [{ ownerAdminId: { in: ['admin-1'] } }] })
  };
  const service = new ConsultationService(prisma as never, {} as never, {} as never, dataScopes as never);
  const user = { adminUserId: 'admin-1', role: 'STAFF', permissions: [], dataScope: 'SELF' } as any;

  beforeEach(() => jest.clearAllMocks());

  it('accepts an active promotion account when project and channel match', async () => {
    await expect((service as any).resolvePromotionSelection('account-1', '重庆', '腾讯营销', user))
      .resolves.toEqual(promotionAccount);
    expect(prisma.promotionAccount.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'account-1', status: ContentStatus.ACTIVE })
    }));
  });

  it('rejects forged project or channel values that do not match the account', async () => {
    await expect((service as any).resolvePromotionSelection('account-1', '绵阳', '腾讯营销', user))
      .rejects.toMatchObject({ status: 400 });
  });

  it('returns a full phone in the list serializer only for members with the phone permission', () => {
    const phoneCrypto = { decryptPhone: jest.fn().mockReturnValue('13812345678') };
    const phoneService = new ConsultationService(prisma as never, phoneCrypto as never, {} as never, dataScopes as never);
    const row = {
      phoneEncrypted: 'encrypted-phone', phoneMasked: '138****5678', customData: {}, tags: [],
      status: { category: 'IN_PROGRESS' }, nextFollowUpAt: null
    };

    const authorized = (phoneService as any).formItem(row, {
      role: 'STAFF', permissions: ['VIEW_FULL_PHONE']
    }, true, []);
    const unauthorized = (phoneService as any).formItem(row, {
      role: 'STAFF', permissions: []
    }, true, []);

    expect(authorized.phone).toBe('13812345678');
    expect(unauthorized.phone).toBe('138****5678');
    expect(phoneCrypto.decryptPhone).toHaveBeenCalledTimes(1);
  });

  it('accepts an empty next follow-up value as an optional date on manual entry', () => {
    const dto = plainToInstance(CreateConsultationDto, {
      name: '测试用户', phone: '13812345678', projectId: '重庆', channelSource: '腾讯营销',
      promotionAccountId: 'account-1', nextFollowUpAt: ''
    });

    expect(dto.nextFollowUpAt).toBeNull();
    expect(validateSync(dto)).toHaveLength(0);
  });
});
