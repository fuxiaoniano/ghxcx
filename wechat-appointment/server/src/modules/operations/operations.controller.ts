import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import dayjs from 'dayjs';
import { AdminCurrentUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ArchivePromotionDailyMetricDto, DateRangeQueryDto, PromotionAccountDto, PromotionDailyMetricDto, PromotionDailyReportNoteDto, PromotionDataSyncConfigDto, PromotionMetricFieldDto, SyncPromotionDailyMetricsDto } from './dto';
import { OperationsService } from './operations.service';

@ApiTags('管理后台 - 信息流运营报表')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Permissions('MANAGE_CONFIGS')
@Controller('/api/admin/operations')
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('/accounts') accounts() { return this.operations.accounts(); }
  @Post('/accounts') createAccount(@Body() dto: PromotionAccountDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.createAccount(dto, user, req.ip, req.headers['user-agent']); }
  @Patch('/accounts/:id') updateAccount(@Param('id') id: string, @Body() dto: PromotionAccountDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.updateAccount(id, dto, user, req.ip, req.headers['user-agent']); }
  @Delete('/accounts/:id') deleteAccount(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.deleteAccount(id, user, req.ip, req.headers['user-agent']); }

  @Get('/fields') fields() { return this.operations.fields(); }
  @Post('/fields') createField(@Body() dto: PromotionMetricFieldDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.createField(dto, user, req.ip, req.headers['user-agent']); }
  @Patch('/fields/:id') updateField(@Param('id') id: string, @Body() dto: PromotionMetricFieldDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.updateField(id, dto, user, req.ip, req.headers['user-agent']); }
  @Delete('/fields/:id') deleteField(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.deleteField(id, user, req.ip, req.headers['user-agent']); }

  @Get('/daily-report') dailyReport(@Query('date') date?: string) { return this.operations.dailyReport(date || dayjs().subtract(1, 'day').format('YYYY-MM-DD')); }
  @Get('/weekly-report') weeklyReport(@Query('date') date?: string, @Query('dateTo') dateTo?: string) { return this.operations.weeklyReport(date || dayjs().format('YYYY-MM-DD'), dateTo); }
  @Get('/monthly-report') monthlyReport(@Query('date') date?: string) { return this.operations.monthlyReport(date || dayjs().format('YYYY-MM-DD')); }
  @Patch('/daily-report/note') updateDailyReportNote(@Body() dto: PromotionDailyReportNoteDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.updateDailyReportNote(dto, user, req.ip, req.headers['user-agent']); }

  @Get('/daily') daily(@Query() query: DateRangeQueryDto) { return this.operations.daily(query); }
  @Post('/daily') createDaily(@Body() dto: PromotionDailyMetricDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.createDaily(dto, user, req.ip, req.headers['user-agent']); }
  @Patch('/daily/:id') updateDaily(@Param('id') id: string, @Body() dto: PromotionDailyMetricDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.updateDaily(id, dto, user, req.ip, req.headers['user-agent']); }
  @Delete('/daily/:id') deleteDaily(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.deleteDaily(id, user, req.ip, req.headers['user-agent']); }
  @Patch('/daily/:id/archive') archiveDaily(@Param('id') id: string, @Body() dto: ArchivePromotionDailyMetricDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.archiveDaily(id, dto, user, req.ip, req.headers['user-agent']); }

  @Get('/sync-configs') syncConfigs() { return this.operations.syncConfigs(); }
  @Put('/sync-configs') updateSyncConfig(@Body() dto: PromotionDataSyncConfigDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.updateSyncConfig(dto, user, req.ip, req.headers['user-agent']); }
  @Post('/daily/sync') syncDaily(@Body() dto: SyncPromotionDailyMetricsDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.operations.syncDaily(dto, user, req.ip, req.headers['user-agent']); }

  @Get('/weekly') weekly(@Query() query: DateRangeQueryDto) { return this.operations.summary(query, 'week'); }
  @Get('/monthly') monthly(@Query() query: DateRangeQueryDto) { return this.operations.summary(query, 'month'); }
}
