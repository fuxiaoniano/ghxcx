import { request } from './request';
import { LoginResult } from './types';

export function miniLogin(bindToken?: string) {
  return new Promise<LoginResult>((resolve, reject) => {
    wx.login({
      success(result) {
        request<LoginResult>({
          url: '/api/wechat/mini/login',
          method: 'POST',
          data: { code: result.code, bindToken }
        })
          .then((data) => {
            wx.setStorageSync('token', data.token);
            resolve(data);
          })
          .catch(reject);
      },
      fail(error) {
        reject(new Error(error.errMsg || '微信登录失败'));
      }
    });
  });
}

export function authorizePhone(code: string) {
  return request<{ token: string; phoneMasked: string; hasPhone: boolean; needManualPhone?: boolean; message?: string }>({
    url: '/api/wechat/mini/phone',
    method: 'POST',
    auth: true,
    data: { code }
  }).then((data) => {
    wx.setStorageSync('token', data.token);
    return data;
  });
}

export function submitManualPhone(phone: string) {
  return request<{ token: string; phoneMasked: string; hasPhone: boolean }>({
    url: '/api/wechat/mini/manual-phone',
    method: 'POST',
    auth: true,
    data: { phone }
  }).then((data) => {
    wx.setStorageSync('token', data.token);
    return data;
  });
}
