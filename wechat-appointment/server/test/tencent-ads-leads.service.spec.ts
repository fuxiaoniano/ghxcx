import { createHash } from 'crypto';
import { TencentAdsLeadsService } from '../src/modules/tencent-ads-leads/tencent-ads-leads.service';

describe('TencentAdsLeadsService', () => {
  const token = 'test-token';
  const secret = 'test-secret';

  function createService() {
    const prisma = {
      tencentAdLead: {
        upsert: jest.fn().mockResolvedValue({ id: 'lead_1', leadsId: '100343432' }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn()
      }
    };
    const config = {
      get: jest.fn((key: string) => ({
        TENCENT_ADS_LEADS_TOKEN: token,
        TENCENT_ADS_LEADS_SECRET: secret,
        PHONE_HASH_SALT: 'salt',
        PHONE_ENCRYPTION_KEY: 'encryption-key'
      })[key])
    };
    const crypto = {
      encryptPhone: jest.fn().mockReturnValue('encrypted-phone'),
      hashPhone: jest.fn().mockReturnValue('hashed-phone'),
      maskPhone: jest.fn((phone: string) => `${phone.slice(0, 3)}****${phone.slice(-4)}`),
      decryptPhone: jest.fn().mockReturnValue('13800138000')
    };
    const audit = { create: jest.fn().mockResolvedValue({}) };
    return {
      service: new TencentAdsLeadsService(prisma as any, config as any, crypto as any, audit as any),
      prisma,
      crypto
    };
  }

  function signature(algorithm: 'SHA1' | 'SHA256' = 'SHA1') {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const digest = createHash(algorithm.toLowerCase())
      .update(`${token}.${timestamp}.${secret}`)
      .digest('hex');
    return Buffer.from(`${token},${timestamp},${digest}`).toString('base64');
  }

  it('accepts a valid Tencent push and stores phone data securely', async () => {
    const { service, prisma, crypto } = createService();
    const result = await service.receive({
      leads_id: 100343432,
      leads_name: '测试线索',
      leads_tel: '13800138000',
      id_number: '440101199001011234',
      campaign_name: '种植牙计划'
    }, signature(), 'SHA1');

    expect(result.code).toBe(0);
    expect(crypto.encryptPhone).toHaveBeenCalledWith('13800138000');
    expect(prisma.tencentAdLead.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { leadsId: '100343432' },
      create: expect.objectContaining({
        phoneEncrypted: 'encrypted-phone',
        phoneHash: 'hashed-phone',
        phoneMasked: '138****8000',
        rawPayload: expect.objectContaining({
          leads_tel: '138****8000',
          id_number: '[已脱敏]'
        })
      })
    }));
  });

  it('accepts SHA256 signatures', async () => {
    const { service } = createService();
    const result = await service.receive({ leads_id: 'lead-sha256' }, signature('SHA256'), 'SHA256');
    expect(result.code).toBe(0);
  });

  it('rejects an invalid signature without writing a lead', async () => {
    const { service, prisma } = createService();
    const result = await service.receive({ leads_id: 'lead-invalid' }, 'invalid', 'SHA1');
    expect(result).toEqual({ code: 2002, message: '签名校验失败', data: {} });
    expect(prisma.tencentAdLead.upsert).not.toHaveBeenCalled();
  });

  it('rejects a valid request without leads_id', async () => {
    const { service, prisma } = createService();
    const result = await service.receive({}, signature(), 'SHA1');
    expect(result).toEqual({ code: 2101, message: '缺少 leads_id', data: {} });
    expect(prisma.tencentAdLead.upsert).not.toHaveBeenCalled();
  });
});
