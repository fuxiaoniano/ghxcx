import 'dotenv/config';
import { PrismaClient, AdminRole, AdminStatus, ClinicStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_INIT_USERNAME || 'admin';
  const nickname = process.env.ADMIN_INIT_NICKNAME || '傅小念';
  const password = process.env.ADMIN_INIT_PASSWORD || 'change-this-before-production';
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.adminUser.upsert({
    where: { username },
    create: {
      username,
      nickname,
      passwordHash,
      role: AdminRole.SUPER_ADMIN,
      permissionsJson: [
        'VIEW_FULL_PHONE',
        'EXPORT_FULL_PHONE',
        'MANAGE_APPOINTMENTS',
        'MANAGE_CONFIGS',
        'MANAGE_ADMINS'
      ],
      status: AdminStatus.ACTIVE
    },
    update: {
      passwordHash,
      nickname,
      role: AdminRole.SUPER_ADMIN,
      permissionsJson: [
        'VIEW_FULL_PHONE',
        'EXPORT_FULL_PHONE',
        'MANAGE_APPOINTMENTS',
        'MANAGE_CONFIGS',
        'MANAGE_ADMINS'
      ],
      status: AdminStatus.ACTIVE
    }
  });

  await prisma.systemConfig.upsert({
    where: { key: 'landingPage' },
    create: {
      key: 'landingPage',
      description: '小程序挂号落地页配置',
      valueJson: {
        brandName: '安心口腔咨询',
        activityTitle: '种植牙咨询挂号服务',
        originalPrice: '后台配置原价',
        activityPrice: '后台配置活动价',
        subsidyText: '名额有限，提交后以工作人员确认为准',
        includedItems: ['口腔情况咨询', '门店预约登记', '术前检查咨询'],
        filingNo: '请在后台填写备案号',
        institutionName: '请在后台填写机构名称',
        privacyAgreement:
          '我们仅收集挂号咨询所必需的信息，用于工作人员联系和预约服务。系统只提供挂号咨询，不作诊断承诺。',
        customerServicePhone: '请在后台填写客服电话',
        footerText: '本服务仅提供挂号咨询，不承诺诊断或治疗效果。',
        officialAccountTemplateId: '',
        miniSubscribeTemplateId: '',
        formOptions: {
          ageRanges: ['40岁以下', '40-50岁', '50-60岁', '60岁以上'],
          missingTeethTypes: ['单颗缺失', '多颗缺失', '半口缺失', '全口缺失', '不确定']
        }
      }
    },
    update: {}
  });

  const clinicCount = await prisma.clinic.count();
  if (clinicCount === 0) {
    await prisma.clinic.createMany({
      data: [
        {
          name: '默认咨询门店',
          address: '请在后台或数据库中修改门店地址',
          phone: '请在后台或数据库中修改门店电话',
          status: ClinicStatus.ACTIVE
        }
      ]
    });
  }

  console.log(`Seed completed. Admin username: ${username}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
