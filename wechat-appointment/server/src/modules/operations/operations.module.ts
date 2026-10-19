import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CryptoModule } from '../crypto/crypto.module';
import { PromotionAccountAccessService } from '../../common/data-scope/promotion-account-access.service';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { PromotionDataSyncService } from './promotion-data-sync.service';
import { PromotionCreativeBatchService } from './promotion-creative-batch.service';
import { MultiAccountCreativeBatchService } from './multi-account-creative-batch.service';

@Module({
  imports: [AuditLogsModule, CryptoModule],
  controllers: [OperationsController],
  providers: [PromotionAccountAccessService, OperationsService, PromotionDataSyncService, PromotionCreativeBatchService, MultiAccountCreativeBatchService]
})
export class OperationsModule {}
