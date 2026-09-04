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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { CurrentUser, AdminCurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import {
  AssignAppointmentDto,
  CreateAdminWechatInviteDto,
  CreateClinicDto,
  CreateLandingPageDto,
  OfficialAccountMenuDto,
  OfficialAutoReplyDto,
  UpdateAdminUserDto,
  UpdateAppointmentNotifyConfigDto,
  UpdateAppointmentRemarkDto,
  UpdateAppointmentStatusDto,
  UpdateClinicDto,
  UpdateConfigsDto,
  UpdateFollowupForwardConfigDto,
  UpdateLandingPageDto
} from './dto';
import { AdminService } from './admin.service';

const landingAssetDir = process.env.LANDING_ASSET_DIR || join(process.cwd(), 'uploads', 'landing-assets');
mkdirSync(landingAssetDir, { recursive: true });
const allowedImageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

@ApiTags('管理后台')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('/api/admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('/dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('/users')
  users(@Query() query: Record<string, string>) {
    return this.admin.users(query);
  }

  @Get('/users/:id')
  userDetail(@Param('id') id: string) {
    return this.admin.userDetail(id);
  }

  @Post('/users/:id/reveal-phone')
  revealUserPhone(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.revealUserPhone(id, user, request.ip, request.headers['user-agent']);
  }

  @Get('/appointments')
  appointments(@Query() query: Record<string, string>) {
    return this.admin.appointments(query);
  }

  @Get('/appointments/:id')
  appointmentDetail(@Param('id') id: string) {
    return this.admin.appointmentDetail(id);
  }

  @Post('/appointments/:id/reveal-phone')
  revealPhone(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.revealAppointmentPhone(id, user, request.ip, request.headers['user-agent']);
  }

  @Patch('/appointments/:id/status')
  @Permissions('MANAGE_APPOINTMENTS')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateAppointmentStatus(id, dto.status, user, request.ip, request.headers['user-agent']);
  }

  @Patch('/appointments/:id/remark')
  @Permissions('MANAGE_APPOINTMENTS')
  updateRemark(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentRemarkDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateAppointmentRemark(id, dto.adminRemark, user, request.ip, request.headers['user-agent']);
  }

  @Patch('/appointments/:id/assign')
  @Permissions('MANAGE_APPOINTMENTS')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignAppointmentDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.assignAppointment(id, dto.adminUserId, user, request.ip, request.headers['user-agent']);
  }

  @Post('/appointments/:id/resend-notification')
  @Permissions('MANAGE_APPOINTMENTS')
  resend(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.resendNotification(id, user, request.ip, request.headers['user-agent']);
  }

  @Post('/appointments/:id/resend-followup-forward')
  @Permissions('MANAGE_APPOINTMENTS')
  resendFollowupForward(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.resendFollowupForward(id, user, request.ip, request.headers['user-agent']);
  }

  @Get('/notification-logs')
  notificationLogs(@Query() query: Record<string, string>) {
    return this.admin.notificationLogs(query);
  }

  @Post('/notification-logs/:id/retry')
  @Permissions('MANAGE_APPOINTMENTS')
  retryNotification(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.retryNotification(id, user, request.ip, request.headers['user-agent']);
  }

  @Get('/audit-logs')
  auditLogs(@Query() query: Record<string, string>) {
    return this.admin.auditLogs(query);
  }

  @Get('/configs')
  configs() {
    return this.admin.configs();
  }

  @Get('/landing-pages')
  landingPages() {
    return this.admin.landingPages();
  }

  @Post('/landing-pages')
  @Permissions('MANAGE_CONFIGS')
  createLandingPage(
    @Body() dto: CreateLandingPageDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.createLandingPage(dto, user, request.ip, request.headers['user-agent']);
  }

  @Get('/landing-pages/:id')
  landingPage(@Param('id') id: string) {
    return this.admin.landingPage(id);
  }

  @Patch('/landing-pages/:id')
  @Permissions('MANAGE_CONFIGS')
  updateLandingPage(
    @Param('id') id: string,
    @Body() dto: UpdateLandingPageDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateLandingPage(id, dto, user, request.ip, request.headers['user-agent']);
  }

  @Post('/landing-pages/:id/set-default')
  @Permissions('MANAGE_CONFIGS')
  setDefaultLandingPage(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.setDefaultLandingPage(id, user, request.ip, request.headers['user-agent']);
  }

  @Patch('/configs')
  @Permissions('MANAGE_CONFIGS')
  updateConfigs(
    @Body() dto: UpdateConfigsDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateConfigs(dto.configs, user, request.ip, request.headers['user-agent']);
  }

  @Get('/followup-forward')
  @Permissions('MANAGE_CONFIGS')
  followupForwardConfig() {
    return this.admin.followupForwardConfig();
  }

  @Patch('/followup-forward')
  @Permissions('MANAGE_CONFIGS')
  updateFollowupForwardConfig(
    @Body() dto: UpdateFollowupForwardConfigDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateFollowupForwardConfig(dto, user, request.ip, request.headers['user-agent']);
  }

  @Post('/landing-assets')
  @Permissions('MANAGE_CONFIGS')
  @UseInterceptors(
    FileInterceptor('file', {
      dest: landingAssetDir,
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
      fileFilter: (_request, file, callback) => {
        const ext = extname(file.originalname || '').toLowerCase();
        const isImage = Boolean(file.mimetype?.startsWith('image/') && allowedImageExts.has(ext));
        callback(isImage ? null : new BadRequestException('请上传 jpg、png、webp 或 gif 图片'), isImage);
      }
    })
  )
  uploadLandingAsset(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('请先选择图片');
    }
    return this.admin.landingAssetUrl(file);
  }

  @Get('/official-account/menu')
  officialAccountMenu() {
    return this.admin.officialAccountMenu();
  }

  @Patch('/official-account/menu')
  @Permissions('MANAGE_CONFIGS')
  updateOfficialAccountMenu(
    @Body() dto: OfficialAccountMenuDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateOfficialAccountMenu(dto.menu as any, user, request.ip, request.headers['user-agent']);
  }

  @Post('/official-account/menu/publish')
  @Permissions('MANAGE_CONFIGS')
  publishOfficialAccountMenu(
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.publishOfficialAccountMenu(user, request.ip, request.headers['user-agent']);
  }

  @Get('/official-account/auto-reply')
  officialAutoReply() {
    return this.admin.officialAutoReply();
  }

  @Patch('/official-account/auto-reply')
  @Permissions('MANAGE_CONFIGS')
  updateOfficialAutoReply(
    @Body() dto: OfficialAutoReplyDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateOfficialAutoReply(dto.autoReply as any, user, request.ip, request.headers['user-agent']);
  }

  @Get('/admin-users')
  @Permissions('MANAGE_ADMINS')
  adminUsers(@Query() query: Record<string, string>) {
    return this.admin.adminUsers(query);
  }

  @Get('/admin-users/invitations')
  @Permissions('MANAGE_ADMINS')
  adminWechatInvitations() {
    return this.admin.adminWechatInvitations();
  }

  @Post('/admin-users/invitations')
  @Permissions('MANAGE_ADMINS')
  createAdminWechatInvitation(
    @Body() dto: CreateAdminWechatInviteDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.createAdminWechatInvitation(dto, user, request.ip, request.headers['user-agent']);
  }

  @Delete('/admin-users/invitations/:id')
  @Permissions('MANAGE_ADMINS')
  cancelAdminWechatInvitation(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.cancelAdminWechatInvitation(id, user, request.ip, request.headers['user-agent']);
  }

  @Post('/admin-users/:id/wechat-invitation')
  @Permissions('MANAGE_ADMINS')
  createExistingAdminWechatInvitation(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.createExistingAdminWechatInvitation(id, user, request.ip, request.headers['user-agent']);
  }

  @Patch('/admin-users/:id')
  @Permissions('MANAGE_ADMINS')
  updateAdminUser(
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateAdminUser(id, dto, user, request.ip, request.headers['user-agent']);
  }

  @Get('/clinics')
  @Permissions('MANAGE_CONFIGS')
  clinics() {
    return this.admin.clinics();
  }

  @Post('/clinics')
  @Permissions('MANAGE_CONFIGS')
  createClinic(
    @Body() dto: CreateClinicDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.createClinic(dto, user, request.ip, request.headers['user-agent']);
  }

  @Patch('/clinics/:id')
  @Permissions('MANAGE_CONFIGS')
  updateClinic(
    @Param('id') id: string,
    @Body() dto: UpdateClinicDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateClinic(id, dto, user, request.ip, request.headers['user-agent']);
  }

  @Get('/appointment-notify')
  @Permissions('MANAGE_CONFIGS')
  appointmentNotifyConfig() {
    return this.admin.appointmentNotifyConfig();
  }

  @Patch('/appointment-notify')
  @Permissions('MANAGE_CONFIGS')
  updateAppointmentNotifyConfig(
    @Body() dto: UpdateAppointmentNotifyConfigDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateAppointmentNotifyConfig(dto, user, request.ip, request.headers['user-agent']);
  }

  @Get('/export/appointments.csv')
  async exportAppointments(
    @Query() query: Record<string, string>,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request,
    @Res() response: Response
  ) {
    const csv = await this.admin.exportAppointments(query, user, request.ip, request.headers['user-agent']);
    response.header('Content-Type', 'text/csv; charset=utf-8');
    response.header('Content-Disposition', 'attachment; filename="appointments.csv"');
    response.send(`\uFEFF${csv}`);
  }
}
