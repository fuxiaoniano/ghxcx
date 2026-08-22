"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("../../api/auth");
const enterprise_1 = require("../../api/enterprise");
Page({
    data: { doctor: {}, loading: true, subscribedOfficialAccount: false, officialAccountName: '重庆种博士口腔' },
    async onLoad(options) {
        const doctorId = options.id || '';
        if (!doctorId) {
            wx.showToast({ title: '缺少医生信息', icon: 'none' });
            return;
        }
        void this.loadConsultState();
        try {
            this.setData({ doctor: await (0, enterprise_1.getEnterpriseDoctor)(doctorId) });
        }
        catch (error) {
            wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
        }
        finally {
            this.setData({ loading: false });
        }
    },
    /** 咨询入口复用现有登录用户的公众号关注状态。 */
    async loadConsultState() {
        try {
            await (0, auth_1.miniLogin)();
            const profile = await (0, enterprise_1.getEnterpriseProfile)();
            this.setData({ subscribedOfficialAccount: profile.subscribedOfficialAccount, officialAccountName: profile.officialAccountName || '重庆种博士口腔' });
        }
        catch {
            this.setData({ subscribedOfficialAccount: false });
        }
    },
    book() { if (this.data.doctor.id)
        wx.navigateTo({ url: `/pages/booking-form/booking-form?doctorId=${this.data.doctor.id}` }); },
    openOfficialFollow() { const name = encodeURIComponent(this.data.officialAccountName); wx.navigateTo({ url: `/pages/official-follow/official-follow?name=${name}` }); }
});
