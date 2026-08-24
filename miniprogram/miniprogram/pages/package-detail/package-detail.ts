import { EnterprisePackage, getEnterprisePackage } from '../../api/enterprise';

Page({
  data: { packageItem: {} as EnterprisePackage },
  async onLoad(options: Record<string, string | undefined>) {
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
  }
});
