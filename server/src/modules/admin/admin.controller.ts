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
import { AnyPermissions, Permissions } from '../../common/decorators/permissions.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { validateStoredImageUpload } from '../../common/utils/validate-image-upload';
import {
  AssignAppointmentDto,
  ChangeOwnPasswordDto,
  CreateAdminRoleDefinitionDto,
  CreateAdminUserDto,
  CreateAdminTeamDto,
  CreateAdminWechatInviteDto,
  CreateClinicDto,
  CreateLandingPageDto,
  OfficialAccountMenuDto,
  OfficialAutoReplyDto,
  UpdateOfficialAccountBindingDto,
  UpdateAdminLoginPreferenceDto,
  UpdateAdminUserDto,
  UpdateAdminTeamDto,
  DeleteAdminUserDto,
  UpdateAdminRoleDefinitionDto,
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

  @Post('/account/change-password')
  changeOwnPassword(@Body() dto: ChangeOwnPasswordDto, @CurrentUser() user: AdminCurrentUser, @Req() request: Request) {
    return this.admin.changeOwnPassword(dto, user, request.ip, request.headers['user-agent']);
  }

  @Get('/dashboard')
  dashboard(@CurrentUser() user: AdminCurrentUser) {
    return this.admin.dashboard(user);
  }

  @Get('/users')
  @Permissions('BUSINESS_USERS')
  users(@Query() query: Record<string, string>, @CurrentUser() user: AdminCurrentUser) {
    return this.admin.users(query, user);
  }

  @Get('/users/:id')
  @Permissions('BUSINESS_USERS')
  userDetail(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser) {
    return this.admin.userDetail(id, user);
  }

  @Post('/users/:id/reveal-phone')
  @Permissions('BUSINESS_USERS')
  revealUserPhone(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.revealUserPhone(id, user, request.ip, request.headers['user-agent']);
  }

  @Get('/appointments')
  @Permissions('BUSINESS_APPOINTMENTS')
  appointments(@Query() query: Record<string, string>, @CurrentUser() user: AdminCurrentUser) {
    return this.admin.appointments(query, user);
  }

  @Get('/appointments/:id')
  @Permissions('BUSINESS_APPOINTMENTS')
  appointmentDetail(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser) {
    return this.admin.appointmentDetail(id, user);
  }

  @Post('/appointments/:id/reveal-phone')
  @Permissions('BUSINESS_APPOINTMENTS')
  revealPhone(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.revealAppointmentPhone(id, user, request.ip, request.headers['user-agent']);
  }

  @Patch('/appointments/:id/status')
  @Permissions('BUSINESS_APPOINTMENTS')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateAppointmentStatus(id, dto.status, user, request.ip, request.headers['user-agent']);
  }

  @Patch('/appointments/:id/remark')
  @Permissions('BUSINESS_APPOINTMENTS')
  updateRemark(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentRemarkDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateAppointmentRemark(id, dto.adminRemark, user, request.ip, request.headers['user-agent']);
  }

  @Patch('/appointments/:id/assign')
  @Permissions('BUSINESS_APPOINTMENTS')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignAppointmentDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.assignAppointment(id, dto.adminUserId, user, request.ip, request.headers['user-agent']);
  }

  @Post('/appointments/:id/resend-notification')
  @Permissions('BUSINESS_APPOINTMENTS')
  resend(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.resendNotification(id, user, request.ip, request.headers['user-agent']);
  }

  @Post('/appointments/:id/resend-followup-forward')
  @Permissions('BUSINESS_APPOINTMENTS')
  resendFollowupForward(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.resendFollowupForward(id, user, request.ip, request.headers['user-agent']);
  }

  @Get('/notification-logs')
  @Permissions('BUSINESS_NOTIFICATIONS')
  notificationLogs(@Query() query: Record<string, string>, @CurrentUser() user: AdminCurrentUser) {
    return this.admin.notificationLogs(query, user);
  }

  @Post('/notification-logs/:id/retry')
  @Permissions('BUSINESS_NOTIFICATIONS')
  retryNotification(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.retryNotification(id, user, request.ip, request.headers['user-agent']);
  }

  @Get('/audit-logs')
  @Permissions('SYSTEM_AUDIT')
  auditLogs(@Query() query: Record<string, string>) {
    return this.admin.auditLogs(query);
  }

  @Get('/configs')
  @Permissions('SYSTEM_CONFIGS')
  configs() {
    return this.admin.configs();
  }

  @Get('/landing-pages')
  @Permissions('SYSTEM_CONFIGS')
  landingPages() {
    return this.admin.landingPages();
  }

  @Post('/landing-pages')
  @Permissions('SYSTEM_CONFIGS')
  createLandingPage(
    @Body() dto: CreateLandingPageDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.createLandingPage(dto, user, request.ip, request.headers['user-agent']);
  }

  @Get('/landing-pages/:id')
  @Permissions('SYSTEM_CONFIGS')
  landingPage(@Param('id') id: string) {
    return this.admin.landingPage(id);
  }

  @Patch('/landing-pages/:id')
  @Permissions('SYSTEM_CONFIGS')
  updateLandingPage(
    @Param('id') id: string,
    @Body() dto: UpdateLandingPageDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateLandingPage(id, dto, user, request.ip, request.headers['user-agent']);
  }

  @Post('/landing-pages/:id/set-default')
  @Permissions('SYSTEM_CONFIGS')
  setDefaultLandingPage(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.setDefaultLandingPage(id, user, request.ip, request.headers['user-agent']);
  }

  @Delete('/landing-pages/:id')
  @Permissions('SYSTEM_CONFIGS')
  deleteLandingPage(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.deleteLandingPage(id, user, request.ip, request.headers['user-agent']);
  }

  @Patch('/configs')
  @Permissions('SYSTEM_CONFIGS')
  updateConfigs(
    @Body() dto: UpdateConfigsDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateConfigs(dto.configs, user, request.ip, request.headers['user-agent']);
  }

  @Get('/followup-forward')
  @Permissions('SYSTEM_FOLLOWUP')
  followupForwardConfig() {
    return this.admin.followupForwardConfig();
  }

  @Patch('/followup-forward')
  @Permissions('SYSTEM_FOLLOWUP')
  updateFollowupForwardConfig(
    @Body() dto: UpdateFollowupForwardConfigDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateFollowupForwardConfig(dto, user, request.ip, request.headers['user-agent']);
  }

  @Post('/landing-assets')
  @Permissions('SYSTEM_CONFIGS')
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
    validateStoredImageUpload(file);
    return this.admin.landingAssetUrl(file);
  }

  @Get('/official-account/menu')
  @Permissions('WECHAT_MENU')
  officialAccountMenu() {
    return this.admin.officialAccountMenu();
  }

  @Patch('/official-account/menu')
  @Permissions('WECHAT_MENU')
  updateOfficialAccountMenu(
    @Body() dto: OfficialAccountMenuDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateOfficialAccountMenu(dto.menu as any, user, request.ip, request.headers['user-agent']);
  }

  @Post('/official-account/menu/publish')
  @Permissions('WECHAT_MENU')
  publishOfficialAccountMenu(
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.publishOfficialAccountMenu(user, request.ip, request.headers['user-agent']);
  }

  @Get('/official-account/auto-reply')
  @Permissions('WECHAT_AUTO_REPLY')
  officialAutoReply() {
    return this.admin.officialAutoReply();
  }

  @Patch('/official-account/auto-reply')
  @Permissions('WECHAT_AUTO_REPLY')
  updateOfficialAutoReply(
    @Body() dto: OfficialAutoReplyDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateOfficialAutoReply(dto.autoReply as any, user, request.ip, request.headers['user-agent']);
  }

  @Get('/official-account/binding')
  @Permissions('SYSTEM_OFFICIAL_BINDING')
  officialAccountBinding() { return this.admin.officialAccountBinding(); }

  @Patch('/official-account/login-preference')
  @Permissions('SYSTEM_OFFICIAL_BINDING')
  updateAdminLoginPreference(@Body() dto: UpdateAdminLoginPreferenceDto, @CurrentUser() user: AdminCurrentUser, @Req() request: Request) {
    return this.admin.updateAdminLoginPreference(dto.defaultWechatLogin, user, request.ip, request.headers['user-agent']);
  }

  @Patch('/official-account/binding')
  @Permissions('SYSTEM_OFFICIAL_BINDING')
  updateOfficialAccountBinding(@Body() dto: UpdateOfficialAccountBindingDto, @CurrentUser() user: AdminCurrentUser, @Req() request: Request) { return this.admin.updateOfficialAccountBinding(dto, user, request.ip, request.headers['user-agent']); }

  @Get('/admin-roles')
  @Permissions('SYSTEM_ROLES')
  adminRoles() { return this.admin.adminRoles(); }

  @Post('/admin-roles')
  @Permissions('SYSTEM_ROLES')
  createAdminRole(@Body() dto: CreateAdminRoleDefinitionDto, @CurrentUser() user: AdminCurrentUser, @Req() request: Request) {
    return this.admin.createAdminRole(dto, user, request.ip, request.headers['user-agent']);
  }

  @Patch('/admin-roles/:id')
  @Permissions('SYSTEM_ROLES')
  updateAdminRole(@Param('id') id: string, @Body() dto: UpdateAdminRoleDefinitionDto, @CurrentUser() user: AdminCurrentUser, @Req() request: Request) {
    return this.admin.updateAdminRole(id, dto, user, request.ip, request.headers['user-agent']);
  }

  @Delete('/admin-roles/:id')
  @Permissions('SYSTEM_ROLES')
  deleteAdminRole(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() request: Request) {
    return this.admin.deleteAdminRole(id, user, request.ip, request.headers['user-agent']);
  }

  @Get('/admin-users')
  @Permissions('SYSTEM_MEMBERS')
  adminUsers(@Query() query: Record<string, string>) {
    return this.admin.adminUsers(query);
  }

  @Get('/admin-teams')
  @Permissions('SYSTEM_MEMBERS')
  adminTeams() { return this.admin.adminTeams(); }

  @Post('/admin-teams')
  @Permissions('SYSTEM_MEMBERS')
  createAdminTeam(@Body() dto: CreateAdminTeamDto, @CurrentUser() user: AdminCurrentUser, @Req() request: Request) {
    return this.admin.createAdminTeam(dto, user, request.ip, request.headers['user-agent']);
  }

  @Patch('/admin-teams/:id')
  @Permissions('SYSTEM_MEMBERS')
  updateAdminTeam(@Param('id') id: string, @Body() dto: UpdateAdminTeamDto, @CurrentUser() user: AdminCurrentUser, @Req() request: Request) {
    return this.admin.updateAdminTeam(id, dto, user, request.ip, request.headers['user-agent']);
  }

  @Delete('/admin-teams/:id')
  @Permissions('SYSTEM_MEMBERS')
  deleteAdminTeam(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() request: Request) {
    return this.admin.deleteAdminTeam(id, user, request.ip, request.headers['user-agent']);
  }

  @Post('/admin-users')
  @Permissions('SYSTEM_MEMBERS')
  createAdminUser(
    @Body() dto: CreateAdminUserDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.createAdminUser(dto, user, request.ip, request.headers['user-agent']);
  }

  @Get('/admin-users/invitations')
  @Permissions('SYSTEM_MEMBERS')
  adminWechatInvitations() {
    return this.admin.adminWechatInvitations();
  }

  @Post('/admin-users/invitations')
  @Permissions('SYSTEM_MEMBERS')
  createAdminWechatInvitation(
    @Body() dto: CreateAdminWechatInviteDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.createAdminWechatInvitation(dto, user, request.ip, request.headers['user-agent']);
  }

  @Delete('/admin-users/invitations/:id')
  @Permissions('SYSTEM_MEMBERS')
  cancelAdminWechatInvitation(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.cancelAdminWechatInvitation(id, user, request.ip, request.headers['user-agent']);
  }

  @Post('/admin-users/:id/wechat-invitation')
  @Permissions('SYSTEM_MEMBERS')
  createExistingAdminWechatInvitation(
    @Param('id') id: string,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.createExistingAdminWechatInvitation(id, user, request.ip, request.headers['user-agent']);
  }

  @Patch('/admin-users/:id')
  @Permissions('SYSTEM_MEMBERS')
  updateAdminUser(
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateAdminUser(id, dto, user, request.ip, request.headers['user-agent']);
  }

  @Delete('/admin-users/:id')
  @Permissions('SYSTEM_MEMBERS')
  deleteAdminUser(@Param('id') id: string, @Body() dto: DeleteAdminUserDto, @CurrentUser() user: AdminCurrentUser, @Req() request: Request) { return this.admin.deleteAdminUser(id, dto.successorAdminId, user, request.ip, request.headers['user-agent']); }

  @Get('/admin-users/:id/handover-summary')
  @Permissions('SYSTEM_MEMBERS')
  adminUserHandoverSummary(@Param('id') id: string) { return this.admin.adminUserHandoverSummary(id); }

  @Get('/clinics')
  @AnyPermissions('BUSINESS_APPOINTMENTS', 'CONTENT_DEPARTMENTS')
  clinics() {
    return this.admin.clinics();
  }

  @Post('/clinics')
  @Permissions('CONTENT_DEPARTMENTS')
  createClinic(
    @Body() dto: CreateClinicDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.createClinic(dto, user, request.ip, request.headers['user-agent']);
  }

  @Patch('/clinics/:id')
  @Permissions('CONTENT_DEPARTMENTS')
  updateClinic(
    @Param('id') id: string,
    @Body() dto: UpdateClinicDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateClinic(id, dto, user, request.ip, request.headers['user-agent']);
  }

  @Get('/appointment-notify')
  @Permissions('SYSTEM_APPOINTMENT_NOTIFY')
  appointmentNotifyConfig() {
    return this.admin.appointmentNotifyConfig();
  }

  @Patch('/appointment-notify')
  @Permissions('SYSTEM_APPOINTMENT_NOTIFY')
  updateAppointmentNotifyConfig(
    @Body() dto: UpdateAppointmentNotifyConfigDto,
    @CurrentUser() user: AdminCurrentUser,
    @Req() request: Request
  ) {
    return this.admin.updateAppointmentNotifyConfig(dto, user, request.ip, request.headers['user-agent']);
  }

  @Get('/export/appointments.csv')
  @Permissions('BUSINESS_APPOINTMENTS')
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
