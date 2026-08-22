import { defineStore } from 'pinia';
import { adminLogin } from '../api/admin';

export interface AdminProfile {
  id: string;
  username: string;
  nickname: string;
  role: string;
  permissions: string[];
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
    /** 新旧预约权限双向识别，避免升级后已有管理员突然失去原挂号能力。 */
    hasPermission(permission: string) {
      if (this.user?.role === 'SUPER_ADMIN') return true;
      const permissions = new Set(this.user?.permissions || []);
      const aliases: Record<string, string[]> = {
        MANAGE_APPOINTMENTS: ['APPOINTMENT_MANAGE'],
        APPOINTMENT_MANAGE: ['MANAGE_APPOINTMENTS']
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
