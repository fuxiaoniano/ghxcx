import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { WechatOfficialAccountModule } from '../wechat-official-account/wechat-official-account.module';
import { WebsiteAdminController } from './website-admin.controller';
import { WebsiteController } from './website.controller';
import { WebsiteService } from './website.service';

@Module({
  imports: [WechatOfficialAccountModule, AuditLogsModule],
  controllers: [WebsiteController, WebsiteAdminController],
  providers: [WebsiteService]
})
export class WebsiteModule {}
