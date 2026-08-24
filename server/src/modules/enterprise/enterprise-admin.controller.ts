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

  @Get('/home-config') @Permissions('HOME_MANAGE') homeConfig() { return this.enterprise.enterpriseHomeConfig(); }
  @Patch('/home-config') @Permissions('HOME_MANAGE') updateHomeConfig(@Body() dto: EnterpriseHomeConfigDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updateEnterpriseHomeConfig(dto, this.audit(user, req)); }

  @Get('/banners') @Permissions('HOME_MANAGE') banners() { return this.enterprise.adminBanners(); }
  @Post('/banners') @Permissions('HOME_MANAGE') createBanner(@Body() dto: BannerDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.createBanner(dto, this.audit(user, req)); }
  @Patch('/banners/:id') @Permissions('HOME_MANAGE') updateBanner(@Param('id') id: string, @Body() dto: BannerDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updateBanner(id, dto, this.audit(user, req)); }
  @Delete('/banners/:id') @Permissions('HOME_MANAGE') deleteBanner(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.deleteBanner(id, this.audit(user, req)); }

  @Get('/ads') @Permissions('HOME_MANAGE') ads() { return this.enterprise.adminAds(); }
  @Post('/ads') @Permissions('HOME_MANAGE') createAd(@Body() dto: AdDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.createAd(dto, this.audit(user, req)); }
  @Patch('/ads/:id') @Permissions('HOME_MANAGE') updateAd(@Param('id') id: string, @Body() dto: AdDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updateAd(id, dto, this.audit(user, req)); }
  @Delete('/ads/:id') @Permissions('HOME_MANAGE') deleteAd(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.deleteAd(id, this.audit(user, req)); }

  @Get('/dental-categories') @Permissions('DOCTOR_MANAGE') categories() { return this.enterprise.adminCategories(); }
  @Post('/dental-categories') @Permissions('DOCTOR_MANAGE') createCategory(@Body() dto: CategoryDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.createCategory(dto, this.audit(user, req)); }
  @Patch('/dental-categories/:id') @Permissions('DOCTOR_MANAGE') updateCategory(@Param('id') id: string, @Body() dto: CategoryDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updateCategory(id, dto, this.audit(user, req)); }
  @Delete('/dental-categories/:id') @Permissions('DOCTOR_MANAGE') deleteCategory(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.deleteCategory(id, this.audit(user, req)); }

  @Get('/dental-projects') @Permissions('DOCTOR_MANAGE') projects() { return this.enterprise.adminProjects(); }
  @Post('/dental-projects') @Permissions('DOCTOR_MANAGE') createProject(@Body() dto: DentalProjectDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.createProject(dto, this.audit(user, req)); }
  @Patch('/dental-projects/:id') @Permissions('DOCTOR_MANAGE') updateProject(@Param('id') id: string, @Body() dto: DentalProjectDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updateProject(id, dto, this.audit(user, req)); }
  @Delete('/dental-projects/:id') @Permissions('DOCTOR_MANAGE') deleteProject(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.deleteProject(id, this.audit(user, req)); }

  // 原挂号管理也复用医生列表做筛选；读取保持登录可用，增删改仍严格校验 DOCTOR_MANAGE。
  @Get('/doctors') doctors() { return this.enterprise.adminDoctors(); }
  @Get('/clinics') @Permissions('DOCTOR_MANAGE') clinics() { return this.enterprise.adminClinics(); }
  @Post('/doctors') @Permissions('DOCTOR_MANAGE') createDoctor(@Body() dto: DoctorDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.createDoctor(dto, this.audit(user, req)); }
  @Patch('/doctors/:id') @Permissions('DOCTOR_MANAGE') updateDoctor(@Param('id') id: string, @Body() dto: DoctorDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updateDoctor(id, dto, this.audit(user, req)); }
  @Delete('/doctors/:id') @Permissions('DOCTOR_MANAGE') deleteDoctor(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.deleteDoctor(id, this.audit(user, req)); }

  @Get('/doctor-schedules') @Permissions('DOCTOR_MANAGE') schedules(@Query('doctorId') doctorId?: string) { return this.enterprise.adminSchedules(doctorId); }
  @Post('/doctor-schedules') @Permissions('DOCTOR_MANAGE') createSchedule(@Body() dto: DoctorScheduleDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.createSchedule(dto, this.audit(user, req)); }
  @Patch('/doctor-schedules/:id') @Permissions('DOCTOR_MANAGE') updateSchedule(@Param('id') id: string, @Body() dto: DoctorScheduleDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updateSchedule(id, dto, this.audit(user, req)); }
  @Delete('/doctor-schedules/:id') @Permissions('DOCTOR_MANAGE') deleteSchedule(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.deleteSchedule(id, this.audit(user, req)); }

  @Get('/package-categories') @Permissions('PACKAGE_MANAGE') packageCategories() { return this.enterprise.adminPackageCategories(); }
  @Post('/package-categories') @Permissions('PACKAGE_MANAGE') createPackageCategory(@Body() dto: CategoryDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.createPackageCategory(dto, this.audit(user, req)); }
  @Patch('/package-categories/:id') @Permissions('PACKAGE_MANAGE') updatePackageCategory(@Param('id') id: string, @Body() dto: CategoryDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updatePackageCategory(id, dto, this.audit(user, req)); }
  @Delete('/package-categories/:id') @Permissions('PACKAGE_MANAGE') deletePackageCategory(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.deletePackageCategory(id, this.audit(user, req)); }

  @Get('/packages') @Permissions('PACKAGE_MANAGE') packages() { return this.enterprise.adminPackages(); }
  @Post('/packages') @Permissions('PACKAGE_MANAGE') createPackage(@Body() dto: PackageDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.createPackage(dto, this.audit(user, req)); }
  @Patch('/packages/:id') @Permissions('PACKAGE_MANAGE') updatePackage(@Param('id') id: string, @Body() dto: PackageDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.updatePackage(id, dto, this.audit(user, req)); }
  @Delete('/packages/:id') @Permissions('PACKAGE_MANAGE') deletePackage(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.deletePackage(id, this.audit(user, req)); }
  @Patch('/packages/:id/images') @Permissions('PACKAGE_MANAGE') replaceImages(@Param('id') id: string, @Body() dto: PackageImagesDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.enterprise.replacePackageImages(id, dto.images, this.audit(user, req)); }

  @Get('/assets')
  @AnyPermissions('HOME_MANAGE', 'DOCTOR_MANAGE', 'PACKAGE_MANAGE')
  assets() { return this.enterprise.mediaAssets(); }

  @Delete('/assets/:id')
  @AnyPermissions('HOME_MANAGE', 'DOCTOR_MANAGE', 'PACKAGE_MANAGE')
  deleteAsset(@Param('id') id: string) { return this.enterprise.deleteMediaAsset(id); }

  @Post('/assets')
  @AnyPermissions('HOME_MANAGE', 'DOCTOR_MANAGE', 'PACKAGE_MANAGE')
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
    // Multer 默认文件名没有后缀；保留已校验的扩展名，确保微信 image 组件获得正确 MIME 类型。
    const extension = extname(file.originalname || '').toLowerCase();
    const filename = `${file.filename}${extension}`;
    renameSync(file.path, join(assetDir, filename));
    const publicBase = process.env.SERVER_BASE_URL || `${request.protocol}://${request.get('host')}`;
    return this.enterprise.createMediaAsset({
      name: file.originalname,
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
