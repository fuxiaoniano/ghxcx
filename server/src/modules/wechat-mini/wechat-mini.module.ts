import { Module } from '@nestjs/common';
import { WechatMiniMessageController } from './wechat-mini-message.controller';
import { WechatMiniController } from './wechat-mini.controller';
import { WechatMiniService } from './wechat-mini.service';
import { AuthModule } from '../auth/auth.module';
import { CryptoModule } from '../crypto/crypto.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuthModule, CryptoModule, UsersModule],
  controllers: [WechatMiniController, WechatMiniMessageController],
  providers: [WechatMiniService],
  exports: [WechatMiniService]
})
export class WechatMiniModule {}
