import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CryptoModule } from '../crypto/crypto.module';
import { ConsultationController } from './consultation.controller';
import { ConsultationService } from './consultation.service';
import { ConsultationReportController } from './consultation-report.controller';
import { ConsultationReportService } from './consultation-report.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditLogsModule, CryptoModule, NotificationsModule],
  controllers: [ConsultationController, ConsultationReportController],
  providers: [ConsultationService, ConsultationReportService],
  exports: [ConsultationService]
})
export class ConsultationModule {}
