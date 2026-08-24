"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const enterprise_1 = require("../../api/enterprise");
Page({
    data: { packageItem: {} },
    async onLoad(options) {
        const id = options.id || '';
        if (!id) {
            wx.showToast({ title: '缺少套餐信息', icon: 'none' });
            return;
        }
        try {
            this.setData({ packageItem: await (0, enterprise_1.getEnterprisePackage)(id) });
        }
        catch (error) {
            wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
        }
    },
    apply() { if (this.data.packageItem.id)
        wx.navigateTo({ url: `/pages/package-apply/package-apply?id=${this.data.packageItem.id}` }); }
});
