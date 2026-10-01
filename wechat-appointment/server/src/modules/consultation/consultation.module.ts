import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CryptoModule } from '../crypto/crypto.module';
import { ConsultationController } from './consultation.controller';
import { ConsultationService } from './consultation.service';

@Module({
  imports: [AuditLogsModule, CryptoModule],
  controllers: [ConsultationController],
  providers: [ConsultationService],
  exports: [ConsultationService]
})
export class ConsultationModule {}
