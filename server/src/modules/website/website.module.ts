import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { WebsiteAdminController } from './website-admin.controller';
import { WebsiteController } from './website.controller';
import { WebsiteService } from './website.service';
import { WechatOfficialAccountModule } from '../wechat-official-account/wechat-official-account.module';
import { AfterbeatAdminController } from './afterbeat-admin.controller';
import { AfterbeatController } from './afterbeat.controller';

@Module({
  imports: [AuditLogsModule, WechatOfficialAccountModule],
  controllers: [WebsiteController, WebsiteAdminController, AfterbeatController, AfterbeatAdminController],
  providers: [WebsiteService]
})
export class WebsiteModule {}
