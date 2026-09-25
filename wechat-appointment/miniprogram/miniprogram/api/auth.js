"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.miniLogin = miniLogin;
exports.authorizePhone = authorizePhone;
exports.submitManualPhone = submitManualPhone;
const request_1 = require("./request");
function miniLogin(bindToken) {
    return new Promise((resolve, reject) => {
        wx.login({
            success(result) {
                (0, request_1.request)({
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
function authorizePhone(code) {
    return (0, request_1.request)({
        url: '/api/wechat/mini/phone',
        method: 'POST',
        auth: true,
        data: { code }
    }).then((data) => {
        wx.setStorageSync('token', data.token);
        return data;
    });
}
function submitManualPhone(phone) {
    return (0, request_1.request)({
        url: '/api/wechat/mini/manual-phone',
        method: 'POST',
        auth: true,
        data: { phone }
    }).then((data) => {
        wx.setStorageSync('token', data.token);
        return data;
    });
}
