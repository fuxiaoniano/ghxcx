import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AdminCurrentUser } from '../decorators/current-user.decorator';
import { BusinessException } from '../utils/business-exception';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{ user?: AdminCurrentUser }>();
    const user = request.user;
    if (!user) {
      throw new BusinessException(403001, '无权限访问', 403);
    }
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }
    const owned = new Set(user.permissions || []);
    const allowed = required.every((permission) => owned.has(permission));
    if (!allowed) {
      throw new BusinessException(403002, '当前账号无此操作权限', 403);
    }
    return true;
  }
}
