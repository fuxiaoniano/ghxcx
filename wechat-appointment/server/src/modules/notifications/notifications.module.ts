import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { WechatOfficialAccountModule } from '../wechat-official-account/wechat-official-account.module';
import { WechatMiniModule } from '../wechat-mini/wechat-mini.module';
import { ConfigsModule } from '../configs/configs.module';

@Module({
  imports: [WechatOfficialAccountModule, WechatMiniModule, ConfigsModule],
  providers: [NotificationsService],
  exports: [NotificationsService]
})
export class NotificationsModule {}
