import 'reflect-metadata';
import { validate } from 'class-validator';
import { CreateAdminWechatInviteDto } from '../src/modules/admin/dto';

describe('enterprise admin permissions DTO compatibility', () => {
  it('accepts all permissions introduced by the enterprise dental upgrade', async () => {
    const dto = Object.assign(new CreateAdminWechatInviteDto(), {
      nickname: '内容管理员',
      role: 'STAFF',
      permissions: ['HOME_MANAGE', 'DOCTOR_MANAGE', 'PACKAGE_MANAGE', 'APPOINTMENT_MANAGE', 'PROMOTION_SALARY'],
      notifyEnabled: true
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts every consultation permission without changing legacy permission codes', async () => {
    const dto = Object.assign(new CreateAdminWechatInviteDto(), {
      nickname: '网咨主管',
      role: 'STAFF',
      permissions: [
        'CONSULTATION_VIEW', 'CONSULTATION_CREATE', 'CONSULTATION_EDIT',
        'CONSULTATION_FOLLOW_UP', 'CONSULTATION_IMPORT', 'CONSULTATION_EXPORT',
        'CONSULTATION_EXPORT_FULL_PHONE', 'CONSULTATION_ASSIGN', 'CONSULTATION_SETTINGS',
        'MANAGE_APPOINTMENTS',
      ],
      notifyEnabled: false,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
