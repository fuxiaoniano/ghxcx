"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const enterprise_1 = require("../../api/enterprise");
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function scheduleDays(schedules) {
    const groups = new Map();
    schedules.forEach((schedule) => {
        const date = schedule.date.slice(0, 10);
        const day = groups.get(date) || {
            date,
            dateLabel: date.slice(5).replace('-', '.'),
            weekday: WEEKDAYS[new Date(`${date}T00:00:00`).getDay()],
            morningId: '',
            morningAvailable: false,
            afternoonId: '',
            afternoonAvailable: false
        };
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
    data: { doctor: {}, scheduleDays: [], categoryId: '', loading: true },
    async onLoad(options) {
        const doctorId = options.id || '';
        if (!doctorId) {
            wx.showToast({ title: '缺少医生信息', icon: 'none' });
            return;
        }
        try {
            const doctor = await (0, enterprise_1.getEnterpriseDoctor)(doctorId);
            this.setData({ doctor, categoryId: options.categoryId || doctor.departmentId, scheduleDays: scheduleDays(doctor.schedules || []) });
        }
        catch (error) {
            wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
        }
        finally {
            this.setData({ loading: false });
        }
    },
    book() { if (this.data.doctor.id)
        wx.navigateTo({ url: `/pages/booking-form/booking-form?doctorId=${this.data.doctor.id}&categoryId=${this.data.categoryId}` }); },
    bookSchedule(event) {
        const scheduleId = String(event.currentTarget.dataset.id || '');
        if (!scheduleId || !this.data.doctor.id)
            return;
        wx.navigateTo({ url: `/pages/booking-form/booking-form?doctorId=${this.data.doctor.id}&categoryId=${this.data.categoryId}&scheduleId=${scheduleId}` });
    }
});
