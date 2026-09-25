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
        secret: this.config.get<string>('ADMIN_JWT_SECRET') || 'dev-admin-secret'
      });
      const admin = await this.prisma.adminUser.findUnique({ where: { id: payload.adminUserId } });
      if (!admin || admin.status !== AdminStatus.ACTIVE) {
        throw new UnauthorizedException('后台账号已停用');
      }
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('后台登录已过期，请重新登录');
    }
  }

  private extractBearer(request: Request): string | null {
    const authorization = request.headers.authorization || '';
    const [type, token] = authorization.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
