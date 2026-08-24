import { EnterpriseDoctor, EnterpriseSchedule, getEnterpriseDoctor } from '../../api/enterprise';

interface ScheduleDay {
  date: string;
  dateLabel: string;
  weekday: string;
  isToday: boolean;
  morningId: string;
  morningAvailable: boolean;
  afternoonId: string;
  afternoonAvailable: boolean;
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function scheduleDays(schedules: EnterpriseSchedule[]): ScheduleDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const groups = new Map<string, ScheduleDay>();
  for (let offset = 0; offset < 14; offset += 1) {
    const current = new Date(today);
    current.setDate(today.getDate() + offset);
    const date = localDate(current);
    groups.set(date, {
      date,
      dateLabel: `${current.getMonth() + 1}.${String(current.getDate()).padStart(2, '0')}`,
      weekday: WEEKDAYS[current.getDay()],
      isToday: offset === 0,
      morningId: '',
      morningAvailable: false,
      afternoonId: '',
      afternoonAvailable: false
    });
  }
  schedules.forEach((schedule) => {
    const date = schedule.date.slice(0, 10);
    const day = groups.get(date);
    if (!day) return;
    if (schedule.timeSlot === '上午') {
      day.morningId = schedule.id;
      day.morningAvailable = schedule.status === 'AVAILABLE';
    }
    if (schedule.timeSlot === '下午') {
      day.afternoonId = schedule.id;
      day.afternoonAvailable = schedule.status === 'AVAILABLE';
    }
    groups.set(date, day);
  });
  return [...groups.values()];
}

Page({
  data: { doctor: {} as EnterpriseDoctor, scheduleDays: [] as ScheduleDay[], categoryId: '', loading: true },

  async onLoad(options: Record<string, string | undefined>) {
    const doctorId = options.id || '';
    if (!doctorId) {
      wx.showToast({ title: '缺少医生信息', icon: 'none' });
      return;
    }
    try {
      const doctor = await getEnterpriseDoctor(doctorId);
      this.setData({ doctor, categoryId: options.categoryId || doctor.departmentId, scheduleDays: scheduleDays(doctor.schedules || []) });
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  book() {
    if (this.data.doctor.id) wx.navigateTo({ url: `/pages/booking-form/booking-form?doctorId=${this.data.doctor.id}&categoryId=${this.data.categoryId}` });
  },

  bookSchedule(event: WechatMiniprogram.TouchEvent) {
    const scheduleId = String(event.currentTarget.dataset.id || '');
    if (!scheduleId || !this.data.doctor.id) return;
    wx.navigateTo({
      url: `/pages/booking-form/booking-form?doctorId=${this.data.doctor.id}&categoryId=${this.data.categoryId}&scheduleId=${scheduleId}`
    });
  }
});
