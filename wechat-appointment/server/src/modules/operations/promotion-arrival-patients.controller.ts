import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AdminCurrentUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PromotionArrivalFieldDto, PromotionArrivalPatientDto, PromotionArrivalPatientQueryDto } from './promotion-arrival-patients.dto';
import { PromotionArrivalPatientsService } from './promotion-arrival-patients.service';

@ApiTags('管理后台 - 患者收费')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('/api/admin/operations/arrival-patients')
export class PromotionArrivalPatientsController {
  constructor(private readonly service: PromotionArrivalPatientsService) {}
  @Get('/meta') @Permissions('PROMOTION_ARRIVAL_PATIENT_VIEW') meta(@CurrentUser() user: AdminCurrentUser) { return this.service.meta(user); }
  @Get('/import/template') @Permissions('PROMOTION_ARRIVAL_PATIENT_EDIT') async template(@CurrentUser() user: AdminCurrentUser, @Res() response: Response) { const buffer = await this.service.templateBuffer(user); response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('患者收费导入模板.xlsx')}`); response.send(buffer); }
  @Post('/import') @Permissions('PROMOTION_ARRIVAL_PATIENT_EDIT') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })) importFile(@UploadedFile() file: any, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.service.importBuffer(file, user, req.ip, req.headers['user-agent']); }
  @Get('/export') @Permissions('PROMOTION_ARRIVAL_PATIENT_VIEW') async exportFile(@Query() query: PromotionArrivalPatientQueryDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request, @Res() response: Response) { const buffer = await this.service.exportBuffer(query, user, req.ip, req.headers['user-agent']); response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`患者收费明细-${Date.now()}.xlsx`)}`); response.send(buffer); }
  @Get() @Permissions('PROMOTION_ARRIVAL_PATIENT_VIEW') list(@Query() query: PromotionArrivalPatientQueryDto, @CurrentUser() user: AdminCurrentUser) { return this.service.list(query, user); }
  @Post() @Permissions('PROMOTION_ARRIVAL_PATIENT_EDIT') create(@Body() dto: PromotionArrivalPatientDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.service.create(dto, user, req.ip, req.headers['user-agent']); }
  @Patch('/:id') @Permissions('PROMOTION_ARRIVAL_PATIENT_EDIT') update(@Param('id') id: string, @Body() dto: PromotionArrivalPatientDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.service.update(id, dto, user, req.ip, req.headers['user-agent']); }
  @Delete('/:id') @Permissions('PROMOTION_ARRIVAL_PATIENT_DELETE') remove(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.service.remove(id, user, req.ip, req.headers['user-agent']); }
  @Get('/fields/list') @Permissions('PROMOTION_ARRIVAL_PATIENT_VIEW') fields() { return this.service.fields(); }
  @Post('/fields') @Permissions('PROMOTION_ARRIVAL_PATIENT_FIELDS') createField(@Body() dto: PromotionArrivalFieldDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.service.createField(dto, user, req.ip, req.headers['user-agent']); }
  @Patch('/fields/:id') @Permissions('PROMOTION_ARRIVAL_PATIENT_FIELDS') updateField(@Param('id') id: string, @Body() dto: PromotionArrivalFieldDto, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.service.updateField(id, dto, user, req.ip, req.headers['user-agent']); }
  @Delete('/fields/:id') @Permissions('PROMOTION_ARRIVAL_PATIENT_FIELDS') removeField(@Param('id') id: string, @CurrentUser() user: AdminCurrentUser, @Req() req: Request) { return this.service.deleteField(id, user, req.ip, req.headers['user-agent']); }
}
