"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const enterprise_1 = require("../../api/enterprise");
const ALL_CATEGORY = { id: 'all', name: '全部', icon: '/assets/category-all.svg' };
const TAB_PAGES = ['/pages/home/home', '/pages/doctors/doctors', '/pages/booking/booking', '/pages/packages/packages', '/pages/profile/profile'];
const CATEGORY_ICON_BY_NAME = {
    '口腔正畸': '/assets/category-orthodontics.svg',
    '口腔修复': '/assets/category-restoration.svg',
    '口腔种植': '/assets/category-implant.svg',
    '儿童口腔': '/assets/category-child.svg',
    '牙周病': '/assets/category-periodontal.svg',
    '牙体牙髓': '/assets/category-pulp.svg',
    '口腔黏膜': '/assets/category-mucosa.svg',
    '预防保健': '/assets/category-prevention.svg',
    '颌面外科': '/assets/category-surgery.svg',
    '全部': '/assets/category-all.svg',
};
/** 后台暂不可用时的诊疗项目兜底，保持参考图的两行五列完整布局。 */
const DEFAULT_CATEGORIES = [
    { id: 'default-orthodontics', name: '口腔正畸', icon: '/assets/category-orthodontics.svg' },
    { id: 'default-restoration', name: '口腔修复', icon: '/assets/category-restoration.svg' },
    { id: 'default-implant', name: '口腔种植', icon: '/assets/category-implant.svg' },
    { id: 'default-child', name: '儿童口腔', icon: '/assets/category-child.svg' },
    { id: 'default-periodontal', name: '牙周病', icon: '/assets/category-periodontal.svg' },
    { id: 'default-pulp', name: '牙体牙髓', icon: '/assets/category-pulp.svg' },
    { id: 'default-mucosa', name: '口腔黏膜', icon: '/assets/category-mucosa.svg' },
    { id: 'default-prevention', name: '预防保健', icon: '/assets/category-prevention.svg' },
    { id: 'default-surgery', name: '颌面外科', icon: '/assets/category-surgery.svg' },
    ALL_CATEGORY,
];
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
    ads: [
        {
            id: 'default-ad-1',
            imageUrl: '/assets/home-ad-default-1.jpg',
            title: '舒适化种植诊疗',
            linkType: 'PAGE',
            linkValue: '/pages/booking/booking',
        },
        {
            id: 'default-ad-2',
            imageUrl: '/assets/home-ad-default-2.jpg',
            title: '数字化正畸诊疗',
            linkType: 'PAGE',
            linkValue: '/pages/packages/packages',
        },
    ],
    categories: DEFAULT_CATEGORIES,
    doctors: [],
};
function normalizeHome(home) {
    const categories = home.categories.length
        ? [...home.categories.map((item) => ({ ...item, icon: item.icon || CATEGORY_ICON_BY_NAME[item.name] || '' })), ...(home.categories.some((item) => item.id === 'all' || item.name === '全部') ? [] : [ALL_CATEGORY])]
        : [];
    return {
        ...home,
        config: {
            ...DEFAULT_HOME.config,
            ...home.config,
            hospitalName: home.config.hospitalName || DEFAULT_HOME.config.hospitalName,
            slogan: home.config.slogan || DEFAULT_HOME.config.slogan,
        },
        // 接口成功后完全尊重后台启用状态；本地默认内容只用于接口失败时兜底。
        banners: home.banners,
        ads: home.ads,
        categories,
    };
}
function openConfiguredPage(item) {
    if (item?.linkType !== 'PAGE')
        return;
    const value = String(item.linkValue || '').trim();
    if (!value)
        return;
    const url = value.startsWith('/') ? value : `/${value}`;
    const pagePath = url.split('?')[0];
    const fail = () => wx.showToast({ title: '跳转页面暂不可用', icon: 'none' });
    TAB_PAGES.includes(pagePath) ? wx.switchTab({ url: pagePath, fail }) : wx.navigateTo({ url, fail });
}
Page({
    data: { loading: true, home: DEFAULT_HOME },
    onLoad() { wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] }); this.load(); }, onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
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
    openCategory(event) { const categoryId = event.currentTarget.dataset.id; if (categoryId === 'all') {
        wx.removeStorageSync('bookingPreset');
    }
    else {
        wx.setStorageSync('bookingPreset', { categoryId });
    } wx.switchTab({ url: '/pages/booking/booking' }); },
    openDoctor(event) { wx.navigateTo({ url: `/pages/doctor-detail/doctor-detail?id=${event.currentTarget.dataset.id}` }); },
    bookDoctor(event) { wx.navigateTo({ url: `/pages/booking-form/booking-form?doctorId=${event.currentTarget.dataset.id}` }); },
    openBanner(event) { openConfiguredPage(this.data.home.banners[Number(event.currentTarget.dataset.index)]); },
    openAd(event) { openConfiguredPage(this.data.home.ads[Number(event.currentTarget.dataset.index)]); },
    goBooking() { wx.switchTab({ url: '/pages/booking/booking' }); }, goDoctors() { wx.switchTab({ url: '/pages/doctors/doctors' }); },
    onShareAppMessage() { return { title: this.data.home.config.hospitalName || '口腔医疗服务', path: '/pages/home/home?source=share' }; },
    onShareTimeline() { return { title: this.data.home.config.hospitalName || '口腔医疗服务' }; }
});
