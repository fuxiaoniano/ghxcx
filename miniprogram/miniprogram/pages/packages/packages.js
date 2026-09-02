"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const enterprise_1 = require("../../api/enterprise");
Page({ data: { categories: [], packages: [], activeId: '', loading: true, refreshing: false }, onLoad() { this.load(); }, async refresh() { this.setData({ refreshing: true }); try {
        await this.load();
    }
    finally {
        this.setData({ refreshing: false });
    } }, async load() { try {
        const result = await (0, enterprise_1.getEnterprisePackages)(this.data.activeId);
        this.setData({ categories: result.categories, packages: result.packages, activeId: this.data.activeId || result.categories[0]?.id || '' });
        if (!this.data.activeId && result.categories[0]) {
            this.setData({ packages: (await (0, enterprise_1.getEnterprisePackages)(result.categories[0].id)).packages });
        }
    }
    catch (error) {
        wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
    }
    finally {
        this.setData({ loading: false });
    } }, selectCategory(event) { this.setData({ activeId: event.currentTarget.dataset.id }); this.load(); }, openDetail(event) { wx.navigateTo({ url: `/pages/package-detail/package-detail?id=${event.currentTarget.dataset.id}` }); } });
