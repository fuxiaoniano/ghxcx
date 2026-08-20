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
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
    }
  }
});
