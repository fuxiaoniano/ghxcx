import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
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
import {
  AdDto,
  BannerDto,
  CategoryDto,
  DentalProjectDto,
  DoctorDto,
  DoctorScheduleDto,
  EnterpriseHomeConfigDto,
  PackageDto,
  PackageImagesDto
} from './dto';
import { EnterpriseService } from './enterprise.service';

const assetDir = process.env.ENTERPRISE_ASSET_DIR || join(process.cwd(), 'uploads', 'enterprise-assets');
mkdirSync(assetDir, { recursive: true });
const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/** 新内容管理仍位于原后台 JWT 和权限体系内。 */
@ApiTags('管理后台-企业官网')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('/api/admin/enterprise')
export class EnterpriseAdminController {
  constructor(private readonly enterprise: EnterpriseService) {}

  @Get('/home-config') @Permissions('CONTENT_HOME') homeConfig() { return this.enterprise.enterpriseHomeConfig(); }
  @Patch('/home-config') @Permissions('CONTENT_HOME') updateHomeConfig(@Body() dto: EnterpriseHomeConfigDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updateEnterpriseHomeConfig(dto, this.audit(user, req)); }

  @Get('/banners') @Permissions('CONTENT_HOME') banners() { return this.enterprise.adminBanners(); }
  @Post('/banners') @Permissions('CONTENT_HOME') createBanner(@Body() dto: BannerDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.createBanner(dto, this.audit(user, req)); }
  @Patch('/banners/:id') @Permissions('CONTENT_HOME') updateBanner(@Param('id') id: string, @Body() dto: BannerDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updateBanner(id, dto, this.audit(user, req)); }
  @Delete('/banners/:id') @Permissions('CONTENT_HOME') deleteBanner(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.deleteBanner(id, this.audit(user, req)); }

  @Get('/ads') @Permissions('CONTENT_HOME') ads() { return this.enterprise.adminAds(); }
  @Post('/ads') @Permissions('CONTENT_HOME') createAd(@Body() dto: AdDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.createAd(dto, this.audit(user, req)); }
  @Patch('/ads/:id') @Permissions('CONTENT_HOME') updateAd(@Param('id') id: string, @Body() dto: AdDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updateAd(id, dto, this.audit(user, req)); }
  @Delete('/ads/:id') @Permissions('CONTENT_HOME') deleteAd(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.deleteAd(id, this.audit(user, req)); }

  @Get('/dental-categories') @Permissions('CONTENT_DEPARTMENTS') categories() { return this.enterprise.adminCategories(); }
  @Post('/dental-categories') @Permissions('CONTENT_DEPARTMENTS') createCategory(@Body() dto: CategoryDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.createCategory(dto, this.audit(user, req)); }
  @Patch('/dental-categories/:id') @Permissions('CONTENT_DEPARTMENTS') updateCategory(@Param('id') id: string, @Body() dto: CategoryDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updateCategory(id, dto, this.audit(user, req)); }
  @Delete('/dental-categories/:id') @Permissions('CONTENT_DEPARTMENTS') deleteCategory(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.deleteCategory(id, this.audit(user, req)); }

  @Get('/dental-projects') @Permissions('CONTENT_DEPARTMENTS') projects() { return this.enterprise.adminProjects(); }
  @Post('/dental-projects') @Permissions('CONTENT_DEPARTMENTS') createProject(@Body() dto: DentalProjectDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.createProject(dto, this.audit(user, req)); }
  @Patch('/dental-projects/:id') @Permissions('CONTENT_DEPARTMENTS') updateProject(@Param('id') id: string, @Body() dto: DentalProjectDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updateProject(id, dto, this.audit(user, req)); }
  @Delete('/dental-projects/:id') @Permissions('CONTENT_DEPARTMENTS') deleteProject(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.deleteProject(id, this.audit(user, req)); }

  // 挂号管理复用医生与诊所列表做筛选，读取允许业务挂号或医生管理权限，写操作仍严格使用医生权限。
  @Get('/doctors') @AnyPermissions('BUSINESS_APPOINTMENTS', 'CONTENT_DOCTORS') doctors() { return this.enterprise.adminDoctors(); }
  @Get('/clinics') @AnyPermissions('BUSINESS_APPOINTMENTS', 'CONTENT_DOCTORS') clinics() { return this.enterprise.adminClinics(); }
  @Post('/doctors') @Permissions('CONTENT_DOCTORS') createDoctor(@Body() dto: DoctorDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.createDoctor(dto, this.audit(user, req)); }
  @Patch('/doctors/:id') @Permissions('CONTENT_DOCTORS') updateDoctor(@Param('id') id: string, @Body() dto: DoctorDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updateDoctor(id, dto, this.audit(user, req)); }
  @Delete('/doctors/:id') @Permissions('CONTENT_DOCTORS') deleteDoctor(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.deleteDoctor(id, this.audit(user, req)); }

