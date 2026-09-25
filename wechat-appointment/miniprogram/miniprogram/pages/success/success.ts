import { getMyAppointmentDetail } from '../../api/appointments';
import { Appointment } from '../../api/types';

Page({
  data: {
    appointment: {} as Appointment
  },

  async onLoad(options: Record<string, string | undefined>) {
    if (!options.id) {
      wx.showToast({ title: '缺少挂号编号', icon: 'none' });
      return;
    }
    try {
      const appointment = await getMyAppointmentDetail(options.id);
      this.setData({ appointment });
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
    }
  },

  goMy() {
    wx.navigateTo({ url: '/pages/appointments/appointments' });
  },

  goHome() {
    wx.redirectTo({ url: '/pages/landing/landing' });
  }
});
