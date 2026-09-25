import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminCurrentUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateWebsiteArticleDto, CreateWebsitePageDto, UpdateWebsiteArticleDto, UpdateWebsitePageDto, UpdateWebsiteSettingsDto, WebsiteArticleQueryDto } from './dto';
import { WebsiteService } from './website.service';

@ApiTags('管理后台-企业官网')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Permissions('WEBSITE_MANAGE')
@Controller('/api/admin/website')
export class WebsiteAdminController {
  constructor(private readonly website: WebsiteService) {}
  @Get('/settings') settings() { return this.website.settings(); }
  @Patch('/settings') updateSettings(@Body() dto: UpdateWebsiteSettingsDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.updateSettings(dto.settings, this.audit(user, req)); }
  @Get('/pages') pages() { return this.website.adminPages(); }
  @Post('/pages') createPage(@Body() dto: CreateWebsitePageDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.createPage(dto, this.audit(user, req)); }
  @Patch('/pages/:id') updatePage(@Param('id') id: string, @Body() dto: UpdateWebsitePageDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.updatePage(id, dto, this.audit(user, req)); }
  @Delete('/pages/:id') deletePage(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.deletePage(id, this.audit(user, req)); }
  @Get('/articles') articles(@Query() query: WebsiteArticleQueryDto) { return this.website.articles(query, true); }
  @Get('/articles/:id') article(@Param('id') id: string) { return this.website.adminArticle(id); }
  @Post('/articles') createArticle(@Body() dto: CreateWebsiteArticleDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.createArticle(dto, this.audit(user, req)); }
  @Patch('/articles/:id') updateArticle(@Param('id') id: string, @Body() dto: UpdateWebsiteArticleDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.updateArticle(id, dto, this.audit(user, req)); }
  @Delete('/articles/:id') deleteArticle(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.deleteArticle(id, this.audit(user, req)); }
  private audit(user: AdminCurrentUser, req: Request) {
    return { adminUserId: user.adminUserId, ip: req.ip, userAgent: String(req.headers['user-agent'] || '') };
  }
}
