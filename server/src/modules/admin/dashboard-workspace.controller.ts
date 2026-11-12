import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminCurrentUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { DashboardWorkspaceService } from './dashboard-workspace.service';

const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

class DashboardPreferenceDto {
  @IsArray() @ArrayMaxSize(80) @IsString({ each: true }) @MaxLength(100, { each: true }) modules!: string[];
}

class DashboardTodoDto {
  @IsString() @MaxLength(200) title!: string;
  @IsDateString() dueAt!: string;
  @IsIn(priorities) priority!: string;
}

class DashboardTodoUpdateDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsIn(priorities) priority?: string;
  @IsOptional() @IsBoolean() completed?: boolean;
}

@UseGuards(AdminAuthGuard)
@Controller('/api/admin/dashboard-workspace')
export class DashboardWorkspaceController {
  constructor(private readonly workspace: DashboardWorkspaceService) {}

  @Get('/preferences') preferences(@CurrentUser() user: AdminCurrentUser) { return this.workspace.preferences(user.adminUserId); }
  @Put('/preferences') savePreferences(@CurrentUser() user: AdminCurrentUser, @Body() dto: DashboardPreferenceDto) { return this.workspace.savePreferences(user.adminUserId, dto.modules); }
  @Get('/todos') todos(@CurrentUser() user: AdminCurrentUser) { return this.workspace.todos(user.adminUserId); }
  @Post('/todos') createTodo(@CurrentUser() user: AdminCurrentUser, @Body() dto: DashboardTodoDto) { return this.workspace.createTodo(user.adminUserId, dto); }
  @Patch('/todos/:id') updateTodo(@CurrentUser() user: AdminCurrentUser, @Param('id') id: string, @Body() dto: DashboardTodoUpdateDto) { return this.workspace.updateTodo(user.adminUserId, id, dto); }
  @Delete('/todos/:id') deleteTodo(@CurrentUser() user: AdminCurrentUser, @Param('id') id: string) { return this.workspace.deleteTodo(user.adminUserId, id); }
}
