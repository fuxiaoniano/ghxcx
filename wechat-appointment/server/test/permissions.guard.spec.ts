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

  it('accepts the new appointment permission for legacy protected routes', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['MANAGE_APPOINTMENTS']) } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(context(['APPOINTMENT_MANAGE']))).toBe(true);
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
});
