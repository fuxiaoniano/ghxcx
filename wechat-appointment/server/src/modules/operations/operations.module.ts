import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CryptoModule } from '../crypto/crypto.module';
import { PromotionAccountAccessService } from '../../common/data-scope/promotion-account-access.service';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { PromotionDataSyncService } from './promotion-data-sync.service';
import { PromotionCreativeBatchService } from './promotion-creative-batch.service';
import { MultiAccountCreativeBatchService } from './multi-account-creative-batch.service';
import { SmartMonitorController } from './smart-monitor.controller';
import { SmartMonitorService } from './smart-monitor.service';
import { SmartMonitorActionsService } from './smart-monitor-actions.service';

@Module({
  imports: [AuditLogsModule, CryptoModule],
  controllers: [OperationsController, SmartMonitorController],
  providers: [PromotionAccountAccessService, OperationsService, PromotionDataSyncService, PromotionCreativeBatchService, MultiAccountCreativeBatchService, SmartMonitorService, SmartMonitorActionsService]
})
export class OperationsModule {}
