import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CryptoModule } from '../crypto/crypto.module';
import { TencentAdsLeadsAdminController } from './tencent-ads-leads-admin.controller';
import { TencentAdsLeadsController } from './tencent-ads-leads.controller';
import { TencentAdsLeadsService } from './tencent-ads-leads.service';

@Module({
  imports: [CryptoModule, AuditLogsModule],
  controllers: [TencentAdsLeadsController, TencentAdsLeadsAdminController],
  providers: [TencentAdsLeadsService]
})
export class TencentAdsLeadsModule {}
