import { Injectable } from '@nestjs/common';
import { AdminCurrentUser } from '../decorators/current-user.decorator';
import { BusinessException } from '../utils/business-exception';
import { PrismaService } from '../../prisma/prisma.service';

export type PromotionAccountCapability = 'DATA' | 'MATERIALS' | 'CREATIVES';

@Injectable()
export class PromotionAccountAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async where(user: AdminCurrentUser, capability: PromotionAccountCapability = 'DATA') {
    if (this.isAdministrator(user)) return {};
    const grantField = capability === 'DATA' ? 'canViewData' : capability === 'MATERIALS' ? 'canViewMaterials' : 'canViewCreatives';
    return {
      OR: [
        { ownerAdminId: user.adminUserId },
        { createdByAdminId: user.adminUserId },
        { accessGrants: { some: { adminUserId: user.adminUserId, [grantField]: true } } },
      ],
    };
  }

  async assertVisible(user: AdminCurrentUser, account: { id: string; ownerAdminId?: string | null; createdByAdminId?: string | null }, capability: PromotionAccountCapability = 'DATA') {
    if (this.isAdministrator(user) || account.ownerAdminId === user.adminUserId || account.createdByAdminId === user.adminUserId) return;
    const grant = await this.prisma.promotionAccountAccessGrant.findFirst({
      where: { accountId: account.id, adminUserId: user.adminUserId, ...(capability === 'DATA' ? { canViewData: true } : capability === 'MATERIALS' ? { canViewMaterials: true } : { canViewCreatives: true }) },
      select: { id: true },
    });
    if (!grant) throw new BusinessException(403901, '无权访问该推广账户数据', 403);
  }

  async assertCredentialManager(user: AdminCurrentUser, account: { ownerAdminId?: string | null; createdByAdminId?: string | null }) {
    if (this.isAdministrator(user) || account.ownerAdminId === user.adminUserId || account.createdByAdminId === user.adminUserId) return;
    throw new BusinessException(403902, '只有账户创建人、负责人或管理员可以维护账户授权凭证', 403);
  }

  async assertCanCreateCreatives(user: AdminCurrentUser, account: { id: string; ownerAdminId?: string | null; createdByAdminId?: string | null }) {
    if (this.isAdministrator(user) || account.ownerAdminId === user.adminUserId || account.createdByAdminId === user.adminUserId) return;
    const grant = await this.prisma.promotionAccountAccessGrant.findFirst({ where: { accountId: account.id, adminUserId: user.adminUserId, canViewCreatives: true, canCreateCreatives: true }, select: { id: true } });
    if (!grant) throw new BusinessException(403904, '该账户未授权当前成员创建创意', 403);
  }

  async canCreateCreatives(user: AdminCurrentUser, account: { id: string; ownerAdminId?: string | null; createdByAdminId?: string | null }) {
    if (this.isAdministrator(user) || account.ownerAdminId === user.adminUserId || account.createdByAdminId === user.adminUserId) return true;
    const grant = await this.prisma.promotionAccountAccessGrant.findFirst({ where: { accountId: account.id, adminUserId: user.adminUserId, canViewCreatives: true, canCreateCreatives: true }, select: { id: true } });
    return Boolean(grant);
  }

  assertGrantAdministrator(user: AdminCurrentUser) {
    if (!this.isAdministrator(user)) throw new BusinessException(403903, '只有管理员可以授权或撤销推广账户数据访问', 403);
  }

  isAdministrator(user: AdminCurrentUser) { return user.role === 'SUPER_ADMIN' || user.role === 'MANAGER'; }
}
