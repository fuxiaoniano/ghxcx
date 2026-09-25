import { Module } from '@nestjs/common';
import { AdminAuthController } from './admin-auth.controller';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { CryptoModule } from '../crypto/crypto.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ConfigsModule } from '../configs/configs.module';
import { WechatOfficialAccountModule } from '../wechat-official-account/wechat-official-account.module';
import { FollowupForwarderModule } from '../followup-forwarder/followup-forwarder.module';

@Module({
  imports: [
    AuthModule,
    CryptoModule,
    NotificationsModule,
    AuditLogsModule,
    ConfigsModule,
    WechatOfficialAccountModule,
    FollowupForwarderModule
  ],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminService],
  exports: [AdminService]
})
export class AdminModule {}
