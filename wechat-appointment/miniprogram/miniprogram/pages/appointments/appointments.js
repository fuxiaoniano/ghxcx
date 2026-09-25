"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const appointments_1 = require("../../api/appointments");
const auth_1 = require("../../api/auth");
Page({
    data: {
        list: [],
        bindToken: ''
    },
    onLoad(options) {
        this.setData({ bindToken: options.bindToken || '' });
    },
    onShow() {
        this.load();
    },
    async load() {
        try {
            if (this.data.bindToken || !wx.getStorageSync('token')) {
                await (0, auth_1.miniLogin)(this.data.bindToken);
                if (this.data.bindToken) {
                    this.setData({ bindToken: '' });
                }
            }
            const list = await (0, appointments_1.getMyAppointments)();
            this.setData({ list });
        }
        catch (error) {
            wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
        }
    },
    openDetail(event) {
        const id = event.currentTarget.dataset.id;
        if (id) {
            wx.navigateTo({ url: `/pages/success/success?id=${id}` });
        }
    },
    goHome() {
        wx.redirectTo({ url: '/pages/landing/landing' });
    }
});
