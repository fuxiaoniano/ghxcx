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
  OfficialAccountMenuDto,
  OfficialAutoReplyDto,
  UpdateAdminUserDto,
  UpdateAppointmentNotifyConfigDto,
  UpdateAppointmentRemarkDto,
  UpdateAppointmentStatusDto,
  UpdateClinicDto,
  UpdateConfigsDto,
  UpdateFollowupForwardConfigDto
} from './dto';
import { AdminService } from './admin.service';

const landingAssetDir = process.env.LANDING_ASSET_DIR || join(process.cwd(), 'uploads', 'landing-assets');
mkdirSync(landingAssetDir, { recursive: true });
const allowedImageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

@ApiTags('ç®¡ç†åå°')
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
        callback(isImage ? null : new BadRequestException('è¯·ä¸Šä¼  jpgã€pngã€webp æˆ– gif å›¾ç‰‡'), isImage);
      }
    })
  )
  uploadLandingAsset(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('è¯·å…ˆé€‰æ‹©å›¾ç‰‡');
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

  @Patch('/official-accm|ã^m¢G§²ÚîÆ­yÜÙ\ÜÚ[Û’Y	ÉÊJHÂˆ™]\›ˆ[ÂˆBˆÛÛœİ˜]ÈH]ØZ]\Ëœ™Y\Ë™Ù]
\ËÙXÚ]ÙÚ[’Ù^JÙ\ÜÚ[Û’Y
JNÂˆYˆ
\˜]ÊHÂˆ™]\›ˆ[ÂˆBˆHÂˆ™]\›ˆ”ÓÓ‹œ\œÙJ˜]ÊH\ÈÈİ]\Îˆ	ÔS‘S‘ÉÈ	ĞÓÓ‘’T“QQ	È	ÑT”“Ô‰ÎÈYZ[•\Ù\’YÎˆİš[™ÎÈY\ÜØYÙOÎˆİš[™ÈNÂˆHØ]ÚÂˆ™]\›ˆ[ÂˆBˆB‚ˆš]˜]H›Ü›X[^™T\›Z\ÜÚ[ÛœÊ\›Z\ÜÚ[ÛœÎˆİš[™Ö×JHÂˆ™]\›ˆ\œ˜^K™œ›ÛJ™]ÈÙ]
\›Z\ÜÚ[ÛœÈ×JJNÂˆB‚ˆš]˜]HØ]™P\Ú[Y[›İYPÛÛ™šYÊÛÛ™šYÎˆ\Ú[Y[›İYPÛÛ™šYÊHÂˆ™]\›ˆ\Ëœš\ÛXKœŞ\İ[PÛÛ™šYË\Ù\
ÂˆÚ\™NˆÈÙ^Nˆ	Ø\Ú[Y[›İYIÈKˆÜ™X]NˆÂˆÙ^Nˆ	Ø\Ú[Y[›İYIËˆ˜[YRœÛÛˆÛÛ™šYÈ\È[šÛ›İÛˆ\Èš\ÛXK’[œ]œÛÛ•˜[YKˆ\ØÜš\[Ûˆ	ù¥¬:h¡9î©¹ak9/%ùcíú`&¹çéy£©y¥-¹.®ºacyïk‰ÂˆKˆ\]NˆÂˆ˜[YRœÛÛˆÛÛ™šYÈ\È[šÛ›İÛˆ\Èš\ÛXK’[œ]œÛÛ•˜[YKˆ\ØÜš\[Ûˆ	ù¥¬:h¡9î©¹ak9/%ùcíú`&¹çéy£©y¥-¹.®ºacyïk‰ÂˆBˆJNÂˆB‚ˆš]˜]HX›XÑ›Ûİİ\›ÜØ\™ÛÛ™šYÊÛÛ™šYÎˆ›Ûİİ\›ÜØ\™ÛÛ™šYÊHÂˆ™]\›ˆÂˆ‹‹˜ÛÛ™šYËˆ]]ÚÙ[ˆ	ÉËˆ\Ğ]]ÚÙ[ˆ›ÛÛX[ŠÛÛ™šYË˜]]ÚÙ[ŠKˆ]]ÚÙ[“X\ÚÙYˆ\Ë›X\ÚÔÙXÜ™]
ÛÛ™šYË˜]]ÚÙ[ŠBˆNÂˆB‚ˆš]˜]HX\ÚÔÙXÜ™]
˜[YOÎˆİš[™ÊHÂˆYˆ
]˜[YJHÂˆ™]\›ˆ	ÉÎÂˆBˆYˆ
˜[YK›[™İH
HÂˆ™]\›ˆ	ÊŠŠŠŠŠŠŠ‰ÎÂˆBˆ™]\›ˆ	İ˜[YKœÛXÙJ
_JŠŠŠ‰İ˜[YKœÛXÙJM
_XÂˆB‚ˆš]˜]H\ÜÙ\Ø[“X[˜YÙPYZ[•\™Ù]
\Ù\ˆYZ[İ\œ™[\Ù\‹\™Ù]›ÛNˆYZ[”›ÛJHÂˆYˆ
\Ù\‹œ›ÛHOOHYZ[”›ÛK”ÕTT—ĞQRSŠHÂˆ™]\›ÂˆBˆYˆ
\™Ù]›ÛHOOHYZ[”›ÛK”ÕTT—ĞQRSŠHÂˆ›İÈ™]È\Ú[™\ÜÑ^Ù\[ÛŠÍL‹	ùcê¹§"HÕTT—ĞQRSˆ9cëù.éyb&ùnî¹¢%¹/ë¹¥.z-¡yî©ùë¨yä!¹df	ËÊNÂˆBˆYˆ
]\Ù\‹œ\›Z\ÜÚ[ÛœËš[˜ÛY\Ê	ÓPSQÑWĞQRS”ÉÊJHÂˆ›İÈ™]È\Ú[™\ÜÑ^Ù\[ÛŠÍLË	ùodùbcz-)¹cíù¥è9kd:-)¹cíùë¨yä!¹§`úfd	ËÊNÂˆBˆB‚ˆš]˜]Hİ]\Õ^
İ]\Îˆ\Ú[Y[İ]\ÊHÂˆÛÛœİX\ˆ™XÛÜ™\Ú[Y[İ]\Ëİš[™ÏˆHÂˆS‘S‘×ĞÓÓ•PÕˆ	ùo¡z e9ìîÉËˆÓÓ•PÕQˆ	ùmìº e9ìîÉËˆÓÓ‘’T“QQˆ	ùmì¹èkº+©	Ëˆ’TÒUQˆ	ùmì¹b,:+â‰ËˆĞSÑSQˆ	ùmì¹cå¹­¢	ËˆS•SQˆ	ù¥è9¥b9î¯ùí(‰ÂˆNÂˆ™]\›ˆX\Üİ]\×NÂˆB‚ˆš]˜]H›Ûİİ\›ÜØ\™İ]\Õ^
İ]\Îˆ›Ûİİ\›ÜØ\™İ]\ÊHÂˆÛÛœİX\ˆ™XÛÜ™›Ûİİ\›ÜØ\™İ]\Ëİš[™ÏˆHÂˆS‘S‘Îˆ	ùo¡z/k9cäIËˆÕPĞÑTÔÎˆ	ùmìº/k9cäIËˆRSQˆ	ú/k9cäyi,z-)IËˆÒÒTQˆ	ù§*¹d+ùå*	ÂˆNÂˆ™]\›ˆX\Üİ]\×Hİ]\ÎÂˆB‚ˆš]˜]HØ[•šY]Ñ[Û™J\Ù\ˆYZ[İ\œ™[\Ù\ŠHÂˆ™]\›ˆ\Ù\‹œ›ÛHOOHYZ[”›ÛK”ÕTT—ĞQRSˆ\Ù\‹œ\›Z\ÜÚ[ÛœËš[˜ÛY\Ê	Õ’QU×Ñ•SÔÓ‘IÊNÂˆB‚ˆš]˜]H\œÙT\›Z\ÜÚ[ÛœÊ˜[YNˆš\ÛXK’œÛÛ•˜[YJNˆİš[™Ö×HÂˆ™]\›ˆ\œ˜^Kš\Ğ\œ˜^J˜[YJHÈ˜[YK™š[\Š
][JNˆ][H\Èİš[™ÈOˆ\[Ùˆ][HOOH	Üİš[™ÉÊHˆ×NÂˆB‚ˆš]˜]H\Ş[˜ÈX\šÓÙÚ[‘˜Z[Y
Ù^Nˆİš[™ÊHÂˆÛÛœİÛİ[H]ØZ]\Ëœ™Y\Ëš[˜ÜŠÙ^JNÂˆYˆ
Ûİ[OOHJHÂˆ]ØZ]\Ëœ™Y\Ë™^\™JÙ^KL
NÂˆBˆB‚ˆš]˜]HYÙJ˜[YOÎˆİš[™ÊHÂˆ™]\›ˆX]›X^
K[X™\Š˜[YHJJNÂˆB‚ˆš]˜]HYÙTÚ^™J˜[YOÎˆİš[™ÊHÂˆ™]\›ˆX]›Z[ŠLX]›X^
K[X™\Š˜[YHŒ
JJNÂˆB‚ˆš]˜]HXJ\Ù\YÙ[Îˆİš[™Èİš[™Ö×JHÂˆ™]\›ˆ\œ˜^Kš\Ğ\œ˜^J\Ù\YÙ[
HÈ\Ù\YÙ[š›Ú[Š	ÎÉÊHˆ\Ù\YÙ[ÂˆB‚ˆš]˜]HÜİÙ[
˜[YNˆ[šÛ›İÛŠHÂˆÛÛœİ^Hİš[™Ê˜[YHÏÈ	ÉÊNÂˆ™]\›ˆ‰İ^œ™\XÙJÈ‹ÙË	Èˆ‰Ê_H˜ÂˆBŸB