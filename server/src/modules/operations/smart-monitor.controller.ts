import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Type } from 'class-transformer';
import { Equals, IsBoolean, IsIn, IsInt, IsNumber, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { AdminCurrentUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { SmartMonitorService } from './smart-monitor.service';
import { SmartMonitorActionsService } from './smart-monitor-actions.service';

export class SmartMonitorPolicyDto {
  @IsBoolean() enabled!: boolean;
  @Type(() => Number) @IsNumber() @Min(1.05) @Max(5) ratioThreshold!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(1000000) minSpend!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) minConversions!: number;
  @Type(() => Number) @IsInt() @Min(30) @Max(1440) maxReportAgeMinutes!: number;
}

export class SmartMonitorChannelPolicyDto {
  @IsBoolean() enabled!: boolean;
  @Type(() => Number) @IsNumber() @Min(0) @Max(1000000) spendThreshold!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(1000000) emptySpendThreshold!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(1000000) cpaThreshold!: number;
  @Type(() => Number) @IsInt() @Min(30) @Max(1440) maxReportAgeMinutes!: number;
}

export class SmartMonitorCreativeStatusDto {
  @IsIn(['AD_STATUS_NORMAL', 'AD_STATUS_SUSPEND']) configuredStatus!: 'AD_STATUS_NORMAL' | 'AD_STATUS_SUSPEND';
  @IsString() @Matches(/^[A-Za-z0-9_-]{16,100}$/) idempotencyKey!: string;
  @IsString() @MaxLength(200) reason!: string;
  @IsBoolean() @Equals(true) confirmed!: true;
}

export class SmartMonitorScheduleDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/) scheduledAt!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{16,100}$/) idempotencyKey!: string;
  @IsString() @MaxLength(200) reason!: string;
  @IsBoolean() @Equals(true) confirmed!: true;
}

export class SmartMonitorDeleteDto {
  @IsString() @Matches(/^\d{1,16}$/) confirmationCreativeId!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{16,100}$/) idempotencyKey!: string;
  @IsString() @MaxLength(200) reason!: string;
  @IsBoolean() @Equals(true) confirmed!: true;
}

@ApiTags('管理后台 - 智能监控')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('/api/admin/operations/smart-monitor')
export class SmartMonitorController {
  constructor(private readonly monitor: SmartMonitorService, private readonly actions: SmartMonitorActionsService) {}

  @Get('/accounts') @Permissions('PROMOTION_SMART_MONITOR_VIEW')
  accounts(@CurrentUser() user: AdminCurrentUser) { return this.monitor.accounts(user); }

  @Get('/accounts/:id') @Permissions('PROMOTION_SMART_MONITOR_VIEW')
  dashboard(@Param('id') id: string, @Query('refresh') refresh: string | undefined, @CurrentUser() user: AdminCurrentUser) {
    return this.monitor.dashboard(id, user, refresh !== 'false');
  }

  @Put('/accounts/:id/policy') @Permissions('PROMOTION_SMART_MONITOR_AUTO')
  savePolicy(@Param('id') id: string, @Body() dto: SmartMonitorPolicyDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) {
    return this.monitor.savePolicy(id, dto, user, req.ip, req.headers['user-agent']);
  }

  @Put('/channels/:channelKey/policy') @Permissions('PROMOTION_SMART_MONITOR_AUTO')
  saveChannelPolicy(@Param('channelKey') channelKey: string, @Body() dto: SmartMonitorChannelPolicyDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) {
    return this.monitor.saveChannelPolicy(channelKey, dto, user, req.ip, req.headers['user-agent']);
  }

  @Post('/accounts/:id/creatives/:creativeId/status') @Permissions('PROMOTION_SMART_MONITOR_STATUS')
  changeCreativeStatus(@Param('id') id: string, @Param('creativeId') creativeId: string, @Body() dto: SmartMonitorCreativeStatusDto, @CurrentUser() user: AdminCurrentUser) {
    return this.actions.changeStatus(id, creativeId, dto.configuredStatus, dto.idempotencyKey, dto.reason, user);
  }

  @Post('/accounts/:id/creatives/:creativeId/schedule-resume') @Permissions('PROMOTION_SMART_MONITOR_STATUS')
  scheduleResume(@Param('id') id: string, @Param('creativeId') creativeId: string, @Body() dto: SmartMonitorScheduleDto, @CurrentUser() user: AdminCurrentUser) {
    return this.actions.scheduleResume(id, creativeId, new Date(dto.scheduledAt), dto.idempotencyKey, dto.reason, user);
  }

  @Post('/accounts/:id/actions/:actionId/reconcile') @Permissions('PROMOTION_SMART_MONITOR_STATUS')
  reconcile(@Param('id') id: string, @Param('actionId') actionId: string, @CurrentUser() user: AdminCurrentUser) {
    return this.actions.reconcile(id, actionId, user);
  }

  @Get('/accounts/:id/actions') @Permissions('PROMOTION_SMART_MONITOR_VIEW')
  actionsList(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser) { return this.actions.listActions(id, user); }

  @Post('/accounts/:id/creatives/:creativeId/delete') @Permissions('PROMOTION_SMART_MONITOR_DELETE')
  deleteCreative(@Param('id') id: string, @Param('creativeId') creativeId: string, @Body() dto: SmartMonitorDeleteDto, @CurrentUser() user: AdminCurrentUser) {
    return this.actions.deleteCreative(id, creativeId, dto.confirmationCreativeId, dto.idempotencyKey, dto.reason, user);
  }

  @Post('/accounts/:id/actions/:actionId/reconcile-deletion') @Permissions('PROMOTION_SMART_MONITOR_DELETE')
  reconcileDeletion(@Param('id') id: string, @Param('actionId') actionId: string, @CurrentUser() user: AdminCurrentUser) {
    return this.actions.reconcileDeletion(id, actionId, user);
  }

  @Post('/accounts/:id/actions/:actionId/cancel-schedule') @Permissions('PROMOTION_SMART_MONITOR_STATUS')
  cancelSchedule(@Param('id') id: string, @Param('actionId') actionId: string, @CurrentUser() user: AdminCurrentUser) {
    return this.actions.cancelSchedule(id, actionId, user);
  }
}
