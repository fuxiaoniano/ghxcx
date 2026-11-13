import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { mkdirSync, renameSync } from 'fs';
import { extname, join } from 'path';
import { AdminCurrentUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnyPermissions, Permissions } from '../../common/decorators/permissions.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { normalizeUploadFilename } from '../../common/utils/upload-filename';
import { validateStoredImageUpload } from '../../common/utils/validate-image-upload';
import { CreateWebsiteArticleCategoryDto, CreateWebsiteArticleDto, UpdateWebsiteArticleCategoryDto, UpdateWebsiteArticleDto, UpdateWebsiteSettingsDto, WebsiteArticleQueryDto } from './dto';
import { WebsiteService } from './website.service';

const websiteCoverDir = process.env.ENTERPRISE_ASSET_DIR || join(process.cwd(), 'uploads', 'enterprise-assets');
const websiteCoverExts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
mkdirSync(websiteCoverDir, { recursive: true });

@ApiTags('管理后台-企业官网')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('/api/admin/website')
export class WebsiteAdminController {
  constructor(private readonly website: WebsiteService) {}
  @Get('/analytics') @Permissions('SYSTEM_WEBSITE_ANALYTICS') analytics() { return this.website.analytics(); }
  @Get('/settings') @Permissions('WEBSITE_SETTINGS') settings() { return this.website.settings(); }
  @Patch('/settings') @Permissions('WEBSITE_SETTINGS') updateSettings(@Body() dto: UpdateWebsiteSettingsDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.updateSettings(dto.settings, this.audit(user, req)); }
  @Get('/categories') @AnyPermissions('WEBSITE_CATEGORIES', 'WEBSITE_ARTICLES') categories() { return this.website.categories(true); }
  @Post('/categories') @AnyPermissions('WEBSITE_CATEGORIES', 'WEBSITE_ARTICLES') createCategory(@Body() dto: CreateWebsiteArticleCategoryDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.createCategory(dto, this.audit(user, req)); }
  @Patch('/categories/:id') @Permissions('WEBSITE_CATEGORIES') updateCategory(@Param('id') id: string, @Body() dto: UpdateWebsiteArticleCategoryDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.updateCategory(id, dto, this.audit(user, req)); }
  @Delete('/categories/:id') @Permissions('WEBSITE_CATEGORIES') deleteCategory(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.deleteCategory(id, this.audit(user, req)); }
  @Get('/articles') @Permissions('WEBSITE_ARTICLES') articles(@Query() query: WebsiteArticleQueryDto) { return this.website.articles(query, true); }
  @Get('/articles/:id') @Permissions('WEBSITE_ARTICLES') article(@Param('id') id: string) { return this.website.adminArticle(id); }
  @Get('/official-draft-sync') @Permissions('WEBSITE_ARTICLES') officialDraftSync() { return this.website.officialDraftSyncSettings(); }
  @Patch('/official-draft-sync') @Permissions('WEBSITE_ARTICLES') updateOfficialDraftSync(@Body() body: { enabled?: boolean; headerHtml?: string; footerHtml?: string }, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.updateOfficialDraftSync(body, this.audit(user, req)); }
  @Post('/article-cover')
  @Permissions('WEBSITE_ARTICLES')
  @UseInterceptors(FileInterceptor('file', {
    dest: websiteCoverDir,
    limits: { fileSize: 500 * 1024, files: 1 },
    fileFilter: (_request, file, callback) => {
      const extension = extname(file.originalname || '').toLowerCase();
      const valid = Boolean(file.mimetype?.startsWith('image/') && websiteCoverExts.has(extension));
      callback(valid ? null : new BadRequestException('封面图仅支持 jpg、png 或 webp 格式'), valid);
    }
  }))
  uploadArticleCover(@UploadedFile() file: any, @Req() request: Request) {
    if (!file) throw new BadRequestException('请上传不超过 500KB 的封面图');
    validateStoredImageUpload(file);
    const originalName = normalizeUploadFilename(file.originalname || '');
    const extension = extname(originalName).toLowerCase();
    const filename = `${file.filename}${extension}`;
    renameSync(file.path, join(websiteCoverDir, filename));
    const publicBase = process.env.SERVER_BASE_URL || `${request.protocol}://${request.get('host')}`;
    return {
      url: `${publicBase.replace(/\/$/, '')}/uploads/enterprise-assets/${filename}`,
      size: file.size,
      mimeType: file.mimetype
    };
  }
  @Post('/articles') @Permissions('WEBSITE_ARTICLES') createArticle(@Body() dto: CreateWebsiteArticleDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.createArticle(dto, this.audit(user, req)); }
  @Patch('/articles/:id') @Permissions('WEBSITE_ARTICLES') updateArticle(@Param('id') id: string, @Body() dto: UpdateWebsiteArticleDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.updateArticle(id, dto, this.audit(user, req)); }
  @Post('/articles/:id/official-draft') @Permissions('WEBSITE_ARTICLES') syncOfficialDraft(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.syncArticleToOfficialDraft(id, this.audit(user, req)); }
  @Delete('/articles/:id') @Permissions('WEBSITE_ARTICLES') deleteArticle(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.website.deleteArticle(id, this.audit(user, req)); }
  private audit(user: AdminCurrentUser, req: Request) {
    return { adminUserId: user.adminUserId, ip: req.ip, userAgent: String(req.headers['user-agent'] || '') };
  }
}
