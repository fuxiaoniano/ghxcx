import { Injectable } from '@nestjs/common';
import { AdminStatus } from '@prisma/client';
import { AdminCurrentUser } from '../decorators/current-user.decorator';
import { BusinessException } from '../utils/business-exception';
import { PrismaService } from '../../prisma/prisma.service';

type OwnedRecord = Record<string, unknown>;

/**
 * 业务管理、推广数据和网咨数据共用的数据范围服务。
 * 这里始终根据成员当前团队关系计算，不缓存团队快照，避免调岗后继续越权访问。
 */
@Injectable()
export class DataScopeService {
  constructor(private readonly prisma: PrismaService) {}

  isAll(user: AdminCurrentUser) {
    return user.role === 'SUPER_ADMIN' || user.dataScope === 'ALL';
  }

  async permittedAdminIds(user: AdminCurrentUser): Promise<string[] | null> {
    if (this.isAll(user)) return null;
    if (user.dataScope === 'SELF') return [user.adminUserId];
    if (user.dataScope === 'ASSIGNED_MEMBERS') {
      return [...new Set([user.adminUserId, ...(user.dataScopeMemberIds || [])])];
    }
    if (user.dataScope === 'TEAM') {
      if (!user.teamId) return [user.adminUserId];
      const teams = await this.prisma.adminTeam.findMany({
        where: { status: AdminStatus.ACTIVE },
        select: { id: true, parentId: true }
      });
      const teamIds = new Set<string>([user.teamId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const team of teams) {
          if (team.parentId && teamIds.has(team.parentId) && !teamIds.has(team.id)) {
            teamIds.add(team.id);
            changed = true;
          }
        }
      }
      const members = await this.prisma.adminUser.findMany({
        where: { teamId: { in: [...teamIds] }, status: AdminStatus.ACTIVE, deletedAt: null },
        select: { id: true }
      });
      return [...new Set([user.adminUserId, ...members.map((item) => item.id)])];
    }
    return [user.adminUserId];
  }

  async ownershipWhere(
    user: AdminCurrentUser,
    ownerField: string,
    creatorField: string
  ): Promise<Record<string, unknown>> {
    const memberIds = await this.permittedAdminIds(user);
    if (memberIds === null) return {};
    return {
      OR: [
        { [ownerField]: { in: memberIds } },
        { [creatorField]: { in: memberIds } }
      ]
    };
  }

  async assertOwned(
    user: AdminCurrentUser,
    record: OwnedRecord,
    ownerField: string,
    creatorField: string,
    message = '无权访问该数据'
  ) {
    const memberIds = await this.permittedAdminIds(user);
    if (memberIds === null) return;
    const ownerId = typeof record[ownerField] === 'string' ? record[ownerField] : '';
    const creatorId = typeof record[creatorField] === 'string' ? record[creatorField] : '';
    if (!memberIds.includes(ownerId) && !memberIds.includes(creatorId)) {
      throw new BusinessException(403011, message, 403);
    }
  }

  async validateAssignedMembers(memberIds: string[]) {
    const uniqueIds = [...new Set(memberIds.filter(Boolean))];
    if (!uniqueIds.length) return [];
    const count = await this.prisma.adminUser.count({
      where: { id: { in: uniqueIds }, status: AdminStatus.ACTIVE, deletedAt: null }
    });
    if (count !== uniqueIds.length) {
      throw new BusinessException(400711, '指定数据范围中包含无效或已停用成员');
    }
    return uniqueIds;
  }
}
