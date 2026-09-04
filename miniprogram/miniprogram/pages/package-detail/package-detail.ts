import { EnterprisePackage, getEnterprisePackage } from '../../api/enterprise';

Page({
  data: { packageItem: {} as EnterprisePackage },
  async onLoad(options: Record<string, string | undefined>) {
    wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
    const id = options.id || '';
    if (!id) {
      wx.showToast({ title: '缺少套餐信息', icon: 'none' });
      return;
    }
    try {
      this.setData({ packageItem: await getEnterprisePackage(id) });
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
    }
  },
  apply() {
    if (this.data.packageItem.id) wx.navigateTo({ url: `/pages/package-apply/package-apply?id=${this.data.packageItem.id}` });
  },
  onShareAppMessage() {
    return {
      title: this.data.packageItem.title || '口腔套餐',
      path: `/pages/package-detail/package-detail?id=${encodeURIComponent(this.data.packageItem.id || '')}&source=share`,
      imageUrl: this.data.packageItem.cover || undefined
    };
  },
  onShareTimeline() {
    return {
      title: this.data.packageItem.title || '口腔套餐',
      query: `id=${encodeURIComponent(this.data.packageItem.id || '')}`,
      imageUrl: this.data.packageItem.cover || undefined
    };
  }
});
