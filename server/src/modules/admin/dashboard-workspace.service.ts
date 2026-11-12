import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/utils/business-exception';

const allowedModules = ['METRICS', 'TREND', 'RECENT'] as const;
const defaultModules = ['PAGE:/consultations/callbacks', 'PAGE:/consultations'] as const;
const validModule = (value: string) => allowedModules.includes(value as typeof allowedModules[number]) || /^PAGE:\/[a-z0-9/-]{1,80}$/.test(value);

@Injectable()
export class DashboardWorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async preferences(adminUserId: string) {
    const row = await this.prisma.adminDashboardPreference.findUnique({ where: { adminUserId } });
    const saved = Array.isArray(row?.modulesJson) ? row.modulesJson : defaultModules;
    return { modules: saved.filter((value): value is string => typeof value === 'string' && validModule(value)) };
  }

  async savePreferences(adminUserId: string, modules: string[]) {
    const unique = [...new Set(modules)];
    if (unique.length !== modules.length || unique.length > 80 || unique.some((item) => !validModule(item))) throw new BusinessException(400931, '仪表盘模块无效');
    await this.prisma.adminDashboardPreference.upsert({ where: { adminUserId }, create: { adminUserId, modulesJson: unique }, update: { modulesJson: unique } });
    return { modules: unique };
  }

  todos(adminUserId: string) {
    return this.prisma.adminDashboardTodo.findMany({ where: { adminUserId }, orderBy: [{ completed: 'asc' }, { dueAt: 'asc' }], take: 100 });
  }

  async createTodo(adminUserId: string, dto: { title: string; dueAt: string; priority: string }) {
    const title = dto.title.trim();
    if (!title) throw new BusinessException(400932, '请填写待办内容');
    return this.prisma.adminDashboardTodo.create({ data: { adminUserId, title, dueAt: new Date(dto.dueAt), priority: dto.priority } });
  }

  async updateTodo(adminUserId: string, id: string, dto: { title?: string; dueAt?: string; priority?: string; completed?: boolean }) {
    const data: Prisma.AdminDashboardTodoUpdateInput = {};
    if (dto.title !== undefined) { if (!dto.title.trim()) throw new BusinessException(400932, '请填写待办内容'); data.title = dto.title.trim(); }
    if (dto.dueAt !== undefined) data.dueAt = new Date(dto.dueAt);
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.completed !== undefined) data.completed = dto.completed;
    const result = await this.prisma.adminDashboardTodo.updateMany({ where: { id, adminUserId }, data });
    if (!result.count) throw new BusinessException(404932, '待办不存在', 404);
    return this.prisma.adminDashboardTodo.findUnique({ where: { id } });
  }

  async deleteTodo(adminUserId: string, id: string) {
    const result = await this.prisma.adminDashboardTodo.deleteMany({ where: { id, adminUserId } });
    if (!result.count) throw new BusinessException(404932, '待办不存在', 404);
    return { deleted: true };
  }
}
