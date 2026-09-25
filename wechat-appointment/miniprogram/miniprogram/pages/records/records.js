"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("../../api/auth");
const enterprise_1 = require("../../api/enterprise");
Page({ data: { title: '我的记录', records: [], mode: '' }, async onLoad(options) { const mode = options.mode || ''; const type = options.type || ''; const title = mode === 'consultation' ? '问诊记录' : type === 'PACKAGE_APPLICATION' ? '套餐申请记录' : '医生预约记录'; wx.setNavigationBarTitle({ title }); this.setData({ title, mode }); if (mode === 'consultation')
        return; try {
        await (0, auth_1.miniLogin)();
        this.setData({ records: await (0, enterprise_1.getEnterpriseRecords)(type) });
    }
    catch (error) {
        wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
    } } });
