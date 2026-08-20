import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MiniAuthGuard implements CanActivate {
  private readonly jwt = new JwtService();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const token = this.extractBearer(request);
    if (!token) {
      throw new UnauthorizedException('请先登录');
    }
    try {
      const payload = this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_SECRET') || 'dev-mini-secret'
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('账号不可用');
      }
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
  }

  private extractBearer(request: Request): string | null {
    const authorization = request.headers.authorization || '';
    const [type, token] = authorization.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
