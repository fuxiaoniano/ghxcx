import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, MiniCurrentUser } from '../../common/decorators/current-user.decorator';
import { MiniAuthGuard } from '../../common/guards/mini-auth.guard';
import { CreateAppointmentDto } from './dto';
import { AppointmentsService } from './appointments.service';

@ApiTags('小程序挂号')
@ApiBearerAuth()
@UseGuards(MiniAuthGuard)
@Controller('/api/appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post()
  create(@CurrentUser() user: MiniCurrentUser, @Body() dto: CreateAppointmentDto) {
    return this.appointments.create(user.userId, dto);
  }

  @Get('/my')
  my(@CurrentUser() user: MiniCurrentUser) {
    return this.appointments.findMine(user.userId);
  }

  @Get('/my/:id')
  myDetail(@CurrentUser() user: MiniCurrentUser, @Param('id') id: string) {
    return this.appointments.findMineDetail(user.userId, id);
  }
}
