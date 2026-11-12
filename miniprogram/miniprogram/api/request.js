"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.request = request;
const config_1 = require("../utils/config");
function request(options) {
    return new Promise((resolve, reject) => {
        const token = wx.getStorageSync('token');
        wx.request({
            url: `${config_1.API_BASE_URL}${options.url}`,
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
                    reject(new Error('小程序服务器域名未配置，请在微信小程序后台 request 合法域名添加：https://wechat.fuxiaonian.net'));
                    return;
                }
                reject(new Error(message));
            }
        });
    });
}
