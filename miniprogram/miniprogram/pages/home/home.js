"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const enterprise_1 = require("../../api/enterprise");
/** 后台尚未配置或接口短暂不可用时，仍展示企业首页和真实轮播图片。 */
const DEFAULT_HOME = {
    config: {
        hospitalName: '重庆种博士口腔',
        slogan: '专业口腔诊疗服务',
        logo: '',
        customerServicePath: '',
    },
    banners: [
        {
            id: 'default-banner-1',
            imageUrl: '/assets/home-banner-default-1.jpg',
            title: '重庆种博士口腔',
            linkType: 'PAGE',
            linkValue: '/pages/booking/booking',
        },
        {
            id: 'default-banner-2',
            imageUrl: '/assets/home-banner-default-2.jpg',
            title: '数字化精准诊疗',
            linkType: 'PAGE',
            linkValue: '/pages/doctors/doctors',
        },
    ],
    ads: [],
    categories: [],
    doctors: [],
};
function normalizeHome(home) {
    return {
        ...home,
        config: {
            ...DEFAULT_HOME.config,
            ...home.config,
            hospitalName: home.config.hospitalName || DEFAULT_HOME.config.hospitalName,
            slogan: home.config.slogan || DEFAULT_HOME.config.slogan,
        },
        // 后台存在启用轮播时完全以后台数据为准，否则使用本地安全兜底。
        banners: home.banners.length ? home.banners : DEFAULT_HOME.banners,
    };
}
Page({
    data: { loading: true, home: DEFAULT_HOME },
    onLoad() { this.load(); }, onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
    async load() { try {
        this.setData({ loading: true });
        this.setData({ home: normalizeHome(await (0, enterprise_1.getEnterpriseHome)()) });
    }
    catch {
        wx.showToast({ title: '部分内容暂未加载', icon: 'none' });
    }
    finally {
        this.setData({ loading: false });
    } },
    openCategory(event) { wx.setStorageSync('bookingPreset', { categoryId: event.currentTarget.dataset.id }); wx.switchTab({ url: '/pages/booking/booking' }); },
    openDoctor(event) { wx.navigateTo({ url: `/pages/doctor-detail/doctor-detail?id=${event.currentTarget.dataset.id}` }); },
    bookDoctor(event) { wx.navigateTo({ url: `/pages/booking-form/booking-form?doctorId=${event.currentTarget.dataset.id}` }); },
    openBanner(event) { const item = this.data.home.banners[Number(event.currentTarget.dataset.index)]; if (!item?.linkValue)
        return; if (item.linkType === 'PAGE') {
        const tabs = ['/pages/home/home', '/pages/doctors/doctors', '/pages/booking/booking', '/pages/packages/packages', '/pages/profile/profile'];
        tabs.includes(item.linkValue) ? wx.switchTab({ url: item.linkValue }) : wx.navigateTo({ url: item.linkValue });
    } },
    goBooking() { wx.switchTab({ url: '/pages/booking/booking' }); }, goDoctors() { wx.switchTab({ url: '/pages/doctors/doctors' }); }
});
