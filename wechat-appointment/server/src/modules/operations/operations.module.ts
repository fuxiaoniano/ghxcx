import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CryptoModule } from '../crypto/crypto.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { PromotionDataSyncService } from './promotion-data-sync.service';

@Module({
  imports: [AuditLogsModule, CryptoModule],
  controllers: [OperationsController],
  providers: [OperationsService, PromotionDataSyncService]
})
export class OperationsModule {}
