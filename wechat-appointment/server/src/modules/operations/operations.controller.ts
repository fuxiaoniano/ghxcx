import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import dayjs from 'dayjs';
import { AdminCurrentUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnyPermissions, Permissions } from '../../common/decorators/permissions.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ArchivePromotionDailyMetricDto, CreativeDefaultComponentDto, DateRangeQueryDto, MultiAccountCreativeBatchRequestDto, MultiAccountCreativeTaskQueryDto, PromotionAccountCredentialDto, PromotionAccountDto, PromotionAccountGrantsDto, PromotionCreativeAdgroupQueryDto, PromotionCreativeAssetQueryDto, PromotionCreativeBatchRequestDto, PromotionCreativeTaskQueryDto, PromotionCreativeTemplateQueryDto, PromotionDailyMetricDto, PromotionDailyReportNoteDto, PromotionDataSyncConfigDto, TencentBusinessUnitCredentialDto, PromotionHealthAnalyzeDto, PromotionMaterialAnalyzeDto, PromotionMetricFieldDto, PromotionSalaryConfigDto, PromotionSalaryQueryDto, SyncPromotionDailyMetricsDto } from './dto';
import { OperationsService } from './operations.service';
import { PromotionCreativeBatchService } from './promotion-creative-batch.service';
import { MultiAccountCreativeBatchService } from './multi-account-creative-batch.service';
import { TencentUserTokenDto } from './dto';
import { csvCell } from '../../common/utils/csv-cell';

@ApiTags('管理后台 - 信息流运营报表')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('/api/admin/operations')
export class OperationsController {
  constructor(private readonly operations: OperationsService, private readonly creativeBatches: PromotionCreativeBatchService, private readonly multiCreativeBatches: MultiAccountCreativeBatchService) {}

