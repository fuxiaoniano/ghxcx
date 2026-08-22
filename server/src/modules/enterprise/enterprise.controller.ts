import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, MiniCurrentUser } from '../../common/decorators/current-user.decorator';
import { MiniAuthGuard } from '../../common/guards/mini-auth.guard';
import { CreateDoctorAppointmentDto, CreatePackageApplicationDto } from './dto';
import { EnterpriseService } from './enterprise.service';

/** 企业官网公开内容接口，不改变旧落地页配置接口。 */
@ApiTags('企业口腔官网')
@Controller('/api/enterprise')
export class EnterpriseController {
  constructor(private readonly enterprise: EnterpriseService) {}

  @Get('/home')
  home() { return this.enterprise.home(); }

  @Get('/categories')
  categories() { return this.enterprise.categories(); }

  @Get('/doctors')
  doctors(@Query() query: Record<string, string>) { return this.enterprise.doctors(query); }

  @Get('/doctors/:id')
  doctor(@Param('id') id: string) { return this.enterprise.doctorDetail(id); }

  @Get('/packages')
  packages(@Query() query: Record<string, string>) { return this.enterprise.packages(query); }

  @Get('/packages/:id')
  packageDetail(@Param('id') id: string) { return this.enterprise.packageDetail(id); }
}

/** 新预约写接口独立鉴权，继续复用原小程序登录 token。 */
@ApiTags('企业口腔预约')
@ApiBearerAuth()
@UseGuards(MiniAuthGuard)
@Controller('/api/enterprise')
export class EnterpriseAppointmentsController {
  constructor(private readonly enterprise: EnterpriseService) {}

  @Post('/appointments/doctor')
  doctorAppointment(@CurrentUser() user: MiniCurrentUser, @Body() dto: CreateDoctorAppointmentDto) {
    return this.enterprise.createDoctorAppointment(user.userId, dto);
  }

  @Post('/appointments/package')
  packageApplication(@CurrentUser() user: MiniCurrentUser, @Body() dto: CreatePackageApplicationDto) {
    return this.enterprise.createPackageApplication(user.userId, dto);
  }

  @Get('/records/my')
  myRecords(@CurrentUser() user: MiniCurrentUser, @Query() query: Record<string, string>) {
    return this.enterprise.myRecords(user.userId, query);
  }

  @Get('/profile')
  profile(@CurrentUser() user: MiniCurrentUser) {
    return this.enterprise.profile(user.userId);
  }
}
