"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const appointments_1 = require("../../api/appointments");
Page({
    data: {
        appointment: {}
    },
    async onLoad(options) {
        if (!options.id) {
            wx.showToast({ title: '缺少挂号编号', icon: 'none' });
            return;
        }
        try {
            const appointment = await (0, appointments_1.getMyAppointmentDetail)(options.id);
            this.setData({ appointment });
        }
        catch (error) {
            wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
        }
    },
    goMy() {
        wx.navigateTo({ url: '/pages/appointments/appointments' });
    },
    goHome() {
        wx.redirectTo({ url: '/pages/landing/landing' });
    }
});
