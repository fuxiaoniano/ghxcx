"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const enterprise_1 = require("../../api/enterprise");
Page({ data: { packageItem: {} }, async onLoad(options) { if (!options.id)
        return; try {
        this.setData({ packageItem: await (0, enterprise_1.getEnterprisePackage)(options.id) });
    }
    catch (error) {
        wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
    } }, apply() { wx.navigateTo({ url: `/pages/package-apply/package-apply?id=${this.data.packageItem.id}` }); } });
