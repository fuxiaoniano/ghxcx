import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import dayjs from 'dayjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';

export type PromotionSyncProvider = 'TENCENT_ADS' | 'OCEANENGINE';

type SyncResult = { provider: PromotionSyncProvider; synced: number; skippedArchived: number; skipped: number; errors: string[] };

@Injectable()
export class PromotionDataSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PromotionDataSyncService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly crypto: CryptoService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.runScheduledSync(), 60_000);
    void this.runScheduledSync();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async sync(statDate: string, provider?: PromotionSyncProvider, accountIds?: string[]) {
    const providers: PromotionSyncProvider[] = provider ? [provider] : ['TENCENT_ADS', 'OCEANENGINE'];
    return Promise.all(providers.map((item) => this.syncProvider(statDate, item, accountIds)));
  }

  private async runScheduledSync() {
    const now = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const hour = Number(now.find((item) => item.type === 'hour')?.value); const minute = Number(now.find((item) => item.type === 'minute')?.value);
    if (this.running || minute !== 0 || (hour !== 10 && hour !== 14)) return;
    this.running = true;
    try { await this.sync(dayjs().subtract(1, 'day').format('YYYY-MM-DD')); }
    catch (error) { this.logger.error(`Scheduled promotion sync failed: ${error instanceof Error ? error.message : 'unknown error'}`); }
    finally { this.running = false; }
  }

  private async syncProvider(statDate: string, provider: PromotionSyncProvider, accountIds?: string[]): Promise<SyncResult> {
    const result: SyncResult = { provider, synced: 0, skippedArchived: 0, skipped: 0, errors: [] };
    const config = await this.prisma.promotionDataSyncConfig.findUnique({ where: { provider } });
    if (!config?.enabled) { result.errors.push('未启用同步设置'); return result; }
    if (!config.accessTokenCipher) { result.errors.push('未配置访问令牌'); return result; }
    const platformKeyword = provider === 'TENCENT_ADS' ? '腾讯' : '巨量';
    const accounts = await this.prisma.promotionAccount.findMany({ where: { status: 'ACTIVE', platform: { contains: platformKeyword }, ...(accountIds?.length ? { id: { in: accountIds } } : {}) } });
    if (!accounts.length) { result.errors.push('没有匹配的平台启用账户（请确认渠道名称和账户户号）'); return result; }
    const token = this.crypto.decryptText(config.accessTokenCipher);
    for (const account of accounts) {
      if (!account.accountNo) { result.skipped++; result.errors.push(`${account.name} 未填写户号`); continue; }
      const existing = await this.prisma.promotionDailyMetric.findUnique({ where: { accountId_statDate: { accountId: account.id, statDate: dayjs(statDate).startOf('day').toDate() } } });
      if (existing?.isArchived) { result.skippedArchived++; continue; }
      try {
        const data = await this.fetchMetrics(provider, config.reportUrl, token, account.accountNo, statDate);
        // 到院、成交、实收及自定义指标来自院内经营数据，不属于广告平台日报；同步时必须保留人工维护的值。
        const storedData = { ...data, validLeads: existing?.validLeads ?? 0, appointments: existing?.appointments ?? 0, transactions: existing?.transactions ?? 0, revenue: existing?.revenue ?? 0, customMetrics: existing?.customMetrics ?? {}, remark: existing?.remark ?? null };
        await this.prisma.promotionDailyMetric.upsert({
          where: { accountId_statDate: { accountId: account.id, statDate: dayjs(statDate).startOf('day').toDate() } },
          create: { accountId: account.id, statDate: dayjs(statDate).startOf('day').toDate(), ...storedData, syncSource: provider, syncedAt: new Date() },
          update: { ...storedData, syncSource: provider, syncedAt: new Date() }
        });
        result.synced++;
      } catch (error) { result.errors.push(`${account.name}: ${error instanceof Error ? error.message : '同步失败'}`); }
    }
    await this.prisma.promotionDataSyncConfig.update({ where: { provider }, data: { lastSyncedAt: new Date(), lastSyncMessage: `同步 ${statDate}：成功 ${result.synced}，归档跳过 ${result.skippedArchived}，失败/跳过 ${result.errors.length}` } });
    return result;
  }

  private async fetchMetrics(provider: PromotionSyncProvider, reportUrl: string, token: string, accountNo: string, statDate: string) {
    const params = provider === 'TENCENT_ADS'
      ? { advertiser_id: accountNo, date_range: JSON.stringify({ start_date: statDate, end_date: statDate }) }
      : { advertiser_id: accountNo, start_date: statDate, end_date: statDate, data_level: 'AUCTION_ADVERTISER' };
    const response = await axios.get(reportUrl, { params, headers: { 'Access-Token': token, 'Content-Type': 'application/json' }, timeout: 25_000 });
    const payload = response.data as any;
    if (payload?.code && Number(payload.code) !== 0) throw new Error(payload.message || payload.msg || `平台返回错误 ${payload.code}`);
    const rows = payload?.data?.list || payload?.data?.data || payload?.data || payload?.list || [];
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || typeof row !== 'object') throw new Error('平台未返回账户日报数据');
    const number = (...keys: string[]) => { for (const key of keys) { const value = row[key]; if (value !== undefined && value !== null && value !== '') return Number(value) || 0; } return 0; };
    return {
      spend: number('spend', 'stat_cost', 'cost', 'total_cost'),
      impressions: Math.round(number('impressions', 'show', 'show_count', 'stat_show')), clicks: Math.round(number('clicks', 'click', 'click_count', 'stat_click')),
      leads: Math.round(number('leads', 'convert', 'convert_num', 'form_submit'))
    };
  }
}
