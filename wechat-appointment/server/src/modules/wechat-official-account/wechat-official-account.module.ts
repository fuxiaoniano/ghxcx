import { Module } from '@nestjs/common';
import { WechatOfficialAccountController } from './wechat-official-account.controller';
import { WechatOfficialAccountService } from './wechat-official-account.service';
import { WechatMiniModule } from '../wechat-mini/wechat-mini.module';

@Module({
  imports: [WechatMiniModule],
  controllers: [WechatOfficialAccountController],
  providers: [WechatOfficialAccountService],
  exports: [WechatOfficialAccountService]
})
export class WechatOfficialAccountModule {}
