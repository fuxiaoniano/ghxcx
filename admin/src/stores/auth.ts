import { defineStore } from 'pinia';
import { adminLogin } from '../api/admin';

export interface AdminProfile {
  id: string;
  username: string;
  nickname: string;
  role: string;
  roleName?: string;
  permissions: string[];
  dataScope?: 'SELF' | 'ASSIGNED_MEMBERS' | 'TEAM' | 'ALL';
  dataScopeMemberIds?: string[];
  teamId?: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('admin_token') || '',
    user: JSON.parse(localStorage.getItem('admin_user') || 'null') as AdminProfile | null
  }),
  actions: {
    acceptLogin(result: { token: string; user: AdminProfile }) {
      this.token = result.token;
      this.user = result.user;
      localStorage.setItem('admin_token', result.token);
      localStorage.setItem('admin_user', JSON.stringify(result.user));
    },
    async login(username: string, password: string) {
      const result = await adminLogin({ username, password });
      this.acceptLogin(result);
    },
    /** 新细分权限兼容旧聚合权限；禁止单个细分权限反向放大为整组权限。 */
    hasPermission(permission: string) {
      if (this.user?.role === 'SUPER_ADMIN') return true;
      const permissions = new Set(this.user?.permissions || []);
      const aliases: Record<string, string[]> = {
        APPOINTMENT_MANAGE: ['MANAGE_APPOINTMENTS'],
        BUSINESS_LEADS: ['MANAGE_APPOINTMENTS', 'APPOINTMENT_MANAGE'],
        BUSINESS_APPOINTMENTS: ['MANAGE_APPOINTMENTS', 'APPOINTMENT_MANAGE'],
        BUSINESS_USERS: ['MANAGE_APPOINTMENTS', 'APPOINTMENT_MANAGE'],
        BUSINESS_NOTIFICATIONS: ['MANAGE_APPOINTMENTS', 'APPOINTMENT_MANAGE'],
        CONTENT_HOME: ['HOME_MANAGE'], CONTENT_DEPARTMENTS: ['DOCTOR_MANAGE'], CONTENT_DOCTORS: ['DOCTOR_MANAGE'], CONTENT_PACKAGES: ['PACKAGE_MANAGE'],
        CONTENT_MEDIA: ['HOME_MANAGE', 'DOCTOR_MANAGE', 'PACKAGE_MANAGE'], CONTENT_LINKS: ['HOME_MANAGE', 'DOCTOR_MANAGE', 'PACKAGE_MANAGE'],
        WEBSITE_SETTINGS: ['WEBSITE_MANAGE'], WEBSITE_CATEGORIES: ['WEBSITE_MANAGE'], WEBSITE_ARTICLES: ['WEBSITE_MANAGE'],
        WECHAT_MENU: ['WECHAT_MANAGE'], WECHAT_AUTO_REPLY: ['WECHAT_MANAGE'],
        PROMOTION_OPERATIONS: ['PROMOTION_MANAGE'],
        PROMOTION_CREATIVE_BATCH_VIEW: ['PROMOTION_MANAGE'], PROMOTION_CREATIVE_BATCH_CREATE: ['PROMOTION_MANAGE'],
        PROMOTION_CREATIVE_BATCH_RETRY: ['PROMOTION_MANAGE'], PROMOTION_CREATIVE_BATCH_CANCEL: ['PROMOTION_MANAGE'],
        PROMOTION_CREATIVE_TEMPLATE_VIEW: ['PROMOTION_MANAGE'], PROMOTION_CREATIVE_ASSET_VIEW: ['PROMOTION_MANAGE'],
        PROMOTION_CREATIVE_RESULT_EXPORT: ['PROMOTION_MANAGE'],
        PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW: ['PROMOTION_MANAGE'], PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CREATE: ['PROMOTION_MANAGE'],
        PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_RETRY: ['PROMOTION_MANAGE'], PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CANCEL: ['PROMOTION_MANAGE'],
        PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_RESULT_EXPORT: ['PROMOTION_MANAGE'], PROMOTION_CREATIVE_DEFAULT_COMPONENT_VIEW: ['PROMOTION_MANAGE'],
        PROMOTION_CREATIVE_DEFAULT_COMPONENT_MANAGE: ['PROMOTION_MANAGE'], PROMOTION_CREATIVE_ASSET_CROSS_ACCOUNT_USE: ['PROMOTION_MANAGE'],
        PROMOTION_CREATIVE_ASSET_DISTRIBUTION: ['PROMOTION_MANAGE'],
        SYSTEM_MEMBERS: ['MANAGE_ADMINS'], SYSTEM_APPOINTMENT_NOTIFY: ['SYSTEM_MEMBERS', 'MANAGE_ADMINS'], SYSTEM_ROLES: ['MANAGE_ADMINS'], SYSTEM_OFFICIAL_BINDING: ['SYSTEM_MANAGE'], SYSTEM_CONFIGS: ['SYSTEM_MANAGE'],
        SYSTEM_FOLLOWUP: ['SYSTEM_MANAGE'], SYSTEM_WEBSITE_ANALYTICS: ['SYSTEM_MANAGE'], SYSTEM_AUDIT: ['SYSTEM_MANAGE'],
      };
      return permissions.has(permission) || (aliases[permission] || []).some((item) => permissions.has(item));
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
    }
  }
});
