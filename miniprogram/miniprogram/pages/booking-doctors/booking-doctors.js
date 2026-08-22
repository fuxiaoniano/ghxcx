"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const enterprise_1 = require("../../api/enterprise");
Page({ data: { categoryId: '', projectId: '', doctors: [] }, async onLoad(options) { const categoryId = options.categoryId || '', projectId = options.projectId || ''; this.setData({ categoryId, projectId }); try {
        this.setData({ doctors: await (0, enterprise_1.getEnterpriseDoctors)(categoryId) });
    }
    catch (error) {
        wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
    } }, select(event) { wx.navigateTo({ url: `/pages/booking-form/booking-form?doctorId=${event.currentTarget.dataset.id}&categoryId=${this.data.categoryId}&projectId=${this.data.projectId}` }); } });
