import { WechatMiniService } from '../src/modules/wechat-mini/wechat-mini.service';

describe('WechatMiniService', () => {
  it('authorizes phone with mocked WeChat phone code', async () => {
    const config = { get: jest.fn((key: string) => (key === 'NODE_ENV' ? 'test' : '')) };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user_1' }) }
    };
    const auth = { signMini: jest.fn().mockReturnValue('jwt-token') };
    const crypto = {};
    const users = {
      findByPhone: jest.fn().mockResolvedValue(null),
      attachPhone: jest.fn().mockResolvedValue({ phoneMasked: '138****8000' })
    };
    const redis = {};
    const service = new WechatMiniService(config as any, prisma as any, auth as any, crypto as any, users as any, redis as any);

    const result = await service.authorizePhone('user_1', 'mock-phone-code');

    expect(users.attachPhone).toHaveBeenCalledWith('user_1', '13800138000');
    expect(result).toEqual({ token: 'jwt-token', phoneMasked: '138****8000', hasPhone: true });
  });

  it('asks for manual phone when WeChat returns a non-mainland phone number', async () => {
    const config = { get: jest.fn((key: string) => (key === 'NODE_ENV' ? 'production' : '')) };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user_1' }) }
    };
    const auth = { signMini: jest.fn().mockReturnValue('jwt-token') };
    const crypto = {};
    const users = {
      findByPhone: jest.fn().mockResolvedValue(null),
      attachPhone: jest.fn().mockResolvedValue({ phoneMasked: '139****9000' })
    };
    const redis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue('1'),
      del: jest.fn().mockResolvedValue(1)
    };
    const service = new WechatMiniService(config as any, prisma as any, auth as any, crypto as any, users as any, redis as any);
    jest.spyOn(service as any, 'getPhoneNumber').mockResolvedValue('+85291234567');

    const result = await service.authorizePhone('user_1', 'wechat-phone-code');
    const manualResult = await service.submitManualPhone('user_1', '13900139000');

    expect(redis.set).toHaveBeenCalledWith('mini:manual-phone:user_1', '1', 'EX', 600);
    expect(result).toMatchObject({ token: 'jwt-token', hasPhone: false, needManualPhone: true });
    expect(users.attachPhone).toHaveBeenCalledWith('user_1', '13900139000');
    expect(redis.del).toHaveBeenCalledWith('mini:manual-phone:user_1');
    expect(manualResult).toEqual({ token: 'jwt-token', phoneMasked: '139****9000', hasPhone: true });
  });

  it('rejects manual phone before WeChat phone authorization fallback is granted', async () => {
    const config = { get: jest.fn((key: string) => (key === 'NODE_ENV' ? 'test' : '')) };
    const prisma = {};
    const auth = { signMini: jest.fn().mockReturnValue('jwt-token') };
    const crypto = {};
    const users = {};
    const redis = {
      get: jest.fn().mockResolvedValue(null)
    };
    const service = new WechatMiniService(config as any, prisma as any, auth as any, crypto as any, users as any, redis as any);

    await expect(service.submitManualPhone('user_1', '13900139000')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 403104 })
    });
  });
});
