import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EnterpriseAdminController } from './enterprise-admin.controller';
import { EnterpriseAppointmentsController, EnterpriseController } from './enterprise.controller';
import { EnterpriseAssetsController } from './enterprise-assets.controller';
import { EnterpriseService } from './enterprise.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [EnterpriseController, EnterpriseAppointmentsController, EnterpriseAdminController, EnterpriseAssetsController],
  providers: [EnterpriseService],
  exports: [EnterpriseService]
})
export class EnterpriseModule {}
