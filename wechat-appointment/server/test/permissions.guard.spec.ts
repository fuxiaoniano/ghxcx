import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';

describe('PermissionsGuard', () => {
  function context(permissions: string[]) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'STAFF', permissions } })
      })
    } as any;
  }

  it('does not let a granular permission unlock a legacy aggregate route', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['MANAGE_APPOINTMENTS']) } as unknown as Reflector;
    expect(() => new PermissionsGuard(reflector).canActivate(context(['APPOINTMENT_MANAGE'])))
      .toThrow(expect.objectContaining({ status: 403 }));
  });

  it('accepts the legacy appointment permission for new protected routes', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['APPOINTMENT_MANAGE']) } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(context(['MANAGE_APPOINTMENTS']))).toBe(true);
  });

  it('accepts any one of the shared content upload permissions', () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => key === 'any_permissions'
        ? ['HOME_MANAGE', 'DOCTOR_MANAGE', 'PACKAGE_MANAGE']
        : undefined)
    } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(context(['DOCTOR_MANAGE']))).toBe(true);
  });

  it('requires the exact consultation permission and does not broaden it through legacy aliases', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['CONSULTATION_ASSIGN']) } as unknown as Reflector;
    expect(() => new PermissionsGuard(reflector).canActivate(context(['CONSULTATION_VIEW'])))
      .toThrow(expect.objectContaining({ status: 403 }));
    expect(new PermissionsGuard(reflector).canActivate(context(['CONSULTATION_ASSIGN']))).toBe(true);
  });

  it('always grants super administrators newly introduced permissions', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['CONSULTATION_SETTINGS']) } as unknown as Reflector;
    const superContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'SUPER_ADMIN', permissions: [] } }) }),
    } as any;
    expect(new PermissionsGuard(reflector).canActivate(superContext)).toBe(true);
  });

  it('keeps legacy promotion managers compatible with promotion operations', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['PROMOTION_OPERATIONS']) } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(context(['PROMOTION_MANAGE']))).toBe(true);
    expect(() => new PermissionsGuard(reflector).canActivate(context(['PROMOTION_DAILY'])))
      .toThrow(expect.objectContaining({ status: 403 }));
  });

  it('keeps legacy promotion managers compatible with batch creative routes without granting them to unrelated users', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['PROMOTION_CREATIVE_BATCH_CREATE']) } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(context(['PROMOTION_MANAGE']))).toBe(true);
    expect(() => new PermissionsGuard(reflector).canActivate(context(['PROMOTION_DAILY'])))
      .toThrow(expect.objectContaining({ status: 403 }));
  });

  it('keeps legacy promotion managers compatible with multi-account creative routes', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CREATE']) } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(context(['PROMOTION_MANAGE']))).toBe(true);
    expect(() => new PermissionsGuard(reflector).canActivate(context(['PROMOTION_DAILY'])))
      .toThrow(expect.objectContaining({ status: 403 }));
  });
});
