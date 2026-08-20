import { API_BASE_URL } from '../utils/config';
import { ApiResponse } from './types';

export function request<T>(options: {
  url: string;
  method?: 'GET' | 'POST';
  data?: WechatMiniprogram.IAnyObject;
  auth?: boolean;
}): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    wx.request<ApiResponse<T>>({
      url: `${API_BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'content-type': 'application/json',
        ...(options.auth && token ? { Authorization: `Bearer ${token}` } : {})
      },
      success(response) {
        const body = response.data;
        if (body && body.code === 0) {
          resolve(body.data);
          return;
        }
        reject(new Error(body?.message || '请求失败'));
      },
      fail(error) {
        const message = error.errMsg || '网络请求失败';
        if (message.includes('url not in domain list')) {
          reject(new Error('小程序服务器域名未配置，请在微信小程序后台 request 合法域名添加：https://zbsfxn.cqzbskq.com'));
          return;
        }
        reject(new Error(message));
      }
    });
  });
}
