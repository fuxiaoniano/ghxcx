import axios from 'axios';
import { ElMessage } from 'element-plus';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 60000
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response): any => {
    const body = response.data as ApiResponse<unknown>;
    if (body && body.code === 0) {
    return body.data;
    }
    const message = body?.message || '请求失败';
    if (body?.code === 401 || body?.code === 401501 || body?.code === 401502) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
    }
    ElMessage.error(message);
    return Promise.reject(new Error(message));
  },
  (error) => {
    const message = error.response?.data?.message || error.message || '网络异常';
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
    }
    ElMessage.error(message);
    return Promise.reject(error);
  }
);
