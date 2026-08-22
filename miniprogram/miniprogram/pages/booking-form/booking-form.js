"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("../../api/auth");
const enterprise_1 = require("../../api/enterprise");
Page({
    data: { doctor: {}, categories: [], projects: [], projectIndex: 0, categoryId: '', projectId: '', scheduleIndex: 0, scheduleLabels: [], hasPhone: false, phoneMasked: '', manualPhone: '', privacyAccepted: false, submitting: false, form: { name: '', gender: '', symptomDescription: '' } },
    async onLoad(options) { try {
        const login = await (0, auth_1.miniLogin)();
        const [loadedDoctor, categories] = await Promise.all([(0, enterprise_1.getEnterpriseDoctor)(options.doctorId || ''), (0, enterprise_1.getEnterpriseCategories)()]);
        const categoryId = options.categoryId || loadedDoctor.departmentId;
        const category = categories.find(item => item.id === categoryId);
        const projects = category?.projects || [];
        const projectId = options.projectId || projects[0]?.id || '';
        const projectIndex = Math.max(0, projects.findIndex(item => item.id === projectId));
        const schedules = (loadedDoctor.schedules || []).filter(item => item.status === 'AVAILABLE' && item.bookedCount < item.capacity);
        const doctor = { ...loadedDoctor, schedules };
        this.setData({ doctor, categories, projects, projectIndex, categoryId, projectId, hasPhone: login.hasPhone, phoneMasked: login.phoneMasked || '', scheduleLabels: schedules.map(item => `${item.date.slice(0, 10)} ${item.timeSlot}`) });
    }
    catch (error) {
        wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
    } },
    onName(event) { this.setData({ 'form.name': event.detail.value }); }, onGender(event) { this.setData({ 'form.gender': event.detail.value }); }, onSymptom(event) { this.setData({ 'form.symptomDescription': event.detail.value }); }, onSchedule(event) { this.setData({ scheduleIndex: Number(event.detail.value) }); }, onProject(event) { const projectIndex = Number(event.detail.value); this.setData({ projectIndex, projectId: this.data.projects[projectIndex]?.id || '' }); }, togglePrivacy() { this.setData({ privacyAccepted: !this.data.privacyAccepted }); }, onManualPhone(event) { this.setData({ manualPhone: String(event.detail.value).replace(/\D/g, '').slice(0, 11) }); },
    async saveManualPhone() { try {
        const result = await (0, auth_1.submitManualPhone)(this.data.manualPhone);
        this.setData({ hasPhone: true, phoneMasked: result.phoneMasked });
    }
    catch (error) {
        wx.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' });
    } }, async getPhone(event) { if (!event.detail.code)
        return; try {
        const result = await (0, auth_1.authorizePhone)(event.detail.code);
        this.setData({ hasPhone: result.hasPhone, phoneMasked: result.phoneMasked });
    }
    catch (error) {
        wx.showToast({ title: error instanceof Error ? error.message : '授权失败', icon: 'none' });
    } },
    async submit() { const schedule = this.data.doctor.schedules?.[this.data.scheduleIndex]; if (!schedule)
        return wx.showToast({ title: '请选择可预约出诊时段', icon: 'none' }); if (!this.data.projectId)
        return wx.showToast({ title: '该科室暂无预约项目', icon: 'none' }); if (!this.data.hasPhone)
        return wx.showToast({ title: '请先授权或填写联系电话', icon: 'none' }); if (!this.data.form.symptomDescription.trim())
        return wx.showToast({ title: '请填写症状描述', icon: 'none' }); if (!this.data.privacyAccepted)
        return wx.showToast({ title: '请先同意隐私协议', icon: 'none' }); if (this.data.submitting)
        return; this.setData({ submitting: true }); try {
        const appointment = await (0, enterprise_1.createDoctorAppointment)({ doctorId: this.data.doctor.id, dentalCategoryId: this.data.categoryId, dentalProjectId: this.data.projectId, appointmentDate: schedule.date.slice(0, 10), appointmentTime: schedule.timeSlot, name: this.data.form.name.trim(), gender: this.data.form.gender.trim(), symptomDescription: this.data.form.symptomDescription.trim(), privacyAccepted: true, source: 'enterprise_mini_program' });
        wx.setStorageSync('enterpriseAppointment', appointment);
        wx.redirectTo({ url: '/pages/enterprise-success/enterprise-success' });
    }
    catch (error) {
        wx.showToast({ title: error instanceof Error ? error.message : '提交失败', icon: 'none' });
    }
    finally {
        this.setData({ submitting: false });
    } }
});
