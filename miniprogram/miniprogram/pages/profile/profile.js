"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("../../api/auth");
const enterprise_1 = require("../../api/enterprise");
Page({ data: { profile: { id: '', name: '', phoneMasked: '', hasPhone: false, subscribedOfficialAccount: false, officialAccountName: '' }, avatarText: '用', loading: true }, onShow() { this.load(); }, async load() { try {
        await (0, auth_1.miniLogin)();
        const profile = await (0, enterprise_1.getEnterpriseProfile)();
        this.setData({ profile, avatarText: (profile.name || '用').slice(0, 1) });
    }
    catch (error) {
        wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
    }
    finally {
        this.setData({ loading: false });
    } }, openLegacy() { wx.navigateTo({ url: '/pages/appointments/appointments' }); }, openDoctorRecords() { wx.navigateTo({ url: '/pages/records/records?type=DOCTOR_APPOINTMENT' }); }, openPackageRecords() { wx.navigateTo({ url: '/pages/records/records?type=PACKAGE_APPLICATION' }); }, openConsultRecords() { wx.navigateTo({ url: '/pages/records/records?mode=consultation' }); }, openAgreement(event) { wx.navigateTo({ url: `/pages/agreement/agreement?type=${event.currentTarget.dataset.type}` }); }, promptFollow() { wx.showModal({ title: '请先关注公众号', content: `请先关注${this.data.profile.officialAccountName || '医院公众号'}，关注后重新进入小程序即可使用在线咨询并接收服务通知。`, showCancel: false }); } });
