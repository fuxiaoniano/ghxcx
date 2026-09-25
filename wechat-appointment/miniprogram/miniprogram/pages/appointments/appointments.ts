import { getMyAppointments } from '../../api/appointments';
import { miniLogin } from '../../api/auth';
import { Appointment } from '../../api/types';

Page({
  data: {
    list: [] as Appointment[],
    bindToken: ''
  },

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ bindToken: options.bindToken || '' });
  },

  onShow() {
    this.load();
  },

  async load() {
    try {
      if (this.data.bindToken || !wx.getStorageSync('token')) {
        await miniLogin(this.data.bindToken);
        if (this.data.bindToken) {
          this.setData({ bindToken: '' });
        }
      }
      const list = await getMyAppointments();
      this.setData({ list });
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
    }
  },

  openDetail(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({ url: `/pages/success/success?id=${id}` });
    }
  },

  goHome() {
    wx.redirectTo({ url: '/pages/landing/landing' });
  }
});
