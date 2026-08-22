"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("../../api/auth");
const enterprise_1 = require("../../api/enterprise");
Page({
    data: { packageItem: {}, subscribedOfficialAccount: false, officialAccountName: '重庆种博士口腔' },
    async onLoad(options) { const id = options.id || ''; if (!id) {
        wx.showToast({ title: '缺少套餐信息', icon: 'none' });
        return;
    } void this.loadConsultState(); try {
        this.setData({ packageItem: await (0, enterprise_1.getEnterprisePackage)(id) });
    }
    catch (error) {
        wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
    } },
    /** 客服入口与个人中心共用公众号关注判断。 */
    async loadConsultState() { try {
        await (0, auth_1.miniLogin)();
        const profile = await (0, enterprise_1.getEnterpriseProfile)();
        this.setData({ subscribedOfficialAccount: profile.subscribedOfficialAccount, officialAccountName: profile.officialAccountName || '重庆种博士口腔' });
    }
    catch {
        this.setData({ subscribedOfficialAccount: false });
    } },
    openOfficialFollow() { const name = encodeURIComponent(this.data.officialAccountName); wx.navigateTo({ url: `/pages/official-follow/official-follow?name=${name}` }); },
    apply() { if (this.data.packageItem.id)
        wx.navigateTo({ url: `/pages/package-apply/package-apply?id=${this.data.packageItem.id}` }); }
});
