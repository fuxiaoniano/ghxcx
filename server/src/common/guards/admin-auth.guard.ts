import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminStatus } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly jwt = new JwtService();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const token = this.extractBearer(request);
    if (!token) {
      throw new UnauthorizedException('请先登录后台');
    }
    try {
      const payload = this.jwt.verify(token, {
        secret: this.jwtSecret()
      });
      const admin = await this.prisma.adminUser.findUnique({ where: { id: payload.adminUserId }, include: { customRole: true } });
      if (!admin || admin.status !== AdminStatus.ACTIVE) {
        throw new UnauthorizedException('后台账号已停用');
      }
      const storedPermissions = admin.customRole?.permissionsJson ?? admin.permissionsJson;
      const permissions = Array.isArray(storedPermissions) ? storedPermissions.filter((item): item is string => typeof item === 'string') : [];
      const storedScopeMembers = admin.customRole?.dataScopeMemberIds ?? admin.dataScopeMemberIds;
      const dataScopeMemberIds = Array.isArray(storedScopeMembers)
        ? storedScopeMembers.filter((item): item is string => typeof item === 'string')
        : [];
      request.user = {
        ...payload,
        adminUserId: admin.id,
        username: admin.username,
        nickname: admin.nickname || admin.username,
        role: admin.role,
        roleName: admin.customRole?.name,
        permissions,
        dataScope: admin.role === 'SUPER_ADMIN' ? 'ALL' : (admin.customRole?.dataScope ?? admin.dataScope),
        dataScopeMemberIds,
        teamId: admin.teamId,
        consultationReceivable: admin.consultationReceivable,
      };
      return true;
    } catch {
      throw new UnauthorizedException('后台登录已过期，请重新登录');
    }
  }

  private jwtSecret(): string {
    const value = this.config.get<string>('ADMIN_JWT_SECRET');
    if (value) return value;
    if (this.config.get<string>('NODE_ENV') !== 'production') return 'dev-admin-secret';
    throw new UnauthorizedException('后台鉴权配置不可用');
  }

  private extractBearer(request: Request): string | null {
    const authorization = request.headers.authorization || '';
    const [type, token] = authorization.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
