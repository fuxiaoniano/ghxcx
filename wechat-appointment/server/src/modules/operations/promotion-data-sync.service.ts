import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import { randomBytes } from 'crypto';
import dayjs from 'dayjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';

export type PromotionSyncProvider = 'TENCENT_ADS' | 'OCEANENGINE';

type SyncResult = { provider: PromotionSyncProvider; synced: number; noData: number; skippedArchived: number; skipped: number; errors: string[] };
type TencentSyncExtra = { clientId?: string; clientSecretCipher?: string; refreshTokenCipher?: string; authorizedAccountId?: string; accessTokenExpiresAt?: string; refreshTokenExpiresAt?: string };

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
    if (this.running || minute !== 0 || ![10, 14, 22].includes(hour)) return;
    this.running = true;
    try { await this.sync(dayjs().subtract(1, 'day').format('YYYY-MM-DD')); }
    catch (error) { this.logger.error(`Scheduled promotion sync failed: ${error instanceof Error ? error.message : 'unknown error'}`); }
    finally { this.running = false; }
  }

  private async syncProvider(statDate: string, provider: PromotionSyncProvider, accountIds?: string[]): Promise<SyncResult> {
    const result: SyncResult = { provider, synced: 0, noData: 0, skippedArchived: 0, skipped: 0, errors: [] };
    // undefined 表示系统定时任务同步全部账户；显式空数组表示当前操作者没有任何可同步账户。
    // 两者必须严格区分，避免受限成员通过空选择意外触发全量同步。
    if (accountIds && accountIds.length === 0) {
      result.errors.push('当前数据范围内没有可同步的推广账户');
      return result;
    }
    const config = await this.prisma.promotionDataSyncConfig.findUnique({ where: { provider } });
    if (!config?.enabled) { result.errors.push('未启用同步设置'); return result; }
    const extra = (config.extraConfig || {}) as TencentSyncExtra;
    const canRefreshTencent = provider === 'TENCENT_ADS' && Boolean(extra.clientId && extra.clientSecretCipher && extra.refreshTokenCipher);
    if (!config.accessTokenCipher && !canRefreshTencent) { result.errors.push('未配置访问令牌'); return result; }
    const reportUrl = provider === 'TENCENT_ADS' ? config.reportUrl.replace('/v1.3/', '/v3.0/') : config.reportUrl;
    if (reportUrl !== config.reportUrl) await this.prisma.promotionDataSyncConfig.update({ where: { id: config.id }, data: { reportUrl } });
    const platformKeyword = provider === 'TENCENT_ADS' ? '腾讯' : '巨量';
    const accounts = await this.prisma.promotionAccount.findMany({ where: { status: 'ACTIVE', platform: { contains: platformKeyword }, ...(accountIds?.length ? { id: { in: accountIds } } : {}) } });
    if (!accounts.length) { result.errors.push('没有匹配的平台启用账户（请确认渠道名称和账户户号）'); return result; }
    let token = config.accessTokenCipher ? this.crypto.decryptText(config.accessTokenCipher) : '';
    let refreshAttempted = false;
    for (const account of accounts) {
      if (!account.accountNo) { result.skipped++; result.errors.push(`${account.name} 未填写户号`); continue; }
      const existing = await this.prisma.promotionDailyMetric.findUnique({ where: { accountId_statDate: { accountId: account.id, statDate: dayjs(statDate).startOf('day').toDate() } } });
      if (existing?.isArchived) { result.skippedArchived++; continue; }
      try {
        if (!token && canRefreshTencent) {
          token = await this.refreshTencentToken(config.id, extra);
          refreshAttempted = true;
        }
        let data;
        try {
          data = await this.fetchMetrics(provider, reportUrl, token, account.accountNo, statDate);
        } catch (error) {
          const shouldRefresh = canRefreshTencent && !refreshAttempted && error instanceof Error && error.message.includes('11002');
          if (!shouldRefresh) throw error;
          token = await this.refreshTencentToken(config.id, extra);
          refreshAttempted = true;
          data = await this.fetchMetrics(provider, reportUrl, token, account.accountNo, statDate);
        }
        if (!data) { result.noData++; continue; }
        if (this.isAllZeroTencentMetrics(provider, data)) { result.noData++; continue; }
        // 到院、成交、实收及自定义指标来自院内经营数据，不属于广告平台日报；同步时必须保留人工维护的值。
        const storedData = { ...data, validLeads: data.validLeads ?? existing?.validLeads ?? 0, appointments: existing?.appointments ?? 0, transactions: existing?.transactions ?? 0, revenue: existing?.revenue ?? 0, customMetrics: existing?.customMetrics ?? {}, remark: existing?.remark ?? null };
        await this.prisma.promotionDailyMetric.upsert({
          where: { accountId_statDate: { accountId: account.id, statDate: dayjs(statDate).startOf('day').toDate() } },
          create: { accountId: account.id, statDate: dayjs(statDate).startOf('day').toDate(), ...storedData, syncSource: provider, syncedAt: new Date() },
          update: { ...storedData, syncSource: provider, syncedAt: new Date() }
        });
        result.synced++;
      } catch (error) { result.errors.push(`${account.name}: ${error instanceof Error ? error.message : '同步失败'}`); }
    }
    const errorText = result.errors.length ? `；${result.errors.slice(0, 3).join('；')}` : '';
    await this.prisma.promotionDataSyncConfig.update({ where: { provider }, data: { lastSyncedAt: new Date(), lastSyncMessage: `同步 ${statDate}：成功 ${result.synced}，平台无数据 ${result.noData}，归档跳过 ${result.skippedArchived}，失败/跳过 ${result.errors.length}${errorText}` } });
    return result;
  }

  private async refreshTencentToken(configId: string, extra: TencentSyncExtra) {
    if (!extra.clientId || !extra.clientSecretCipher || !extra.refreshTokenCipher) throw new Error('腾讯 Token 已失效，且未完整配置应用 ID、Client Secret 和 Refresh Token');
    const response = await axios.get('https://api.e.qq.com/oauth/token', {
      params: {
        client_id: extra.clientId,
        client_secret: this.crypto.decryptText(extra.clientSecretCipher),
        grant_type: 'refresh_token',
        refresh_token: this.crypto.decryptText(extra.refreshTokenCipher),
      },
      timeout: 25_000,
    });
    const payload = response.data;
    if (Number(payload?.code) !== 0 || !payload?.data?.access_token) {
      throw new Error(payload?.message_cn || payload?.message || `腾讯刷新 Token 失败（${payload?.code ?? '未知错误'}）`);
    }
    const data = payload.data;
    const updatedExtra: TencentSyncExtra = {
      ...extra,
      authorizedAccountId: data.authorizer_info?.account_id ? String(data.authorizer_info.account_id) : extra.authorizedAccountId,
      accessTokenExpiresAt: new Date(Date.now() + Number(data.access_token_expires_in || 86400) * 1000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + Number(data.refresh_token_expires_in || 2592000) * 1000).toISOString(),
      refreshTokenCipher: data.refresh_token ? this.crypto.encryptText(String(data.refresh_token)) : extra.refreshTokenCipher,
    };
    await this.prisma.promotionDataSyncConfig.update({
      where: { id: configId },
      data: { accessTokenCipher: this.crypto.encryptText(String(data.access_token)), extraConfig: updatedExtra },
    });
    return String(data.access_token);
  }

  private async fetchMetrics(provider: PromotionSyncProvider, reportUrl: string, token: string, accountNo: string, statDate: string) {
    const params = provider === 'TENCENT_ADS'
      ? {
          access_token: token,
          timestamp: Math.floor(Date.now() / 1000),
          nonce: randomBytes(12).toString('hex'),
          account_id: accountNo,
          level: 'REPORT_LEVEL_ADVERTISER',
          date_range: JSON.stringify({ start_date: statDate, end_date: statDate }),
          group_by: JSON.stringify(['date']),
          fields: JSON.stringify(['date', 'cost', 'view_count', 'valid_click_count', 'conversions_count', 'effective_leads_count']),
          page: 1,
          page_size: 10,
        }
      : { advertiser_id: accountNo, start_date: statDate, end_date: statDate, data_level: 'AUCTION_ADVERTISER' };
    let payload: any;
    try {
      const response = await axios.get(reportUrl, { params, headers: provider === 'TENCENT_ADS' ? { 'Content-Type': 'application/json' } : { 'Access-Token': token, 'Content-Type': 'application/json' }, timeout: 25_000 });
      payload = response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as any;
        throw new Error(data?.message_cn || data?.message || data?.msg || `平台接口请求失败（HTTP ${error.response?.status || 0}）`);
      }
      throw error;
    }
    if (payload?.code && Number(payload.code) !== 0) {
      if (provider === 'TENCENT_ADS' && Number(payload.code) === 11002) {
        throw new Error('腾讯返回 11002：Access Token 无效或已过期。请填写腾讯广告 Marketing API 经 OAuth 获取的 access_token，不要填写 Authorization Code、Refresh Token、公众号 Token 或 App Secret');
      }
      throw new Error(payload.message_cn || payload.message || payload.msg || `平台返回错误 ${payload.code}`);
    }
    const rawRows = payload?.data?.list || payload?.data?.data || payload?.data || payload?.list || [];
    const rows = (Array.isArray(rawRows) ? rawRows : [rawRows]).filter((item) => item && typeof item === 'object');
    if (!rows.length) return null;
    const metricObject = (row: any) => {
      if (!Array.isArray(row.metrics)) return { ...row, ...(row.metrics && typeof row.metrics === 'object' ? row.metrics : {}) };
      const metrics = Object.fromEntries(row.metrics.map((item: any) => [item.field || item.name || item.key, item.value ?? item.metric_value ?? 0]));
      return { ...row, ...metrics };
    };
    const sources = rows.map(metricObject);
    const sum = (...keys: string[]) => sources.reduce((total, row) => {
      for (const key of keys) if (row[key] !== undefined && row[key] !== null && row[key] !== '') return total + (Number(row[key]) || 0);
      return total;
    }, 0);
    return {
      // 腾讯广告日报金额单位为分，后台统一以元存储。
      spend: provider === 'TENCENT_ADS' ? sum('cost') / 100 : sum('spend', 'stat_cost', 'cost', 'total_cost'),
      impressions: Math.round(sum('view_count', 'impression', 'impressions', 'show', 'show_count', 'stat_show')),
      clicks: Math.round(sum('valid_click_count', 'click', 'clicks', 'click_count', 'stat_click')),
      leads: Math.round(sum('conversions_count', 'overall_leads_purchase_count', 'target_conversion', 'conversion', 'leads', 'convert', 'convert_num', 'form_submit')),
      validLeads: provider === 'TENCENT_ADS' ? Math.round(sum('effective_leads_count', 'valid_leads_uv', 'valid_leads', 'valid_lead', 'valid_leads_count', 'effective_leads')) : undefined,
    };
  }

  private isAllZeroTencentMetrics(provider: PromotionSyncProvider, data: { spend: number; impressions: number; clicks: number; leads: number; validLeads?: number }) {
    if (provider !== 'TENCENT_ADS') return false;
    return [data.spend, data.impressions, data.clicks, data.leads, data.validLeads].every((value) => Number(value ?? 0) === 0);
  }
}
