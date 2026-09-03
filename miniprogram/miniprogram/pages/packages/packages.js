"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const enterprise_1 = require("../../api/enterprise");
const ALL_CATEGORY = { id: 'all', name: '全部' };
Page({ data: { categories: [ALL_CATEGORY], packages: [], activeId: 'all', loading: true, refreshing: false }, onLoad() { this.load(); }, async refresh() { this.setData({ refreshing: true }); try {
        await this.load();
    }
    finally {
        this.setData({ refreshing: false });
    } }, async load() { try {
        const categoryId = this.data.activeId === 'all' ? '' : this.data.activeId;
        const result = await (0, enterprise_1.getEnterprisePackages)(categoryId);
        this.setData({ categories: [ALL_CATEGORY, ...result.categories.filter((item) => item.id !== 'all')], packages: result.packages, activeId: this.data.activeId || 'all' });
    }
    catch (error) {
        wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
    }
    finally {
        this.setData({ loading: false });
    } }, selectCategory(event) { this.setData({ activeId: event.currentTarget.dataset.id }); this.load(); }, openDetail(event) { wx.navigateTo({ url: `/pages/package-detail/package-detail?id=${event.currentTarget.dataset.id}` }); } });
