import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminCurrentUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnyPermissions, Permissions } from '../../common/decorators/permissions.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateWebsiteArticleCategoryDto, CreateWebsiteArticleDto, UpdateWebsiteArticleCategoryDto, UpdateWebsiteArticleDto, UpdateWebsiteSettingsDto, WebsiteArticleQueryDto } from './dto';
import { WebsiteService } from './website.service';

@ApiTags('管理后台-AfterBeat')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('/api/admin/afterbeat')
export class AfterbeatAdminController {
  constructor(private readonly website: WebsiteService) {}
  @Get('/settings') @Permissions('AFTERBEAT_SETTINGS') settings() { return this.website.settings('afterbeat'); }
  @Patch('/settings') @Permissions('AFTERBEAT_SETTINGS') updateSettings(@Body() dto: UpdateWebsiteSettingsDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.updateSettings(dto.settings, this.audit(user, req), 'afterbeat'); }
  @Get('/categories') @AnyPermissions('AFTERBEAT_CATEGORIES', 'AFTERBEAT_ARTICLES') categories() { return this.website.categories(true, 'afterbeat'); }
  @Post('/categories') @AnyPermissions('AFTERBEAT_CATEGORIES', 'AFTERBEAT_ARTICLES') createCategory(@Body() dto: CreateWebsiteArticleCategoryDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.createCategory(dto, this.audit(user, req), 'afterbeat'); }
  @Patch('/categories/:id') @Permissions('AFTERBEAT_CATEGORIES') updateCategory(@Param('id') id: string, @Body() dto: UpdateWebsiteArticleCategoryDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.updateCategory(id, dto, this.audit(user, req), 'afterbeat'); }
  @Delete('/categories/:id') @Permissions('AFTERBEAT_CATEGORIES') deleteCategory(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.deleteCategory(id, this.audit(user, req), 'afterbeat'); }
  @Get('/articles') @Permissions('AFTERBEAT_ARTICLES') articles(@Query() query: WebsiteArticleQueryDto) { return this.website.articles(query, true, 'afterbeat'); }
  @Get('/articles/:id') @Permissions('AFTERBEAT_ARTICLES') article(@Param('id') id: string) { return this.website.adminArticle(id, 'afterbeat'); }
  @Post('/articles') @Permissions('AFTERBEAT_ARTICLES') createArticle(@Body() dto: CreateWebsiteArticleDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.createArticle(dto, this.audit(user, req), 'afterbeat'); }
  @Patch('/articles/:id') @Permissions('AFTERBEAT_ARTICLES') updateArticle(@Param('id') id: string, @Body() dto: UpdateWebsiteArticleDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.updateArticle(id, dto, this.audit(user, req), 'afterbeat'); }
  @Delete('/articles/:id') @Permissions('AFTERBEAT_ARTICLES') deleteArticle(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.deleteArticle(id, this.audit(user, req), 'afterbeat'); }
  @Get('/official-draft-sync') @Permissions('AFTERBEAT_ARTICLES') officialDraftSync() { return this.website.officialDraftSyncSettings('afterbeat'); }
  @Patch('/official-draft-sync') @Permissions('AFTERBEAT_ARTICLES') updateOfficialDraftSync(@Body() body: { enabled?: boolean; headerHtml?: string; footerHtml?: string }, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.updateOfficialDraftSync(body, this.audit(user, req), 'afterbeat'); }
  @Post('/articles/:id/official-draft') @Permissions('AFTERBEAT_ARTICLES') syncOfficialDraft(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.syncArticleToOfficialDraft(id, this.audit(user, req), 'afterbeat'); }
  private audit(user: AdminCurrentUser, req: Request) { return { adminUserId: user.adminUserId, ip: req.ip, userAgent: String(req.headers['user-agent'] || '') }; }
}
