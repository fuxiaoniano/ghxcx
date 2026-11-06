import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { AdminCurrentUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { BusinessException } from '../../common/utils/business-exception';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ConsultationReportService } from './consultation-report.service';

class ConsultationReportQuery {
  @IsIn(['channel', 'daily']) mode!: 'channel' | 'daily';
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
  @IsOptional() @IsString() @MaxLength(80) project?: string;
  @IsOptional() @IsString() @MaxLength(120) channel?: string;
  @IsOptional() @IsString() @MaxLength(500) customFields?: string;
}

@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('/api/admin/consultation-reports')
export class ConsultationReportController {
  constructor(private readonly reports: ConsultationReportService) {}

  @Get('/') report(@Query() query: ConsultationReportQuery, @CurrentUser() user: AdminCurrentUser) {
    const required = query.mode === 'channel' ? 'CONSULTATION_CHANNEL_REPORT' : 'CONSULTATION_TEAM_REPORT';
    if (user.role !== 'SUPER_ADMIN' && !user.permissions?.includes(required)) throw new BusinessException(403001, '无权限访问', 403);
    return this.reports.report(query, user);
  }
}
