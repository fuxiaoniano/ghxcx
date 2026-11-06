import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AdminCurrentUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ConsultationService } from './consultation.service';
import {
  ConsultationAssignDto,
  ConsultationBulkAssignDto,
  ConsultationBulkTagsDto,
  ConsultationFieldDto,
  ConsultationFollowUpDto,
  ConsultationListPreferenceDto,
  ConsultationListQueryDto,
  ConsultationStatusDto,
  ConsultationTagDto,
  ConsultationValidityRuleDto,
  ConsultationScheduleQueryDto,
  SaveConsultationScheduleDto,
  CommitConsultationImportDto,
  CreateConsultationDto,
  UpdateConsultationDto,
  UpdateConsultationFieldDto,
  UpdateConsultationStatusDto,
  UpdateConsultationTagDto
} from './dto';

@ApiTags('管理后台 - 网咨数据')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('/api/admin/consultations')
export class ConsultationController {
  constructor(private readonly consultations: ConsultationService) {}

  @Get('/metadata') @Permissions('CONSULTATION_VIEW') metadata(@CurrentUser() user: AdminCurrentUser) { return this.consultations.metadata(user); }
  @Get('/callbacks/today') @Permissions('CONSULTATION_VIEW') callbacks(@CurrentUser() user: AdminCurrentUser) { return this.consultations.todayCallbacks(user); }
  @Get('/eligible-members') @Permissions('CONSULTATION_ASSIGN') eligibleMembers() { return this.consultations.eligibleMembers(); }
  @Get('/schedule') @Permissions('CONSULTATION_SCHEDULE_VIEW') schedule(@Query() query: ConsultationScheduleQueryDto) { return this.consultations.schedule(query.month); }
  @Put('/schedule') @Permissions('CONSULTATION_SCHEDULE_VIEW') saveSchedule(@Body() dto: SaveConsultationScheduleDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.saveSchedule(dto, user, req.ip, req.headers['user-agent']); }
  @Get('/') @Permissions('CONSULTATION_VIEW') list(@Query() query: ConsultationListQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.consultations.list(query, user); }
  @Post('/') @Permissions('CONSULTATION_CREATE') create(@Body() dto: CreateConsultationDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.create(dto, user, req.ip, req.headers['user-agent']); }
  @Post('/bulk-assign') @Permissions('CONSULTATION_ASSIGN') bulkAssign(@Body() dto: ConsultationBulkAssignDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.bulkAssign(dto, user, req.ip, req.headers['user-agent']); }
  @Post('/bulk-assign/preview') @Permissions('CONSULTATION_ASSIGN') bulkAssignPreview(@Body() dto: ConsultationBulkAssignDto, @CurrentUser() user: AdminCurrentUser) { return this.consultations.bulkAssignPreview(dto, user); }
  @Post('/bulk-tags/add') @Permissions('CONSULTATION_EDIT') bulkAddTags(@Body() dto: ConsultationBulkTagsDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.bulkTags(dto, 'add', user, req.ip, req.headers['user-agent']); }
  @Post('/bulk-tags/remove') @Permissions('CONSULTATION_EDIT') bulkRemoveTags(@Body() dto: ConsultationBulkTagsDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.bulkTags(dto, 'remove', user, req.ip, req.headers['user-agent']); }
  @Put('/list-preference') @Permissions('CONSULTATION_VIEW') savePreference(@Body() dto: ConsultationListPreferenceDto, @CurrentUser() user: AdminCurrentUser) { return this.consultations.savePreference(dto, user); }
  @Get('/import/template') @Permissions('CONSULTATION_IMPORT') async template(@CurrentUser() user: AdminCurrentUser, @Res() response: Response) { const buffer = await this.consultations.templateBuffer(user); response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('网咨数据导入模板.xlsx')}`); response.send(buffer); }
  @Post('/import/validate') @Permissions('CONSULTATION_IMPORT') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })) validateImport(@UploadedFile() file: any, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.validateImport(file, user, req.ip, req.headers['user-agent']); }
  @Post('/import/:batchId/commit') @Permissions('CONSULTATION_IMPORT') commitImport(@Param('batchId') batchId: string, @Body() dto: CommitConsultationImportDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.commitImport(batchId, dto.duplicateMode, user, req.ip, req.headers['user-agent']); }
  @Get('/import/:batchId/errors') @Permissions('CONSULTATION_IMPORT') async importErrors(@Param('batchId') batchId: string, @CurrentUser() user: AdminCurrentUser, @Res() response: Response) { const buffer = await this.consultations.importErrorsBuffer(batchId, user); response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('网咨导入错误明细.xlsx')}`); response.send(buffer); }
  @Get('/export/file') @Permissions('CONSULTATION_EXPORT') async export(@Query() query: ConsultationListQueryDto, @CurrentUser() user: AdminCurrentUser, @Res() response: Response) { const buffer = await this.consultations.exportBuffer(query, user); response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`网咨数据-${Date.now()}.xlsx`)}`); response.send(buffer); }

  @Get('/settings/fields') @Permissions('CONSULTATION_SETTINGS') fields() { return this.consultations.fields(); }
  @Post('/settings/fields') @Permissions('CONSULTATION_SETTINGS') createField(@Body() dto: ConsultationFieldDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.createField(dto, user, req.ip, req.headers['user-agent']); }
  @Patch('/settings/fields/:id') @Permissions('CONSULTATION_SETTINGS') updateField(@Param('id') id: string, @Body() dto: UpdateConsultationFieldDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.updateField(id, dto, user, req.ip, req.headers['user-agent']); }
  @Delete('/settings/fields/:id') @Permissions('CONSULTATION_SETTINGS') deleteField(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.deleteField(id, user, req.ip, req.headers['user-agent']); }
  @Get('/settings/statuses') @Permissions('CONSULTATION_SETTINGS') statuses() { return this.consultations.statuses(); }
  @Post('/settings/statuses') @Permissions('CONSULTATION_SETTINGS') createStatus(@Body() dto: ConsultationStatusDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.createStatus(dto, user, req.ip, req.headers['user-agent']); }
  @Patch('/settings/statuses/:id') @Permissions('CONSULTATION_SETTINGS') updateStatus(@Param('id') id: string, @Body() dto: UpdateConsultationStatusDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.updateStatus(id, dto, user, req.ip, req.headers['user-agent']); }
  @Delete('/settings/statuses/:id') @Permissions('CONSULTATION_SETTINGS') deleteStatus(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.deleteStatus(id, user, req.ip, req.headers['user-agent']); }
  @Get('/settings/tags') @Permissions('CONSULTATION_SETTINGS') tags() { return this.consultations.tags(); }
  @Get('/settings/validity-rule') @Permissions('CONSULTATION_SETTINGS') validityRule() { return this.consultations.validityRule(); }
  @Put('/settings/validity-rule') @Permissions('CONSULTATION_SETTINGS') saveValidityRule(@Body() dto: ConsultationValidityRuleDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.saveValidityRule(dto, user, req.ip, req.headers['user-agent']); }
  @Post('/settings/tags') @Permissions('CONSULTATION_SETTINGS') createTag(@Body() dto: ConsultationTagDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.createTag(dto, user, req.ip, req.headers['user-agent']); }
  @Patch('/settings/tags/:id') @Permissions('CONSULTATION_SETTINGS') updateTag(@Param('id') id: string, @Body() dto: UpdateConsultationTagDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.updateTag(id, dto, user, req.ip, req.headers['user-agent']); }
  @Delete('/settings/tags/:id') @Permissions('CONSULTATION_SETTINGS') deleteTag(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.deleteTag(id, user, req.ip, req.headers['user-agent']); }

  @Get('/:id') @Permissions('CONSULTATION_VIEW') detail(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser) { return this.consultations.detail(id, user); }
  @Delete('/:id') @Permissions('CONSULTATION_DELETE') delete(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.deleteForm(id, user, req.ip, req.headers['user-agent']); }
  @Patch('/:id') @Permissions('CONSULTATION_EDIT') update(@Param('id') id: string, @Body() dto: UpdateConsultationDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.update(id, dto, user, req.ip, req.headers['user-agent']); }
  @Post('/:id/follow-ups') @Permissions('CONSULTATION_FOLLOW_UP') addFollowUp(@Param('id') id: string, @Body() dto: ConsultationFollowUpDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.addFollowUp(id, dto, user, req.ip, req.headers['user-agent']); }
  @Patch('/:id/assign') @Permissions('CONSULTATION_ASSIGN') assign(@Param('id') id: string, @Body() dto: ConsultationAssignDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.consultations.assign(id, dto, user, req.ip, req.headers['user-agent']); }
}
