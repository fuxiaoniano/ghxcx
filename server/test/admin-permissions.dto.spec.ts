import 'reflect-metadata';
import { validate } from 'class-validator';
import { CreateAdminWechatInviteDto } from '../src/modules/admin/dto';

describe('enterprise admin permissions DTO compatibility', () => {
  it('accepts all permissions introduced by the enterprise dental upgrade', async () => {
    const dto = Object.assign(new CreateAdminWechatInviteDto(), {
      nickname: '内容管理员',
      role: 'STAFF',
      permissions: ['HOME_MANAGE', 'DOCTOR_MANAGE', 'PACKAGE_MANAGE', 'APPOINTMENT_MANAGE', 'PROMOTION_SALARY', 'PROMOTION_OPERATIONS'],
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

  it('accepts all batch creative permissions in existing role and member DTO validation', async () => {
    const dto = Object.assign(new CreateAdminWechatInviteDto(), {
      nickname: '投放创意主管',
      role: 'STAFF',
      permissions: [
        'PROMOTION_CREATIVE_BATCH_VIEW', 'PROMOTION_CREATIVE_BATCH_CREATE',
        'PROMOTION_CREATIVE_BATCH_RETRY', 'PROMOTION_CREATIVE_BATCH_CANCEL',
        'PROMOTION_CREATIVE_TEMPLATE_VIEW', 'PROMOTION_CREATIVE_ASSET_VIEW',
        'PROMOTION_CREATIVE_RESULT_EXPORT',
      ],
      notifyEnabled: false,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts independently assignable appointment notification permission', async () => {
    const dto = Object.assign(new CreateAdminWechatInviteDto(), {
      nickname: '通知管理员', role: 'STAFF', permissions: ['SYSTEM_APPOINTMENT_NOTIFY'], notifyEnabled: false,
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
