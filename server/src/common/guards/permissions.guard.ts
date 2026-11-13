import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from '../decorators/permissions.decorator';
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
    const anyRequired = this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if ((!required || required.length === 0) && (!anyRequired || anyRequired.length === 0)) {
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
    // 仅允许“新细分权限 -> 旧聚合权限”的兼容方向。
    // 旧聚合权限可以继续访问原页面，但单个新细分权限不能反向获得整组旧权限。
    const aliases: Record<string, string[]> = {
      APPOINTMENT_MANAGE: ['MANAGE_APPOINTMENTS'],
      BUSINESS_LEADS: ['MANAGE_APPOINTMENTS', 'APPOINTMENT_MANAGE'],
      BUSINESS_APPOINTMENTS: ['MANAGE_APPOINTMENTS', 'APPOINTMENT_MANAGE'],
      BUSINESS_USERS: ['MANAGE_APPOINTMENTS', 'APPOINTMENT_MANAGE'],
      BUSINESS_NOTIFICATIONS: ['MANAGE_APPOINTMENTS', 'APPOINTMENT_MANAGE'],
      CONTENT_HOME: ['HOME_MANAGE'],
      CONTENT_DEPARTMENTS: ['DOCTOR_MANAGE'],
      CONTENT_DOCTORS: ['DOCTOR_MANAGE'],
      CONTENT_PACKAGES: ['PACKAGE_MANAGE'],
      CONTENT_MEDIA: ['HOME_MANAGE', 'DOCTOR_MANAGE', 'PACKAGE_MANAGE'],
      CONTENT_LINKS: ['HOME_MANAGE', 'DOCTOR_MANAGE', 'PACKAGE_MANAGE'],
      WEBSITE_SETTINGS: ['WEBSITE_MANAGE'],
      WEBSITE_CATEGORIES: ['WEBSITE_MANAGE'],
      WEBSITE_ARTICLES: ['WEBSITE_MANAGE'],
      AFTERBEAT_SETTINGS: ['AFTERBEAT_MANAGE'],
      AFTERBEAT_CATEGORIES: ['AFTERBEAT_MANAGE'],
      AFTERBEAT_ARTICLES: ['AFTERBEAT_MANAGE'],
      WECHAT_MENU: ['WECHAT_MANAGE'],
      WECHAT_AUTO_REPLY: ['WECHAT_MANAGE'],
      PROMOTION_OPERATIONS: ['PROMOTION_MANAGE'],
      PROMOTION_CREATIVE_BATCH_VIEW: ['PROMOTION_MANAGE'],
      PROMOTION_CREATIVE_BATCH_CREATE: ['PROMOTION_MANAGE'],
      PROMOTION_CREATIVE_BATCH_RETRY: ['PROMOTION_MANAGE'],
      PROMOTION_CREATIVE_BATCH_CANCEL: ['PROMOTION_MANAGE'],
      PROMOTION_CREATIVE_TEMPLATE_VIEW: ['PROMOTION_MANAGE'],
      PROMOTION_CREATIVE_ASSET_VIEW: ['PROMOTION_MANAGE'],
      PROMOTION_CREATIVE_RESULT_EXPORT: ['PROMOTION_MANAGE'],
      PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW: ['PROMOTION_MANAGE'],
      PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CREATE: ['PROMOTION_MANAGE'],
      PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_RETRY: ['PROMOTION_MANAGE'],
      PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CANCEL: ['PROMOTION_MANAGE'],
      PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_RESULT_EXPORT: ['PROMOTION_MANAGE'],
      PROMOTION_CREATIVE_DEFAULT_COMPONENT_VIEW: ['PROMOTION_MANAGE'],
      PROMOTION_CREATIVE_DEFAULT_COMPONENT_MANAGE: ['PROMOTION_MANAGE'],
      PROMOTION_CREATIVE_ASSET_CROSS_ACCOUNT_USE: ['PROMOTION_MANAGE'],
      PROMOTION_CREATIVE_ASSET_DISTRIBUTION: ['PROMOTION_MANAGE'],
      SYSTEM_MEMBERS: ['MANAGE_ADMINS'],
      SYSTEM_APPOINTMENT_NOTIFY: ['SYSTEM_MEMBERS', 'MANAGE_ADMINS'],
      SYSTEM_ROLES: ['MANAGE_ADMINS'],
      SYSTEM_OFFICIAL_BINDING: ['SYSTEM_MANAGE'],
      SYSTEM_CONFIGS: ['SYSTEM_MANAGE'],
      SYSTEM_FOLLOWUP: ['SYSTEM_MANAGE'],
      SYSTEM_WEBSITE_ANALYTICS: ['SYSTEM_MANAGE'],
      SYSTEM_AUDIT: ['SYSTEM_MANAGE']
    };
    const hasPermission = (permission: string) =>
      owned.has(permission) || (aliases[permission] || []).some((alias) => owned.has(alias));
    const allowed = (!required || required.every(hasPermission)) &&
      (!anyRequired || anyRequired.some(hasPermission));
    if (!allowed) {
      throw new BusinessException(403002, '当前账号无此操作权限', 403);
    }
    return true;
  }
}