  @Get('/doctor-schedules') @Permissions('CONTENT_DOCTORS') schedules(@Query('doctorId') doctorId?: string) { return this.enterprise.adminSchedules(doctorId); }
  @Post('/doctor-schedules') @Permissions('CONTENT_DOCTORS') createSchedule(@Body() dto: DoctorScheduleDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.createSchedule(dto, this.audit(user, req)); }
  @Patch('/doctor-schedules/:id') @Permissions('CONTENT_DOCTORS') updateSchedule(@Param('id') id: string, @Body() dto: DoctorScheduleDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updateSchedule(id, dto, this.audit(user, req)); }
  @Delete('/doctor-schedules/:id') @Permissions('CONTENT_DOCTORS') deleteSchedule(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.deleteSchedule(id, this.audit(user, req)); }

  @Get('/package-categories') @Permissions('CONTENT_PACKAGES') packageCategories() { return this.enterprise.adminPackageCategories(); }
  @Post('/package-categories') @Permissions('CONTENT_PACKAGES') createPackageCategory(@Body() dto: CategoryDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.createPackageCategory(dto, this.audit(user, req)); }
  @Patch('/package-categories/:id') @Permissions('CONTENT_PACKAGES') updatePackageCategory(@Param('id') id: string, @Body() dto: CategoryDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updatePackageCategory(id, dto, this.audit(user, req)); }
  @Delete('/package-categories/:id') @Permissions('CONTENT_PACKAGES') deletePackageCategory(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.deletePackageCategory(id, this.audit(user, req)); }

  @Get('/packages') @Permissions('CONTENT_PACKAGES') packages() { return this.enterprise.adminPackages(); }
  @Post('/packages') @Permissions('CONTENT_PACKAGES') createPackage(@Body() dto: PackageDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.createPackage(dto, this.audit(user, req)); }
  @Patch('/packages/:id') @Permissions('CONTENT_PACKAGES') updatePackage(@Param('id') id: string, @Body() dto: PackageDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updatePackage(id, dto, this.audit(user, req)); }
  @Delete('/packages/:id') @Permissions('CONTENT_PACKAGES') deletePackage(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.deletePackage(id, this.audit(user, req)); }
  @Patch('/packages/:id/images') @Permissions('CONTENT_PACKAGES') replaceImages(@Param('id') id: string, @Body() dto: PackageImagesDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.replacePackageImages(id, dto.images, this.audit(user, req)); }

  @Get('/assets')
  @AnyPermissions('CONTENT_HOME', 'CONTENT_DEPARTMENTS', 'CONTENT_DOCTORS', 'CONTENT_PACKAGES', 'CONTENT_MEDIA')
  assets() { return this.enterprise.mediaAssets(); }

  @Delete('/assets/:id')
  @Permissions('CONTENT_MEDIA')
  deleteAsset(@Param('id') id: string) { return this.enterprise.deleteMediaAsset(id); }

  @Post('/assets')
  @Permissions('CONTENT_MEDIA')
  @UseInterceptors(FileInterceptor('file', {
    dest: assetDir,
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    fileFilter: (_request, file, callback) => {
      const extension = extname(file.originalname || '').toLowerCase();
      const valid = Boolean(file.mimetype?.startsWith('image/') && imageExts.has(extension));
      callback(valid ? null : new BadRequestException('请上传 jpg、png、webp 或 gif 图片'), valid);
    }
  }))
  async upload(@UploadedFile() file: any, @Req() request: Request, @CurrentUser() user: AdminCurrentUser) {
    if (!file) throw new BadRequestException('请先选择图片');
    validateStoredImageUpload(file);
    const originalName = normalizeUploadFilename(file.originalname || '');
    // Multer 默认文件名没有后缀；保留已校验的扩展名，确保微信 image 组件获得正确 MIME 类型。
    const extension = extname(originalName).toLowerCase();
    const filename = `${file.filename}${extension}`;
    renameSync(file.path, join(assetDir, filename));
    const publicBase = process.env.SERVER_BASE_URL || `${request.protocol}://${request.get('host')}`;
    return this.enterprise.createMediaAsset({
      name: originalName,
      url: `${publicBase.replace(/\/$/, '')}/uploads/enterprise-assets/${filename}`,
      mimeType: file.mimetype,
      size: file.size,
      uploaderAdminId: user.adminUserId
    });
  }

  private audit(user: AdminCurrentUser, request: Request) {
    return { user, ip: request.ip, userAgent: request.headers['user-agent'] };
  }
}
