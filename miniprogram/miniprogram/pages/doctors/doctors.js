"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const enterprise_1 = require("../../api/enterprise");
Page({ data: { categories: [], doctors: [], departmentId: '', loading: true }, onLoad() { this.load(); }, onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); }, async load() { try {
        const [categories, doctors] = await Promise.all([(0, enterprise_1.getEnterpriseCategories)(), (0, enterprise_1.getEnterpriseDoctors)(this.data.departmentId)]);
        this.setData({ categories, doctors });
    }
    catch (error) {
        wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
    }
    finally {
        this.setData({ loading: false });
    } }, selectDepartment(event) { this.setData({ departmentId: event.currentTarget.dataset.id || '' }); this.load(); }, openDetail(event) { wx.navigateTo({ url: `/pages/doctor-detail/doctor-detail?id=${event.currentTarget.dataset.id}` }); }, book(event) { wx.navigateTo({ url: `/pages/booking-form/booking-form?doctorId=${event.currentTarget.dataset.id}` }); } });
