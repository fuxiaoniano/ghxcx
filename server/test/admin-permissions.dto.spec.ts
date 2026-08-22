import 'reflect-metadata';
import { validate } from 'class-validator';
import { CreateAdminWechatInviteDto } from '../src/modules/admin/dto';

describe('enterprise admin permissions DTO compatibility', () => {
  it('accepts all permissions introduced by the enterprise dental upgrade', async () => {
    const dto = Object.assign(new CreateAdminWechatInviteDto(), {
      nickname: '内容管理员',
      role: 'STAFF',
      permissions: ['HOME_MANAGE', 'DOCTOR_MANAGE', 'PACKAGE_MANAGE', 'APPOINTMENT_MANAGE'],
      notifyEnabled: true
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