  @Get('/accounts') @Permissions('PROMOTION_ACCOUNTS') accounts(@CurrentUser() user: AdminCurrentUser) { return this.operations.accounts(user); }
  @Post('/accounts') @Permissions('PROMOTION_ACCOUNTS') createAccount(@Body() dto: PromotionAccountDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.createAccount(dto, user, req.ip, req.headers['user-agent']); }
  @Patch('/accounts/:id') @Permissions('PROMOTION_ACCOUNTS') updateAccount(@Param('id') id: string, @Body() dto: PromotionAccountDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.updateAccount(id, dto, user, req.ip, req.headers['user-agent']); }
  @Delete('/accounts/:id') @Permissions('PROMOTION_ACCOUNTS') deleteAccount(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.deleteAccount(id, user, req.ip, req.headers['user-agent']); }
  @Get('/accounts/:id/credentials') @Permissions('PROMOTION_ACCOUNTS') accountCredentials(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser) { return this.operations.promotionAccountCredential(id, user); }
  @Put('/accounts/:id/credentials') @Permissions('PROMOTION_ACCOUNTS') saveAccountCredentials(@Param('id') id: string, @Body() dto: PromotionAccountCredentialDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.savePromotionAccountCredential(id, dto, user, req.ip, req.headers['user-agent']); }
  @Get('/my-tencent-user-token') @AnyPermissions('PROMOTION_ACCOUNTS', 'PROMOTION_CREATIVE_BATCH_CREATE', 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CREATE') myTencentUserToken(@CurrentUser() user: AdminCurrentUser) { return this.operations.myTencentUserToken(user); }
  @Post('/my-tencent-user-token/authorization') @AnyPermissions('PROMOTION_ACCOUNTS', 'PROMOTION_CREATIVE_BATCH_CREATE', 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CREATE') createMyTencentUserTokenAuthorization(@CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.createTencentUserTokenAuthorization(user, req.ip, req.headers['user-agent']); }
  @Put('/my-tencent-user-token') @AnyPermissions('PROMOTION_ACCOUNTS', 'PROMOTION_CREATIVE_BATCH_CREATE', 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CREATE') saveMyTencentUserToken(@Body() dto: TencentUserTokenDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.saveMyTencentUserToken(dto, user, req.ip, req.headers['user-agent']); }
  @Get('/accounts/:id/access-grants') @Permissions('PROMOTION_ACCOUNTS') accountAccessGrants(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser) { return this.operations.promotionAccountGrants(id, user); }
  @Put('/accounts/:id/access-grants') @Permissions('PROMOTION_ACCOUNTS') saveAccountAccessGrants(@Param('id') id: string, @Body() dto: PromotionAccountGrantsDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.savePromotionAccountGrants(id, dto, user, req.ip, req.headers['user-agent']); }

  @Get('/fields') @Permissions('PROMOTION_FIELDS') fields() { return this.operations.fields(); }
  @Post('/fields') @Permissions('PROMOTION_FIELDS') createField(@Body() dto: PromotionMetricFieldDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.createField(dto, user, req.ip, req.headers['user-agent']); }
  @Patch('/fields/:id') @Permissions('PROMOTION_FIELDS') updateField(@Param('id') id: string, @Body() dto: PromotionMetricFieldDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.updateField(id, dto, user, req.ip, req.headers['user-agent']); }
  @Delete('/fields/:id') @Permissions('PROMOTION_FIELDS') deleteField(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.deleteField(id, user, req.ip, req.headers['user-agent']); }

  @Get('/daily-report') @Permissions('PROMOTION_DAILY_REPORT') dailyReport(@CurrentUser() user: AdminCurrentUser, @Query('date') date?: string) { return this.operations.dailyReport(date || dayjs().subtract(1, 'day').format('YYYY-MM-DD'), user); }
  @Get('/weekly-report') @Permissions('PROMOTION_WEEKLY_REPORT') weeklyReport(@CurrentUser() user: AdminCurrentUser, @Query('date') date?: string, @Query('dateTo') dateTo?: string) { return this.operations.weeklyReport(date || dayjs().format('YYYY-MM-DD'), dateTo, user); }
  @Get('/monthly-report') @Permissions('PROMOTION_MONTHLY_REPORT') monthlyReport(@CurrentUser() user: AdminCurrentUser, @Query('date') date?: string) { return this.operations.monthlyReport(date || dayjs().format('YYYY-MM-DD'), user); }
  @Patch('/daily-report/note') @Permissions('PROMOTION_DAILY_REPORT') updateDailyReportNote(@Body() dto: PromotionDailyReportNoteDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.updateDailyReportNote(dto, user, req.ip, req.headers['user-agent']); }

  @Get('/daily') @Permissions('PROMOTION_DAILY') daily(@Query() query: DateRangeQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.operations.daily(query, user); }
  @Get('/dashboard') @Permissions('PROMOTION_HOME') dashboard(@Query() query: DateRangeQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.operations.filterData(query, user); }
  @Get('/filter-data') @Permissions('PROMOTION_FILTER') filterData(@Query() query: DateRangeQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.operations.filterData(query, user); }
  @Get('/salary') @Permissions('PROMOTION_SALARY') salary(@Query() query: PromotionSalaryQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.operations.salary(query.month, user); }
  @Put('/salary/config') @Permissions('PROMOTION_SALARY') updateSalaryConfig(@Body() dto: PromotionSalaryConfigDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.updateSalaryConfig(dto, user, req.ip, req.headers['user-agent']); }
  @Post('/daily') @Permissions('PROMOTION_DAILY') createDaily(@Body() dto: PromotionDailyMetricDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.createDaily(dto, user, req.ip, req.headers['user-agent']); }
  @Patch('/daily/:id') @Permissions('PROMOTION_DAILY') updateDaily(@Param('id') id: string, @Body() dto: PromotionDailyMetricDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.updateDaily(id, dto, user, req.ip, req.headers['user-agent']); }
  @Delete('/daily/:id') @Permissions('PROMOTION_DAILY') deleteDaily(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.deleteDaily(id, user, req.ip, req.headers['user-agent']); }
  @Patch('/daily/:id/archive') @Permissions('PROMOTION_DAILY') archiveDaily(@Param('id') id: string, @Body() dto: ArchivePromotionDailyMetricDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.archiveDaily(id, dto, user, req.ip, req.headers['user-agent']); }

  @Get('/sync-configs') @Permissions('PROMOTION_SYNC') syncConfigs() { return this.operations.syncConfigs(); }
  @Put('/sync-configs') @Permissions('PROMOTION_SYNC') updateSyncConfig(@Body() dto: PromotionDataSyncConfigDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.updateSyncConfig(dto, user, req.ip, req.headers['user-agent']); }
  @Get('/sync-configs/tencent-business-unit') @Permissions('PROMOTION_SYNC') tencentBusinessUnitCredential(@CurrentUser() user: AdminCurrentUser) { return this.operations.tencentBusinessUnitCredential(user); }
  @Put('/sync-configs/tencent-business-unit') @Permissions('PROMOTION_SYNC') updateTencentBusinessUnitCredential(@Body() dto: TencentBusinessUnitCredentialDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.updateTencentBusinessUnitCredential(dto, user, req.ip, req.headers['user-agent']); }
  @Post('/daily/sync') @Permissions('PROMOTION_SYNC') syncDaily(@Body() dto: SyncPromotionDailyMetricsDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.syncDaily(dto, user, req.ip, req.headers['user-agent']); }

  @Get('/health/accounts') @Permissions('PROMOTION_OPERATIONS') healthAccounts(@CurrentUser() user: AdminCurrentUser) { return this.operations.healthAccounts(user); }
  @Post('/health/analyze') @Permissions('PROMOTION_OPERATIONS') analyzeHealth(@Body() dto: PromotionHealthAnalyzeDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.analyzeHealth(dto, user, req.ip, req.headers['user-agent']); }
  @Post('/health/materials') @Permissions('PROMOTION_OPERATIONS') analyzeMaterials(@Body() dto: PromotionMaterialAnalyzeDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.analyzeMaterials(dto, user, req.ip, req.headers['user-agent']); }

  @Get('/creative-batches/options') @Permissions('PROMOTION_CREATIVE_BATCH_VIEW') creativeBatchOptions(@CurrentUser() user: AdminCurrentUser) { return this.creativeBatches.options(user); }
  @Get('/creative-batches/adgroups') @Permissions('PROMOTION_CREATIVE_BATCH_VIEW') creativeAdgroups(@Query() query: PromotionCreativeAdgroupQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.creativeBatches.adgroups(query, user); }
  @Get('/creative-batches/templates') @Permissions('PROMOTION_CREATIVE_TEMPLATE_VIEW') creativeTemplates(@Query() query: PromotionCreativeTemplateQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.creativeBatches.templates(query, user); }
  @Get('/creative-batches/template-detail') @Permissions('PROMOTION_CREATIVE_TEMPLATE_VIEW') creativeTemplateDetail(@Query() query: PromotionCreativeTemplateQueryDto, @Query('templateId') templateId: string, @CurrentUser() user: AdminCurrentUser) { return this.creativeBatches.templateDetail({ ...query, templateId }, user); }
  @Get('/creative-batches/assets') @Permissions('PROMOTION_CREATIVE_ASSET_VIEW') creativeAssets(@Query() query: PromotionCreativeAssetQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.creativeBatches.assets(query, user); }
  @Get('/creative-batches/assets/usage') @Permissions('PROMOTION_CREATIVE_ASSET_VIEW') creativeAssetUsageCounts(@Query('accountId') accountId: string, @Query('assetIds') assetIds: string, @Query('refresh') refresh: string | undefined, @CurrentUser() user: AdminCurrentUser) { return this.creativeBatches.assetCreativeUsageCounts(accountId, assetIds, user, refresh === 'true'); }
  @Get('/creative-batches/assets/:assetId/creatives') @Permissions('PROMOTION_CREATIVE_ASSET_VIEW') creativeAssetUsage(@Param('assetId') assetId: string, @Query('accountId') accountId: string, @CurrentUser() user: AdminCurrentUser) { return this.creativeBatches.assetCreativeUsage(accountId, assetId, user); }
  @Post('/creative-batches/preview') @Permissions('PROMOTION_CREATIVE_BATCH_CREATE') creativeBatchPreview(@Body() dto: PromotionCreativeBatchRequestDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.creativeBatches.preview(dto, user, req.ip, req.headers['user-agent']); }
  @Post('/creative-batches') @Permissions('PROMOTION_CREATIVE_BATCH_CREATE') createCreativeBatch(@Body() dto: PromotionCreativeBatchRequestDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.creativeBatches.createTask(dto, user, req.ip, req.headers['user-agent']); }
  @Get('/creative-batches') @Permissions('PROMOTION_CREATIVE_BATCH_VIEW') creativeBatchTasks(@Query() query: PromotionCreativeTaskQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.creativeBatches.tasks(query, user); }
  @Get('/creative-batches/:id') @Permissions('PROMOTION_CREATIVE_BATCH_VIEW') creativeBatchTask(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser) { return this.creativeBatches.task(id, user); }
  @Post('/creative-batches/:id/retry') @Permissions('PROMOTION_CREATIVE_BATCH_RETRY') retryCreativeBatch(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.creativeBatches.retry(id, user, req.ip, req.headers['user-agent']); }
  @Post('/creative-batches/:id/cancel') @Permissions('PROMOTION_CREATIVE_BATCH_CANCEL') cancelCreativeBatch(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.creativeBatches.cancel(id, user, req.ip, req.headers['user-agent']); }
  @Get('/creative-batches/:id/export') @Permissions('PROMOTION_CREATIVE_RESULT_EXPORT') async exportCreativeBatch(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Res() response: Response) {
    const rows = await this.creativeBatches.exportRows(id, user);
    const csv = ['序号,创意名称,状态,腾讯创意ID,错误码,错误信息,提交时间,回查时间', ...rows.map((row) => [row.sequence, row.creativeName, row.status, row.platformCreativeId, row.errorCode, row.errorMessage, row.submittedAt?.toISOString() || '', row.verifiedAt?.toISOString() || ''].map(csvCell).join(','))].join('\n');
    response.setHeader('Content-Type', 'text/csv; charset=utf-8'); response.setHeader('Content-Disposition', `attachment; filename="creative-batch-${id}.csv"`); response.send(`\uFEFF${csv}`);
  }

  @Get('/multi-account-creative-batches/options') @AnyPermissions('PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW', 'PROMOTION_CREATIVE_DEFAULT_COMPONENT_VIEW') multiCreativeOptions(@CurrentUser() user: AdminCurrentUser) { return this.multiCreativeBatches.options(user); }
  @Get('/multi-account-creative-batches/adgroups') @Permissions('PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW') multiCreativeAdgroups(@Query() query: PromotionCreativeAdgroupQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.multiCreativeBatches.adgroups(query, user); }
  @Get('/multi-account-creative-batches/templates') @Permissions('PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW') multiCreativeTemplates(@Query() query: PromotionCreativeTemplateQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.multiCreativeBatches.templates(query, user); }
  @Get('/multi-account-creative-batches/assets') @Permissions('PROMOTION_CREATIVE_ASSET_VIEW') @AnyPermissions('PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW', 'PROMOTION_CREATIVE_DEFAULT_COMPONENT_MANAGE') multiCreativeAssets(@Query() query: PromotionCreativeAssetQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.multiCreativeBatches.assets(query, user); }
  @Post('/multi-account-creative-batches/preflight') @Permissions('PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CREATE') multiCreativePreflight(@Body() dto: MultiAccountCreativeBatchRequestDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.multiCreativeBatches.preflight(dto, user, req.ip, req.headers['user-agent']); }
  @Post('/multi-account-creative-batches') @Permissions('PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CREATE') createMultiCreativeBatch(@Body() dto: MultiAccountCreativeBatchRequestDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.multiCreativeBatches.create(dto, user, req.ip, req.headers['user-agent']); }
  @Get('/multi-account-creative-batches') @Permissions('PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW') multiCreativeTasks(@Query() query: MultiAccountCreativeTaskQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.multiCreativeBatches.tasks(query, user); }
  @Get('/multi-account-creative-batches/default-components') @AnyPermissions('PROMOTION_CREATIVE_DEFAULT_COMPONENT_VIEW', 'PROMOTION_CREATIVE_DEFAULT_COMPONENT_MANAGE', 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CREATE') creativeDefaultComponents(@Query('accountId') accountId: string, @CurrentUser() user: AdminCurrentUser) { return this.multiCreativeBatches.defaultComponents(accountId, user); }
  @Post('/multi-account-creative-batches/default-components') @Permissions('PROMOTION_CREATIVE_DEFAULT_COMPONENT_MANAGE') saveCreativeDefaultComponent(@Body() dto: CreativeDefaultComponentDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.multiCreativeBatches.saveDefaultComponent(dto, user, req.ip, req.headers['user-agent']); }
  @Delete('/multi-account-creative-batches/default-components/:id') @Permissions('PROMOTION_CREATIVE_DEFAULT_COMPONENT_MANAGE') deleteCreativeDefaultComponent(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.multiCreativeBatches.deleteDefaultComponent(id, user, req.ip, req.headers['user-agent']); }
  @Get('/multi-account-creative-batches/:id') @Permissions('PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW') multiCreativeTask(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser) { return this.multiCreativeBatches.task(id, user); }
  @Post('/multi-account-creative-batches/:id/retry') @Permissions('PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_RETRY') retryMultiCreativeBatch(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.multiCreativeBatches.retry(id, user, req.ip, req.headers['user-agent']); }
  @Post('/multi-account-creative-batches/:id/cancel') @Permissions('PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CANCEL') cancelMultiCreativeBatch(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.multiCreativeBatches.cancel(id, user, req.ip, req.headers['user-agent']); }
  @Get('/multi-account-creative-batches/:id/export') @Permissions('PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_RESULT_EXPORT') async exportMultiCreativeBatch(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request, @Res() response: Response) {
    const rows = await this.multiCreativeBatches.exportRows(id, user, req.ip, req.headers['user-agent']);
    const statusLabel: Record<string, string> = { CONFIRMED: '已确认创建', PLATFORM_ACCEPTED: '腾讯已受理待核验', VERIFYING: '腾讯已受理待核验', FAILED: '创建失败', UNKNOWN_NEEDS_REVIEW: '待人工处理', SKIPPED: '已跳过', CANCELLED: '已取消' };
    const csv = ['任务编号,账户,户号,营销单元,营销单元ID,创意名称,状态,腾讯创意ID,错误码,错误信息,提交时间,核验时间', ...rows.map((row: Record<string, any>) => [row.taskNo, row.account, row.accountNo, row.adgroup, row.adgroupId, row.creativeName, statusLabel[row.status] || row.status, row.platformCreativeId, row.errorCode, row.errorMessage, row.submittedAt?.toISOString() || '', row.verifiedAt?.toISOString() || ''].map(csvCell).join(','))].join('\n');
    response.setHeader('Content-Type', 'text/csv; charset=utf-8'); response.setHeader('Content-Disposition', `attachment; filename="multi-creative-batch-${id}.csv"`); response.send(`\uFEFF${csv}`);
  }

  @Get('/weekly') @Permissions('PROMOTION_WEEKLY') weekly(@Query() query: DateRangeQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.operations.summary(query, 'week', user); }
  @Get('/monthly') @Permissions('PROMOTION_MONTHLY') monthly(@Query() query: DateRangeQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.operations.summary(query, 'month', user); }
}
