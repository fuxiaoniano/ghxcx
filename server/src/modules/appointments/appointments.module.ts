import { Module } from '@nestjs/common';
import { AppointmentsController, PublicAppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { FollowupForwarderModule } from '../followup-forwarder/followup-forwarder.module';
import { CryptoModule } from '../crypto/crypto.module';
import { ConfigsModule } from '../configs/configs.module';

@Module({
  imports: [NotificationsModule, FollowupForwarderModule, CryptoModule, ConfigsModule],
  controllers: [AppointmentsController, PublicAppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService]
})
export class AppointmentsModule {}
