"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const enterprise_1 = require("../../api/enterprise");
Page({ data: { doctor: {}, loading: true }, async onLoad(options) { if (!options.id)
        return; try {
        this.setData({ doctor: await (0, enterprise_1.getEnterpriseDoctor)(options.id) });
    }
    catch (error) {
        wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
    }
    finally {
        this.setData({ loading: false });
    } }, book() { wx.navigateTo({ url: `/pages/booking-form/booking-form?doctorId=${this.data.doctor.id}` }); }, promptFollow() { wx.showModal({ title: '关注公众号', content: '请先关注医院公众号，关注后可使用在线咨询和接收服务通知。', showCancel: false }); } });
