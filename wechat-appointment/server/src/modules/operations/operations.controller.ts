import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import dayjs from 'dayjs';
import { AdminCurrentUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ArchivePromotionDailyMetricDto, DateRangeQueryDto, PromotionAccountDto, PromotionDailyMetricDto, PromotionDailyReportNoteDto, PromotionDataSyncConfigDto, PromotionMetricFieldDto, PromotionSalaryConfigDto, PromotionSalaryQueryDto, SyncPromotionDailyMetricsDto } from './dto';
import { OperationsService } from './operations.service';

@ApiTags('管理后台 - 信息流运营报表')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('/api/admin/operations')
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('/accounts') @Permissions('PROMOTION_ACCOUNTS') accounts(@CurrentUser() user: AdminCurrentUser) { return this.operations.accounts(user); }
  @Post('/accounts') @Permissions('PROMOTION_ACCOUNTS') createAccount(@Body() dto: PromotionAccountDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.createAccount(dto, user, req.ip, req.headers['user-agent']); }
  @Patch('/accounts/:id') @Permissions('PROMOTION_ACCOUNTS') updateAccount(@Param('id') id: string, @Body() dto: PromotionAccountDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.updateAccount(id, dto, user, req.ip, req.headers['user-agent']); }
  @Delete('/accounts/:id') @Permissions('PROMOTION_ACCOUNTS') deleteAccount(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.deleteAccount(id, user, req.ip, req.headers['user-agent']); }

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
  @Post('/daily/sync') @Permissions('PROMOTION_SYNC') syncDaily(@Body() dto: SyncPromotionDailyMetricsDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.syncDaily(dto, user, req.ip, req.headers['user-agent']); }

  @Get('/weekly') @Permissions('PROMOTION_WEEKLY') weekly(@Query() query: DateRangeQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.operations.summary(query, 'week', user); }
  @Get('/monthly') @Permissions('PROMOTION_MONTHLY') monthly(@Query() query: DateRangeQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.operations.summary(query, 'month', user); }
}
