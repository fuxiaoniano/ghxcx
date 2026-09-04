"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const enterprise_1 = require("../../api/enterprise");
Page({
    data: {
        categories: [],
        activeId: '',
        activeCategory: null,
        loading: true
    },
    onLoad() {
        wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
    },
    onShow() {
        this.load();
    },
    async load() {
        try {
            const categories = await (0, enterprise_1.getEnterpriseCategories)();
            const preset = wx.getStorageSync('bookingPreset') || {};
            wx.removeStorageSync('bookingPreset');
            const activeId = preset.categoryId || this.data.activeId || categories[0]?.id || '';
            this.setData({
                categories,
                activeId,
                activeCategory: categories.find((item) => item.id === activeId) || categories[0] || null
            });
        }
        catch (error) {
            wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
        }
        finally {
            this.setData({ loading: false });
        }
    },
    selectCategory(event) {
        const activeId = event.currentTarget.dataset.id;
        this.setData({ activeId, activeCategory: this.data.categories.find((item) => item.id === activeId) || null });
    },
    selectProject(event) {
        wx.navigateTo({ url: `/pages/booking-doctors/booking-doctors?categoryId=${this.data.activeId}&projectId=${event.currentTarget.dataset.id}` });
    },
    onShareAppMessage() {
        return { title: '预约挂号', path: '/pages/booking/booking?source=share' };
    },
    onShareTimeline() {
        return { title: '预约挂号' };
    }
});
