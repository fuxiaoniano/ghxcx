import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis.module';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { AuthModule } from './modules/auth/auth.module';
import { CryptoModule } from './modules/crypto/crypto.module';
import { UsersModule } from './modules/users/users.module';
import { ConfigsModule } from './modules/configs/configs.module';
import { ClinicsModule } from './modules/clinics/clinics.module';
import { WechatMiniModule } from './modules/wechat-mini/wechat-mini.module';
import { WechatOfficialAccountModule } from './modules/wechat-official-account/wechat-official-account.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { PublicPageController } from './public-page.controller';
import { EnterpriseModule } from './modules/enterprise/enterprise.module';
import { WebsiteModule } from './modules/website/website.module';
import { TencentAdsLeadsModule } from './modules/tencent-ads-leads/tencent-ads-leads.module';
import { OperationsModule } from './modules/operations/operations.module';
import { DataScopeModule } from './common/data-scope/data-scope.module';
import { ConsultationModule } from './modules/consultation/consultation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    DataScopeModule,
    RedisModule,
    CryptoModule,
    AuthModule,
    UsersModule,
    ConfigsModule,
    ClinicsModule,
    NotificationsModule,
    WechatMiniModule,
    WechatOfficialAccountModule,
    AppointmentsModule,
    AuditLogsModule,
    AdminModule,
    EnterpriseModule,
    WebsiteModule,
    TencentAdsLeadsModule,
    OperationsModule,
    ConsultationModule
  ],
  controllers: [PublicPageController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard
    }
  ]
})
export class AppModule {}
