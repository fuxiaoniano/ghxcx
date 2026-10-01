import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminCurrentUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { UpdateTencentAdLeadDto } from './dto';
import { TencentAdsLeadsService } from './tencent-ads-leads.service';

@ApiTags('管理后台 - 腾讯广告线索')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('/api/admin/tencent-ads/leads')
export class TencentAdsLeadsAdminController {
  constructor(private readonly leads: TencentAdsLeadsService) {}

  @Get('/receiver-config')
  @Permissions('BUSINESS_LEADS')
  receiverConfig() {
    return this.leads.receiverConfig();
  }

  @Get()
  @Permissions('BUSINESS_LEADS')
  list(@Query() query: Record<string, string>, @CurrentUser() user: AdminCurrentUser) {
    return this.leads.list(query, user);
  }

  @Get('/:id')
  @Permissions('BUSINESS_LEADS')
  detail(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser) {
    return this.leads.detail(id, user);
  }

  @Post('/:id/reveal-phone')
  @Permissions('BUSINESS_LEADS')
  revealPhone(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.leads.revealPhone(id, user, request.ip, request.headers['user-agent']);
  }

  @Patch('/:id')
  @Permissions('BUSINESS_LEADS')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTencentAdLeadDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.leads.update(id, dto, user, request.ip, request.headers['user-agent']);
  }
}
