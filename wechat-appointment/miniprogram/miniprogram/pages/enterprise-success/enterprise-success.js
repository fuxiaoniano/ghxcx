"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
Page({ data: { appointment: {} }, onLoad() { this.setData({ appointment: (wx.getStorageSync('enterpriseAppointment') || {}) }); }, goRecords() { wx.switchTab({ url: '/pages/profile/profile' }); }, goHome() { wx.switchTab({ url: '/pages/home/home' }); } });
