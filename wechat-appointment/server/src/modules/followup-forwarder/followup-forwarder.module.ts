import { Module } from '@nestjs/common';
import { CryptoModule } from '../crypto/crypto.module';
import { ConfigsModule } from '../configs/configs.module';
import { FollowupForwarderService } from './followup-forwarder.service';

@Module({
  imports: [CryptoModule, ConfigsModule],
  providers: [FollowupForwarderService],
  exports: [FollowupForwarderService]
})
export class FollowupForwarderModule {}
