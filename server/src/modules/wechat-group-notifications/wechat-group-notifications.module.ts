import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { WechatGroupNotificationsController } from './wechat-group-notifications.controller';
import { WechatGroupNotificationsService } from './wechat-group-notifications.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [WechatGroupNotificationsController],
  providers: [WechatGroupNotificationsService],
  exports: [WechatGroupNotificationsService]
})
export class WechatGroupNotificationsModule {}
