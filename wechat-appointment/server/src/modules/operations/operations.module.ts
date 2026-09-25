import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [OperationsController],
  providers: [OperationsService]
})
export class OperationsModule {}
