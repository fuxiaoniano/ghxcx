import { EnterpriseCategory, EnterprisePackage, getEnterprisePackages } from '../../api/enterprise';

const ALL_CATEGORY: EnterpriseCategory = { id: 'all', name: '全部' };

Page({
  data: {
    categories: [ALL_CATEGORY] as EnterpriseCategory[],
    packages: [] as EnterprisePackage[],
    activeId: 'all',
    loading: true,
    refreshing: false
  },
  onLoad() {
    wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
    this.load();
  },
  async refresh() {
    this.setData({ refreshing: true });
    try {
      await this.load();
    } finally {
      this.setData({ refreshing: false });
    }
  },
  async load() {
    try {
      const categoryId = this.data.activeId === 'all' ? '' : this.data.activeId;
      const result = await getEnterprisePackages(categoryId);
      this.setData({
        categories: [ALL_CATEGORY, ...result.categories.filter((item) => item.id !== 'all')],
        packages: result.packages,
        activeId: this.data.activeId || 'all'
      });
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
  selectCategory(event: WechatMiniprogram.TouchEvent) {
    this.setData({ activeId: event.currentTarget.dataset.id });
    this.load();
  },
  openDetail(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/pages/package-detail/package-detail?id=${event.currentTarget.dataset.id}` });
  },
  onShareAppMessage() {
    return { title: '推荐套餐', path: '/pages/packages/packages?source=share' };
  },
  onShareTimeline() {
    return { title: '推荐套餐' };
  }
});
