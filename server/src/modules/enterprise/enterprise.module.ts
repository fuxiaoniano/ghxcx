import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { FollowupForwarderModule } from '../followup-forwarder/followup-forwarder.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EnterpriseAdminController } from './enterprise-admin.controller';
import { EnterpriseAppointmentsController, EnterpriseController } from './enterprise.controller';
import { EnterpriseAssetsController } from './enterprise-assets.controller';
import { EnterpriseService } from './enterprise.service';

@Module({
  imports: [NotificationsModule, FollowupForwarderModule, AuditLogsModule],
  controllers: [EnterpriseController, EnterpriseAppointmentsController, EnterpriseAdminController, EnterpriseAssetsController],
  providers: [EnterpriseService],
  exports: [EnterpriseService]
})
export class EnterpriseModule {}
