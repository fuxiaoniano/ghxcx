import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { Request } from 'express';
import { CurrentUser, AdminCurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { WechatGroupNotificationsService } from './wechat-group-notifications.service';

class CreateGroupRouteDto {
  @IsString() @MaxLength(32) landingPageId!: string;
  @IsString() @MaxLength(32) groupId!: string;
}

@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('/api/admin/wechat-group-notifications')
export class WechatGroupNotificationsController {
  constructor(private readonly service: WechatGroupNotificationsService) {}

  @Get('overview')
  @Permissions('WECHAT_GROUP_NOTIFY_VIEW')
  overview() { return this.service.overview(); }

  @Get('deliveries')
  @Permissions('WECHAT_GROUP_NOTIFY_RECORDS')
  deliveries(@Query() query: Record<string, string>) { return this.service.deliveries(query); }

  @Post('routes')
  @Permissions('WECHAT_GROUP_NOTIFY_ROUTE_MANAGE')
  createRoute(@Body() dto: CreateGroupRouteDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) {
    return this.service.createRoute(dto.landingPageId, dto.groupId, user, req.ip, req.headers['user-agent']);
  }

  @Post('routes/:id/enable')
  @Permissions('WECHAT_GROUP_NOTIFY_ROUTE_MANAGE')
  enableRoute(@Param('id') id: string) { return this.service.enableRoute(id); }
}
