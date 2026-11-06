import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import axios from 'axios';
import { randomBytes } from 'crypto';
import dayjs from 'dayjs';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { BusinessException } from '../../common/utils/business-exception';
import { PromotionMaterialInput, PromotionMaterialType } from './promotion-material-health';

export type PromotionSyncProvider = 'TENCENT_ADS' | 'OCEANENGINE';

export class TencentMarketingApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly httpStatus = 400,
    public readonly retryable = false,
  ) { super(message); }
}

type SyncResult = { provider: PromotionSyncProvider; synced: number; noData: number; skippedArchived: number; skipped: number; errors: string[] };
type TencentSyncExtra = { clientId?: string; clientSecretCipher?: string; refreshTokenCipher?: string; userTokenCipher?: string; userTokenExpiresAt?: string; authorizedAccountId?: string; accessTokenExpiresAt?: string; refreshTokenExpiresAt?: string; sharedAccountNos?: string[] };
export type PromotionMaterialFetchResult = {
  items: PromotionMaterialInput[];
  coverage: Array<{ type: PromotionMaterialType; available: boolean; metricsAvailable: boolean; message: string }>;
  warnings: string[];
};

@Injectable()
export class PromotionDataSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PromotionDataSyncService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastScheduledSlot = '';
  private readonly refreshInFlight = new Map<string, Promise<string>>();

  constructor(private readonly prisma: PrismaService, private readonly crypto: CryptoService, @Optional() @Inject('REDIS') private readonly redis?: Redis) {}

  onModuleInit() {
    // Poll within the scheduled minute: a 60-second interval can stay phase-shifted
    // (for example, always at :37) and miss every exact :00 boundary.
    this.timer = setInterval(() => void this.runScheduledSync(), 10_000);
    void this.runScheduledSync();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async sync(statDate: string, provider?: PromotionSyncProvider, accountIds?: string[]) {
    const providers: PromotionSyncProvider[] = provider ? [provider] : ['TENCENT_ADS', 'OCEANENGINE'];
    return Promise.all(providers.map((item) => this.syncProvider(statDate, item, accountIds)));
  }

  private async runScheduledSync() {
    const schedule = this.getScheduledSync(new Date());
    if (!schedule || this.running || this.lastScheduledSlot === schedule.slot) return;
    this.running = true;
    let leaseTimer: NodeJS.Timeout | undefined;
    let acquired = false;
    const lockKey = `promotion-sync:slot:${schedule.slot}:lock`;
    const doneKey = `promotion-sync:slot:${schedule.slot}:done`;
    const token = randomBytes(16).toString('hex');
    try {
      if (!this.redis) throw new Error('Redis unavailable; scheduled sync skipped');
      if (await this.redis.get(doneKey)) { this.lastScheduledSlot = schedule.slot; return; }
      acquired = await this.redis.set(lockKey, token, 'PX', 120_000, 'NX') === 'OK';
      if (!acquired) return;
      if (await this.redis.get(doneKey)) { this.lastScheduledSlot = schedule.slot; return; }
      leaseTimer = setInterval(() => void this.redis!.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('pexpire',KEYS[1],ARGV[2]) else return 0 end", 1, lockKey, token, '120000').catch(() => this.logger.error('Scheduled promotion sync lease renewal failed')), 30_000);
      leaseTimer.unref();
      await this.sync(schedule.statDate);
      const completed = await this.redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then redis.call('set',KEYS[2],'1','EX',86400); return 1 else return 0 end", 2, lockKey, doneKey, token);
      if (completed === 1) this.lastScheduledSlot = schedule.slot;
      else this.logger.error('Scheduled promotion sync lease lost before completion');
    }
    catch (error) { this.logger.error(`Scheduled promotion sync failed: ${error instanceof Error ? error.message : 'unknown error'}`); }
    finally {
      if (leaseTimer) clearInterval(leaseTimer);
      if (acquired && this.redis) await this.redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", 1, lockKey, token).catch(() => this.logger.error('Scheduled promotion sync lease release failed'));
      this.running = false;
    }
  }

  private getScheduledSync(now: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
    const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
    const hour = Number(getPart('hour'));
    const minute = Number(getPart('minute'));
    const beijingDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
    if (minute > 14 || ![10, 14, 22].includes(hour)) return null;
    const statDate = hour === 10 ? dayjs(beijingDate).subtract(1, 'day').format('YYYY-MM-DD') : beijingDate;
    return { slot: `${beijingDate}-${hour}`, statDate };
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
    const legacyExtra = (config.extraConfig || {}) as TencentSyncExtra;
    const reportUrl = provider === 'TENCENT_ADS' ? config.reportUrl.replace('/v1.3/', '/v3.0/') : config.reportUrl;
    if (reportUrl !== config.reportUrl) await this.prisma.promotionDataSyncConfig.update({ where: { id: config.id }, data: { reportUrl } });
    const platformKeyword = provider === 'TENCENT_ADS' ? '腾讯' : '巨量';
    const accounts = await this.prisma.promotionAccount.findMany({ where: { status: 'ACTIVE', platform: { contains: platformKeyword }, ...(accountIds?.length ? { id: { in: accountIds } } : {}) } });
    if (!accounts.length) { result.errors.push('没有匹配的平台启用账户（请确认渠道名称和账户户号）'); return result; }
    for (const account of accounts) {
      if (!account.accountNo) { result.skipped++; result.errors.push(`${account.name} 未填写户号`); continue; }
      const existing = await this.prisma.promotionDailyMetric.findUnique({ where: { accountId_statDate: { accountId: account.id, statDate: dayjs(statDate).startOf('day').toDate() } } });
      if (existing?.isArchived) { result.skippedArchived++; continue; }
      try {
        const credential = await this.prisma.promotionAccountCredential.findUnique({ where: { accountId: account.id } });
        const tencentAuth = provider === 'TENCENT_ADS' ? this.resolveTencentAuth(credential, config, account.accountNo) : null;
        const extra: TencentSyncExtra = tencentAuth?.extra || legacyExtra;
        const canRefreshTencent = provider === 'TENCENT_ADS' && Boolean(extra.clientId && extra.clientSecretCipher && extra.refreshTokenCipher);
        let token = provider === 'TENCENT_ADS'
          ? tencentAuth?.tokenCipher ? this.crypto.decryptText(tencentAuth.tokenCipher) : ''
          : credential?.accessTokenCipher ? this.crypto.decryptText(credential.accessTokenCipher) : '';
        if (provider === 'OCEANENGINE' && !token) { result.skipped++; result.errors.push(`${account.name} 未配置账户 Access Token`); continue; }
        let refreshAttempted = false;
        if (!token && canRefreshTencent && tencentAuth) { token = await this.refreshTencentToken(extra, tencentAuth.target); refreshAttempted = true; }
        if (!token && provider === 'TENCENT_ADS') { result.skipped++; result.errors.push(`${account.name} 未配置腾讯业务单元或账户级 Access Token / 完整刷新凭证`); continue; }
        let data;
        try {
          data = await this.fetchMetrics(provider, reportUrl, token, account.accountNo, statDate);
        } catch (error) {
          const shouldRefresh = canRefreshTencent && !refreshAttempted && ((error instanceof TencentMarketingApiError && error.code === '11002') || (error instanceof Error && error.message.includes('11002')));
          if (!shouldRefresh) throw error;
          if (!canRefreshTencent || !tencentAuth) throw error;
          token = await this.refreshTencentToken(extra, tencentAuth.target);
          refreshAttempted = true;
          data = await this.fetchMetrics(provider, reportUrl, token, account.accountNo, statDate);
        }
        if (!data) { result.noData++; continue; }
        if (this.isAllZeroTencentMetrics(provider, data)) { result.noData++; continue; }
        // Only platform-owned fields are updated. The isArchived:false predicate makes this atomic
        // with archival, so an archive racing the platform request cannot be overwritten.
        const statDateValue = dayjs(statDate).startOf('day').toDate();
        const syncFields = {
          ...data,
          ...(data.validLeads === undefined ? {} : { validLeads: data.validLeads }),
          syncSource: provider,
          syncedAt: new Date(),
        };
        const updated = await this.prisma.promotionDailyMetric.updateMany({
          where: { accountId: account.id, statDate: statDateValue, isArchived: false },
          data: syncFields,
        });
        if (updated.count === 0) {
          const current = await this.prisma.promotionDailyMetric.findUnique({
            where: { accountId_statDate: { accountId: account.id, statDate: statDateValue } },
          });
          if (current?.isArchived) {
            result.skippedArchived++;
            continue;
          }
          if (current) throw new Error('同步期间记录状态发生变化，已拒绝覆盖');
          try {
            await this.prisma.promotionDailyMetric.create({
              data: {
                accountId: account.id,
                statDate: statDateValue,
                ...syncFields,
                validLeads: data.validLeads ?? 0,
              },
            });
          } catch (error) {
            // Another sync/manual insert may have won the unique-key race. Retry only through
            // the guarded update; if that row has since been archived it remains untouched.
            if ((error as { code?: string })?.code !== 'P2002') throw error;
            const raced = await this.prisma.promotionDailyMetric.findUnique({
              where: { accountId_statDate: { accountId: account.id, statDate: statDateValue } },
            });
            if (raced?.isArchived) {
              result.skippedArchived++;
              continue;
            }
            const retry = await this.prisma.promotionDailyMetric.updateMany({
              where: { accountId: account.id, statDate: statDateValue, isArchived: false },
              data: syncFields,
            });
            if (!retry.count) throw new Error('同步期间记录状态发生变化，已拒绝覆盖');
          }
        }
        result.synced++;
      } catch (error) { result.errors.push(`${account.name}: ${error instanceof Error ? error.message : '同步失败'}`); }
    }
    const errorText = result.errors.length ? `；${result.errors.slice(0, 3).join('；')}` : '';
    await this.prisma.promotionDataSyncConfig.update({ where: { provider }, data: { lastSyncedAt: new Date(), lastSyncMessage: `同步 ${statDate}：成功 ${result.synced}，平台无数据 ${result.noData}，归档跳过 ${result.skippedArchived}，失败/跳过 ${result.errors.length}${errorText}` } });
    return result;
  }

  private async refreshTencentToken(extra: TencentSyncExtra, target: { credentialId?: string; configId?: string }) {
    const key = target.configId ? `config:${target.configId}` : `credential:${target.credentialId || ''}`;
    const running = this.refreshInFlight.get(key);
    if (running) return running;
    const pending = this.performTencentTokenRefresh(extra, target);
    this.refreshInFlight.set(key, pending);
    try { return await pending; } finally { this.refreshInFlight.delete(key); }
  }

  private async performTencentTokenRefresh(extra: TencentSyncExtra, target: { credentialId?: string; configId?: string }) {
    if (!extra.clientId || !extra.clientSecretCipher || !extra.refreshTokenCipher) {
      throw new BusinessException(400924, '腾讯授权凭证不完整，请在推广数据同步设置或推广账户中重新配置授权');
    }
    const latestConfig = target.configId ? await this.prisma.promotionDataSyncConfig.findUnique({ where: { id: target.configId } }) : null;
    const latestCredential = target.credentialId ? await this.prisma.promotionAccountCredential.findUnique({ where: { id: target.credentialId } }) : null;
    const latestRefreshCipher = target.configId
      ? ((latestConfig?.extraConfig || {}) as TencentSyncExtra).refreshTokenCipher
      : latestCredential?.refreshTokenCipher;
    const latestAccessCipher = latestConfig?.accessTokenCipher || latestCredential?.accessTokenCipher;
    if (latestAccessCipher && latestRefreshCipher && latestRefreshCipher !== extra.refreshTokenCipher) {
      return this.crypto.decryptText(latestAccessCipher);
    }
    let response;
    try {
      response = await axios.get('https://api.e.qq.com/oauth/token', {
        params: {
          client_id: extra.clientId,
          client_secret: this.crypto.decryptText(extra.clientSecretCipher),
          grant_type: 'refresh_token',
          refresh_token: this.crypto.decryptText(extra.refreshTokenCipher),
        },
        timeout: 25_000,
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const code = String(error.response.data?.code ?? '');
        if (code === '11101' || code === '11102' || code === '11002') {
          throw new BusinessException(400925, '腾讯授权已失效，请在推广数据同步设置或推广账户中重新完成授权');
        }
      }
      throw new BusinessException(502924, '腾讯授权刷新请求失败，请稍后重试；若持续失败请检查授权状态', 502);
    }
    const payload = response.data;
    if (Number(payload?.code) !== 0 || !payload?.data?.access_token) {
      throw new BusinessException(400925, '腾讯授权已失效，请在推广数据同步设置或推广账户中重新完成授权');
    }
    const data = payload.data;
    const updatedExtra: TencentSyncExtra = {
      ...extra,
      authorizedAccountId: data.authorizer_info?.account_id ? String(data.authorizer_info.account_id) : extra.authorizedAccountId,
      accessTokenExpiresAt: new Date(Date.now() + Number(data.access_token_expires_in || 86400) * 1000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + Number(data.refresh_token_expires_in || 2592000) * 1000).toISOString(),
      refreshTokenCipher: data.refresh_token ? this.crypto.encryptText(String(data.refresh_token)) : extra.refreshTokenCipher,
    };
    if (target.credentialId) {
      await this.prisma.promotionAccountCredential.update({
        where: { id: target.credentialId },
        data: { accessTokenCipher: this.crypto.encryptText(String(data.access_token)), authorizedAccountId: updatedExtra.authorizedAccountId, accessTokenExpiresAt: new Date(updatedExtra.accessTokenExpiresAt!), refreshTokenExpiresAt: new Date(updatedExtra.refreshTokenExpiresAt!), ...(data.refresh_token ? { refreshTokenCipher: updatedExtra.refreshTokenCipher } : {}) },
      });
    } else if (target.configId) {
      await this.prisma.promotionDataSyncConfig.update({
        where: { id: target.configId },
        data: { accessTokenCipher: this.crypto.encryptText(String(data.access_token)), extraConfig: updatedExtra as any },
      });
    } else {
      throw new Error('腾讯令牌刷新目标未指定');
    }
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
        if (provider === 'TENCENT_ADS' && Number(data?.code) === 11002) throw new TencentMarketingApiError('11002', data?.message_cn || data?.message || '腾讯业务单元 Access Token 已失效');
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

  async fetchMaterialAnalysis(provider: PromotionSyncProvider, accountNo: string, dateFrom: string, dateTo: string): Promise<PromotionMaterialFetchResult> {
    const config = await this.prisma.promotionDataSyncConfig.findUnique({ where: { provider } });
    if (!config?.enabled) throw new Error('对应平台尚未启用同步设置');
    const { account, credential } = await this.accountCredentialByNo(accountNo, provider);
    const auth = provider === 'TENCENT_ADS' ? this.resolveTencentAuth(credential, config, accountNo) : null;
    const extra: TencentSyncExtra = auth?.extra || {};
    let token = provider === 'TENCENT_ADS'
      ? auth?.tokenCipher ? this.crypto.decryptText(auth.tokenCipher) : ''
      : credential?.accessTokenCipher ? this.crypto.decryptText(credential.accessTokenCipher) : '';
    if (!token && provider === 'TENCENT_ADS' && auth && extra.clientId && extra.clientSecretCipher && extra.refreshTokenCipher) token = await this.refreshTencentToken(extra, auth.target);
    if (!token) throw new Error(`${account.name} 未配置腾讯业务单元或账户级 Access Token`);
    if (provider !== 'TENCENT_ADS') return this.fetchOceanMaterials(token, accountNo);
    try {
      return await this.fetchTencentMaterials(token, accountNo, dateFrom, dateTo);
    } catch (error) {
      if (!(error instanceof TencentMarketingApiError) || error.code !== '11002' || !extra.clientId || !extra.clientSecretCipher || !extra.refreshTokenCipher || !auth) throw error;
      token = await this.refreshTencentToken(extra, auth.target);
      return this.fetchTencentMaterials(token, accountNo, dateFrom, dateTo);
    }
  }

  /** 腾讯 Marketing API v3 统一服务端调用。凭证只在本服务内解密，11002 仅刷新一次。 */
  async tencentApi(method: 'GET' | 'POST', path: string, accountNo: string, input: Record<string, unknown> = {}, injectAccountId = true, actorAdminId?: string) {
    if (!/^\/[a-z0-9_/-]+$/i.test(path)) throw new TencentMarketingApiError('INVALID_PATH', '腾讯广告接口路径不合法');
    if (!/^\d+$/.test(accountNo)) throw new TencentMarketingApiError('INVALID_ACCOUNT_ID', '腾讯广告账户 ID 格式不正确');
    const accountId = Number(accountNo);
    if (!Number.isSafeInteger(accountId) || accountId <= 0) throw new TencentMarketingApiError('INVALID_ACCOUNT_ID', '腾讯广告账户 ID 超出安全整数范围，已拒绝请求以避免精度丢失');
    const config = await this.prisma.promotionDataSyncConfig.findUnique({ where: { provider: 'TENCENT_ADS' } });
    if (!config?.enabled) throw new TencentMarketingApiError('TENCENT_NOT_ENABLED', '腾讯广告同步设置尚未启用');
    const { credential } = await this.accountCredentialByNo(accountNo, 'TENCENT_ADS');
    const auth = this.resolveTencentAuth(credential, config, accountNo);
    const extra = auth.extra;
    // An explicit task/request actor selects their own real-name token. Account
    // ownership or administrator visibility must never select another user's token.
    const sharedUserToken = actorAdminId ? await this.prisma.tencentUserToken.findUnique({ where: { adminUserId: actorAdminId } }) : null;
    const userTokenCipher = sharedUserToken?.tokenCipher || auth.userTokenCipher;
    const userTokenExpiresAt = sharedUserToken ? sharedUserToken.expiresAt : auth.userTokenExpiresAt;
    const userTokenExpired = Boolean(userTokenExpiresAt && new Date(userTokenExpiresAt).getTime() <= Date.now());
    const userToken = userTokenCipher && !userTokenExpired ? this.crypto.decryptText(userTokenCipher) : '';
    if (method === 'POST' && path === '/dynamic_creatives/add' && !userToken) {
      throw new TencentMarketingApiError(userTokenExpired ? '11102' : '11101', userTokenExpired ? '当前登录账号的腾讯 User Token 已过期，请重新扫码获取' : '当前登录账号缺少腾讯 User Token，请在推广账户页面扫码获取');
    }
    let token = auth.tokenCipher ? this.crypto.decryptText(auth.tokenCipher) : '';
    if (!token && extra.clientId && extra.clientSecretCipher && extra.refreshTokenCipher) token = await this.refreshTencentToken(extra, auth.target);
    if (!token) throw new TencentMarketingApiError('TENCENT_CREDENTIAL_MISSING', '未配置可用的腾讯业务单元或账户级 Access Token / 完整刷新凭证');
    try {
      return await this.rawTencentApi(method, path, token, injectAccountId ? { ...input, account_id: accountId } : input, userToken);
    } catch (error) {
      if (!(error instanceof TencentMarketingApiError) || error.code !== '11002') throw error;
      if (!extra.clientId || !extra.clientSecretCipher || !extra.refreshTokenCipher) throw error;
      token = await this.refreshTencentToken(extra, auth.target);
      return this.rawTencentApi(method, path, token, injectAccountId ? { ...input, account_id: accountId } : input, userToken);
    }
  }

  private async accountCredentialByNo(accountNo: string, provider: PromotionSyncProvider) {
    const platform = provider === 'TENCENT_ADS' ? '腾讯' : '巨量';
    const accounts = await this.prisma.promotionAccount.findMany({ where: { accountNo, status: 'ACTIVE', platform: { contains: platform } }, take: 2 });
    if (accounts.length !== 1) throw new Error(accounts.length ? '该平台户号对应多个本地账户，为避免凭证串用已阻断请求；请先合并或更正重复账户' : '该平台户号尚未登记为启用的推广账户');
    const account = accounts[0];
    const credential = await this.prisma.promotionAccountCredential.findUnique({ where: { accountId: account.id } });
    if (!credential && provider !== 'TENCENT_ADS') throw new Error(`账户 ${account.name} 尚未配置独立平台凭证`);
    return { account, credential };
  }

  /** Resolve account-scoped credentials first, then the legacy Tencent business-unit authorization. */
  private resolveTencentAuth(credential: any, config: any, accountNo?: string | null) {
    const sharedExtra = (config?.extraConfig || {}) as TencentSyncExtra;
    const accountExtra: TencentSyncExtra = {
      clientId: credential?.clientId || undefined,
      clientSecretCipher: credential?.clientSecretCipher || undefined,
      refreshTokenCipher: credential?.refreshTokenCipher || undefined,
      accessTokenExpiresAt: credential?.accessTokenExpiresAt?.toISOString(),
      refreshTokenExpiresAt: credential?.refreshTokenExpiresAt?.toISOString(),
      authorizedAccountId: credential?.authorizedAccountId || undefined,
    };
    const accountHasAccess = Boolean(credential?.accessTokenCipher || (accountExtra.clientId && accountExtra.clientSecretCipher && accountExtra.refreshTokenCipher));
    // A freshly validated business-unit authorization is a single rotating
    // credential shared by its verified accounts. Older unscoped credentials
    // retain their previous account-first behavior for compatibility.
    const verifiedShared = Array.isArray(sharedExtra.sharedAccountNos) && Boolean(accountNo) && sharedExtra.sharedAccountNos.includes(String(accountNo));
    const useAccount = accountHasAccess && !verifiedShared;
    const legacySharedAllowed = !Array.isArray(sharedExtra.sharedAccountNos);
    const extra = useAccount ? accountExtra : (verifiedShared || legacySharedAllowed ? sharedExtra : {});
    const tokenCipher = useAccount ? credential?.accessTokenCipher : (verifiedShared || legacySharedAllowed ? config?.accessTokenCipher : null);
    const userTokenCipher = credential?.userTokenCipher || sharedExtra.userTokenCipher;
    const userTokenExpiresAt = credential?.userTokenCipher ? credential?.userTokenExpiresAt?.toISOString() : sharedExtra.userTokenExpiresAt;
    return {
      tokenCipher: tokenCipher || null,
      extra,
      userTokenCipher: userTokenCipher || null,
      userTokenExpiresAt: userTokenExpiresAt || null,
      target: useAccount ? { credentialId: credential?.id } : { configId: config?.id },
    };
  }

  /** Safe status only: this method never returns ciphertext or plaintext credential values. */
  async tencentAccountCredentialStatus(accountId: string, actorAdminId: string) {
    const [account, credential, config, sharedUserToken] = await Promise.all([
      this.prisma.promotionAccount.findUnique({ where: { id: accountId }, select: { accountNo: true } }),
      this.prisma.promotionAccountCredential.findUnique({ where: { accountId } }),
      this.prisma.promotionDataSyncConfig.findUnique({ where: { provider: 'TENCENT_ADS' } }),
      this.prisma.tencentUserToken.findUnique({ where: { adminUserId: actorAdminId } }),
    ]);
    return { enabled: Boolean(config?.enabled), ...this.credentialStatus(credential, config, sharedUserToken, account?.accountNo) };
  }

  credentialStatus(credential: any, config: any, sharedUserToken?: { tokenCipher: string; expiresAt: Date | null } | null, accountNo?: string | null) {
    const auth = this.resolveTencentAuth(credential, config, accountNo);
    const hasRefresh = Boolean(auth.extra.clientId && auth.extra.clientSecretCipher && auth.extra.refreshTokenCipher);
    const tokenCipher = sharedUserToken?.tokenCipher || auth.userTokenCipher;
    const expiresAt = sharedUserToken ? sharedUserToken.expiresAt : auth.userTokenExpiresAt;
    const userTokenExpired = Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
    return { authorized: Boolean(auth.tokenCipher || hasRefresh), hasUserToken: Boolean(tokenCipher && !userTokenExpired), userTokenExpiresAt: expiresAt };
  }

  async validateTencentBusinessUnitAccess(accessToken: string, accounts: Array<{ accountNo: string; name: string }>) {
    const covered: Array<{ accountNo: string; name: string }> = [];
    const rejected: Array<{ accountNo: string; name: string; reason: string }> = [];
    for (const account of accounts) {
      const accountId = Number(account.accountNo);
      if (!/^\d+$/.test(account.accountNo) || !Number.isSafeInteger(accountId) || accountId <= 0) {
        rejected.push({ ...account, reason: '账户户号不合法' });
        continue;
      }
      try {
        await this.rawTencentApi('GET', '/adgroups/get', accessToken, { account_id: accountId, page: 1, page_size: 1 });
        covered.push(account);
      } catch (error) {
        if (error instanceof TencentMarketingApiError && (error.retryable || error.httpStatus >= 500 || error.code === '11002')) {
          throw new BusinessException(502925, '腾讯账户权限校验暂不可用，业务单元授权未保存，请稍后重试', 502);
        }
        rejected.push({ ...account, reason: '腾讯接口未确认该账户可访问' });
      }
    }
    return { covered, rejected };
  }

  private async rawTencentApi(method: 'GET' | 'POST', path: string, token: string, input: Record<string, unknown>, userToken = '') {
    // Tencent Marketing API Go SDK v1.7.71+ sends user_token in the URL query
    // alongside access_token. Keep it out of request bodies and persisted logs.
    const authParams = { access_token: token, timestamp: Math.floor(Date.now() / 1000), nonce: randomBytes(12).toString('hex'), ...(userToken ? { user_token: userToken } : {}) };
    try {
      const response = await axios.request({
        method,
        url: `https://api.e.qq.com/v3.0${path}`,
        ...(method === 'GET' ? { params: { ...input, ...authParams } } : { params: authParams, data: input }),
        headers: { 'Content-Type': 'application/json' },
        timeout: 30_000,
      });
      const payload = response.data;
      const code = String(payload?.code ?? '0');
      const requestId = String(payload?.request_id || payload?.data?.request_id || response.headers?.['x-tsa-trace-id'] || response.headers?.['x-request-id'] || '') || undefined;
      if (Number(code) !== 0) {
        const retryable = code === '11002' || /频率|限流|稍后重试/i.test(String(payload?.message_cn || payload?.message || ''));
        throw new TencentMarketingApiError(code, payload?.message_cn || payload?.message || `腾讯广告接口返回错误 ${code}`, requestId, 400, retryable);
      }
      return { data: payload?.data ?? {}, requestId, rateLimitRemaining: response.headers?.['x-ratelimit-remaining'] as string | undefined };
    } catch (error) {
      if (error instanceof TencentMarketingApiError) throw error;
      if (axios.isAxiosError(error)) {
        const payload = error.response?.data as any;
        const code = String(payload?.code || (error.code === 'ECONNABORTED' ? 'TIMEOUT' : `HTTP_${error.response?.status || 0}`));
        const message = payload?.message_cn || payload?.message || (error.code === 'ECONNABORTED' ? '腾讯广告接口请求超时，创建结果需要回查确认' : `腾讯广告接口请求失败（HTTP ${error.response?.status || 0}）`);
        throw new TencentMarketingApiError(code, message, payload?.request_id, error.response?.status || 502, error.code === 'ECONNABORTED' || error.response?.status === 429 || Number(error.response?.status) >= 500);
      }
      throw error;
    }
  }

  private async fetchTencentMaterials(token: string, accountNo: string, dateFrom: string, dateTo: string): Promise<PromotionMaterialFetchResult> {
    const warnings: string[] = [];
    const items: PromotionMaterialInput[] = [];
    const coverage: PromotionMaterialFetchResult['coverage'] = [];
    for (const definition of [
      { type: 'VIDEO' as const, level: 'REPORT_LEVEL_MATERIAL_VIDEO' },
      { type: 'IMAGE' as const, level: 'REPORT_LEVEL_MATERIAL_IMAGE' },
    ]) {
      try {
        const reportQuery = {
          account_id: accountNo,
          level: definition.level,
          date_range: JSON.stringify({ start_date: dateFrom, end_date: dateTo }),
          group_by: JSON.stringify(['material_id']),
          fields: JSON.stringify(['material_id', 'cost', 'view_count', 'valid_click_count', 'conversions_count', 'conversions_cost']),
          page: 1,
          page_size: 1000,
        };
        const rows: any[] = [];
        let fields = reportQuery.fields;
        for (let page = 1; page <= 10; page += 1) {
          let payload;
          try {
            payload = await this.platformGet('https://api.e.qq.com/v3.0/daily_reports/get', token, { ...reportQuery, page, fields }, 'TENCENT_ADS');
          } catch (error) {
            if (error instanceof TencentMarketingApiError && error.code === '11002') throw error;
            if (fields !== reportQuery.fields) throw error;
            // 部分账户不支持转化成本字段，保持消费可见并明确实际成本缺失。
            fields = JSON.stringify(['material_id', 'cost', 'view_count', 'valid_click_count', 'conversions_count']);
            payload = await this.platformGet('https://api.e.qq.com/v3.0/daily_reports/get', token, { ...reportQuery, page, fields }, 'TENCENT_ADS');
          }
          const current = this.responseRows(payload);
          rows.push(...current);
          const totalPage = Number(payload?.data?.page_info?.total_page || 0);
          if (!current.length || (totalPage ? page >= totalPage : current.length < 1000)) break;
          if (page === 10) warnings.push(`${definition.type === 'VIDEO' ? '视频' : '图片'}效果报表超过 10 页安全上限，结果可能不完整`);
        }
        for (const row of rows) {
          const flat = this.flattenMetricRow(row);
          const id = String(flat.material_id || flat.id || `${definition.type}-${items.length + 1}`);
          items.push({
            id,
            type: definition.type,
            name: String(flat.material_name || flat.name || `${definition.type === 'VIDEO' ? '视频' : '图片'}素材 ${id}`),
            previewUrl: this.firstString(flat, ['preview_url', 'url', 'video_url', 'image_url']),
            metrics: {
              spend: Number(flat.cost || 0) / 100,
              impressions: Number(flat.view_count || 0),
              clicks: Number(flat.valid_click_count || 0),
              conversions: Number(flat.conversions_count || 0),
              actualCpa: flat.conversions_cost === undefined || flat.conversions_cost === null || flat.conversions_cost === '' || !Number.isFinite(Number(flat.conversions_cost))
                ? null : Number(flat.conversions_cost) / 100,
            },
          });
        }
        coverage.push({ type: definition.type, available: true, metricsAvailable: true, message: `已读取 ${rows.length} 条素材效果数据` });
      } catch (error) {
        if (error instanceof TencentMarketingApiError && error.code === '11002') throw error;
        const message = error instanceof Error ? error.message : '读取失败';
        warnings.push(`${definition.type === 'VIDEO' ? '视频' : '图片'}素材：${message}`);
        coverage.push({ type: definition.type, available: false, metricsAvailable: false, message });
      }
    }

    try {
      const rows: any[] = [];
      for (let page = 1; page <= 10; page += 1) {
        const payload = await this.platformGet('https://api.e.qq.com/v3.0/adcreatives/get', token, {
          account_id: accountNo, filtering: JSON.stringify({}), page, page_size: 500,
        }, 'TENCENT_ADS');
        const current = this.responseRows(payload);
        rows.push(...current);
        const totalPage = Number(payload?.data?.page_info?.total_page || 0);
        if (!current.length || (totalPage ? page >= totalPage : current.length < 500)) break;
        if (page === 10) warnings.push('创意配置超过 10 页安全上限，组件盘点可能不完整');
      }
      // 新建创意走动态创意接口；仅查旧版创意会漏掉刚创建的组件。
      try {
        for (let page = 1; page <= 10; page += 1) {
          const response = await this.tencentApi('GET', '/dynamic_creatives/get', accountNo, {
            fields: JSON.stringify(['dynamic_creative_id', 'creative_components']), page, page_size: 100, is_deleted: false,
          });
          const current = this.responseRows(response);
          rows.push(...current);
          const totalPage = Number((response.data as any)?.page_info?.total_page || 0);
          if (!current.length || (totalPage ? page >= totalPage : current.length < 100)) break;
          if (page === 10) warnings.push('动态创意超过 10 页安全上限，组件盘点可能不完整');
        }
      } catch (error) {
        warnings.push(`动态创意组件读取失败：${error instanceof Error ? error.message : '未知错误'}`);
      }
      const discovered = this.extractConfigurationMaterials(rows);
      for (const item of discovered) if (!items.some((current) => current.type === item.type && current.id === item.id)) items.push(item);
      for (const type of ['COPY', 'LANDING_PAGE', 'BRAND', 'ACTION_BUTTON', 'MINI_CARD_LINK', 'TEXT_LINK', 'FLOATING_ZONE', 'LABEL', 'SOCIAL_SKILL'] as PromotionMaterialType[]) {
        const count = discovered.filter((item) => item.type === type).length;
        coverage.push({ type, available: true, metricsAvailable: false, message: `已读取 ${count} 项配置；平台未提供该层级独立效果归因` });
      }
    } catch (error) {
      if (error instanceof TencentMarketingApiError && error.code === '11002') throw error;
      const message = error instanceof Error ? error.message : '读取创意配置失败';
      warnings.push(`标题、落地页及转化组件：${message}`);
      for (const type of ['COPY', 'LANDING_PAGE', 'BRAND', 'ACTION_BUTTON', 'MINI_CARD_LINK', 'TEXT_LINK', 'FLOATING_ZONE', 'LABEL', 'SOCIAL_SKILL'] as PromotionMaterialType[]) coverage.push({ type, available: false, metricsAvailable: false, message });
    }
    return { items: items.slice(0, 1500), coverage, warnings };
  }

  private async fetchOceanMaterials(token: string, accountNo: string): Promise<PromotionMaterialFetchResult> {
    const items: PromotionMaterialInput[] = [];
    const warnings: string[] = [];
    const coverage: PromotionMaterialFetchResult['coverage'] = [];
    try {
      const projectsPayload = await this.platformGet('https://api.oceanengine.com/open_api/v3.0/project/get/', token, { advertiser_id: accountNo, page: 1, page_size: 100 }, 'OCEANENGINE');
      const projects = this.responseRows(projectsPayload).slice(0, 20);
      for (const type of ['VIDEO', 'IMAGE', 'TITLE', 'OTHER'] as const) {
        let fetched = 0;
        for (const project of projects) {
          const projectId = project.project_id || project.id;
          if (!projectId) continue;
          try {
            const payload = await this.platformGet('https://api.oceanengine.com/open_api/v3.0/uni_project/material/get/', token, { advertiser_id: accountNo, project_id: projectId, material_type: type, page: 1, page_size: 100 }, 'OCEANENGINE');
            const rows = this.responseRows(payload);
            const mappedType: PromotionMaterialType = type === 'OTHER' ? 'ACTION_BUTTON' : type === 'TITLE' ? 'COPY' : type;
            rows.forEach((row, index) => items.push(this.oceanMaterial(row, mappedType, `${projectId}-${type}-${index}`)));
            if (type === 'OTHER') {
              const configs = this.extractConfigurationMaterials(rows);
              configs.filter((item) => !['VIDEO', 'IMAGE'].includes(item.type)).forEach((item) => items.push(item));
            }
            fetched += rows.length;
          } catch (error) {
            warnings.push(`项目 ${projectId} 的 ${type} 素材读取失败：${error instanceof Error ? error.message : '未知错误'}`);
          }
        }
        const mappedType: PromotionMaterialType = type === 'OTHER' ? 'ACTION_BUTTON' : type === 'TITLE' ? 'COPY' : type;
        coverage.push({ type: mappedType, available: fetched > 0 || projects.length > 0, metricsAvailable: false, message: `已读取 ${fetched} 项配置；效果指标需平台自定义报表授权` });
      }
      const landingCount = items.filter((item) => item.type === 'LANDING_PAGE').length;
      coverage.push({ type: 'LANDING_PAGE', available: projects.length > 0, metricsAvailable: false, message: `已从项目其他素材中识别 ${landingCount} 个落地页` });
      if (!projects.length) warnings.push('平台未返回可分析的投放项目');
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取项目失败';
      warnings.push(message);
      for (const type of ['VIDEO', 'IMAGE', 'COPY', 'LANDING_PAGE', 'BRAND', 'ACTION_BUTTON', 'MINI_CARD_LINK', 'TEXT_LINK', 'FLOATING_ZONE', 'LABEL', 'SOCIAL_SKILL'] as PromotionMaterialType[]) coverage.push({ type, available: false, metricsAvailable: false, message });
    }
    return { items: this.deduplicateMaterials(items).slice(0, 1500), coverage, warnings };
  }

  private oceanMaterial(row: any, type: PromotionMaterialType, fallbackId: string): PromotionMaterialInput {
    const id = String(row.material_id || row.video_id || row.image_id || row.title_id || row.id || fallbackId);
    return {
      id,
      type,
      name: String(row.title || row.material_name || row.name || row.text || `${this.materialTypeLabel(type)} ${id}`),
      status: row.status ? String(row.status) : null,
      previewUrl: this.firstString(row, ['url', 'video_url', 'image_url', 'preview_url', 'web_url', 'external_url']),
      metrics: null,
      attributionNote: '巨量引擎项目素材接口用于配置盘点；独立效果指标需账户开放相应自定义报表维度。',
      officialLowEfficiency: Boolean(row.is_inefficient || row.low_efficiency),
    };
  }

  private extractConfigurationMaterials(value: unknown): PromotionMaterialInput[] {
    const result: PromotionMaterialInput[] = [];
    const visit = (node: unknown, path = '') => {
      if (Array.isArray(node)) { node.forEach((item, index) => visit(item, `${path}.${index}`)); return; }
      if (!node || typeof node !== 'object') return;
      for (const [key, raw] of Object.entries(node as Record<string, unknown>)) {
        const nextPath = path ? `${path}.${key}` : key;
        if (typeof raw === 'string' || typeof raw === 'number') {
          const text = String(raw).trim();
          if (!text) continue;
          const lower = key.toLowerCase();
          let type: PromotionMaterialType | null = null;
          if (/(^|_)(title|headline|description|copy|text)$/.test(lower)) type = 'COPY';
          else if (/(landing|page_url|site_url|external_url|web_url)/.test(lower)) type = 'LANDING_PAGE';
          else if (/(floating_zone|floating_card)/.test(lower)) type = 'FLOATING_ZONE';
          else if (/(mini_card_link|image_text_link)/.test(lower)) type = 'MINI_CARD_LINK';
          else if (/(text_link|word_link)/.test(lower)) type = 'TEXT_LINK';
          else if (/(social_skill|first_comment|comment_reply)/.test(lower)) type = 'SOCIAL_SKILL';
          else if (/(brand|wechat_channels|official_account)/.test(lower)) type = 'BRAND';
          else if (/(^|_)(label|tag)$/.test(lower)) type = 'LABEL';
          else if (/(action_button|chosen_button|button|cta|anchor)/.test(lower)) type = 'ACTION_BUTTON';
          if (type) result.push({ id: `${type}-${this.simpleHash(`${nextPath}:${text}`)}`, type, name: text, previewUrl: /^https?:\/\//i.test(text) ? text : null, metrics: null, attributionNote: '平台创意接口未返回该配置项的独立效果归因。' });
        } else visit(raw, nextPath);
      }
    };
    visit(value);
    return this.deduplicateMaterials(result);
  }

  private async platformGet(url: string, token: string, params: Record<string, unknown>, provider: PromotionSyncProvider) {
    try {
      const response = await axios.get(url, {
        params: { ...params, ...(provider === 'TENCENT_ADS' ? { access_token: token, timestamp: Math.floor(Date.now() / 1000), nonce: randomBytes(12).toString('hex') } : {}) },
        headers: provider === 'OCEANENGINE' ? { 'Access-Token': token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
        timeout: 30_000,
      });
      const payload = response.data;
      if (payload?.code && Number(payload.code) !== 0) {
        if (provider === 'TENCENT_ADS' && Number(payload.code) === 11002) throw new TencentMarketingApiError('11002', payload.message_cn || payload.message || '腾讯业务单元 Access Token 已失效');
        throw new Error(payload.message_cn || payload.message || payload.msg || `平台返回错误 ${payload.code}`);
      }
      return payload;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as any;
        if (provider === 'TENCENT_ADS' && Number(data?.code) === 11002) throw new TencentMarketingApiError('11002', data?.message_cn || data?.message || '腾讯业务单元 Access Token 已失效');
        throw new Error(data?.message_cn || data?.message || data?.msg || `平台接口请求失败（HTTP ${error.response?.status || 0}）`);
      }
      throw error;
    }
  }

  private responseRows(payload: any): any[] {
    const candidates = [payload?.data?.list, payload?.data?.data, payload?.data?.items, payload?.data?.projects, payload?.data?.materials, payload?.list];
    const rows = candidates.find(Array.isArray);
    return Array.isArray(rows) ? rows.filter((item) => item && typeof item === 'object') : [];
  }

  private flattenMetricRow(row: any) {
    if (!Array.isArray(row.metrics)) return { ...row, ...(row.metrics && typeof row.metrics === 'object' ? row.metrics : {}), ...(row.dimensions && typeof row.dimensions === 'object' ? row.dimensions : {}) };
    const metrics = Object.fromEntries(row.metrics.map((item: any) => [item.field || item.name || item.key, item.value ?? item.metric_value ?? 0]));
    return { ...row, ...metrics, ...(row.dimensions && typeof row.dimensions === 'object' ? row.dimensions : {}) };
  }

  private firstString(row: Record<string, unknown>, keys: string[]) {
    for (const key of keys) if (typeof row[key] === 'string' && row[key]) return String(row[key]);
    return null;
  }

  private deduplicateMaterials(items: PromotionMaterialInput[]) {
    const seen = new Set<string>();
    return items.filter((item) => { const key = `${item.type}:${item.id}:${item.name}`; if (seen.has(key)) return false; seen.add(key); return true; });
  }

  private simpleHash(value: string) {
    let hash = 0;
    for (let index = 0; index < value.length; index++) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    return Math.abs(hash).toString(36);
  }

  private materialTypeLabel(type: PromotionMaterialType) {
    return ({ VIDEO: '视频', IMAGE: '图片', COPY: '文案', LANDING_PAGE: '落地页', BRAND: '品牌形象', ACTION_BUTTON: '行动按钮', MINI_CARD_LINK: '图文链接', TEXT_LINK: '文字链', FLOATING_ZONE: '浮层卡片', LABEL: '标签', SOCIAL_SKILL: '首评回复' } as const)[type];
  }

  private isAllZeroTencentMetrics(provider: PromotionSyncProvider, data: { spend: number; impressions: number; clicks: number; leads: number; validLeads?: number }) {
    if (provider !== 'TENCENT_ADS') return false;
    return [data.spend, data.impressions, data.clicks, data.leads, data.validLeads].every((value) => Number(value ?? 0) === 0);
  }
}
