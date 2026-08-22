"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("../../api/auth");
const enterprise_1 = require("../../api/enterprise");
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
Page({ data: { packageItem: {}, name: '', date: '', today, hasPhone: false, phoneMasked: '', manualPhone: '', privacyAccepted: false, submitting: false }, async onLoad(options) { const id = options.id || ''; if (!id) {
        wx.showToast({ title: '缺少套餐信息', icon: 'none' });
        return;
    } try {
        const login = await (0, auth_1.miniLogin)();
        const packageItem = await (0, enterprise_1.getEnterprisePackage)(id);
        this.setData({ packageItem, hasPhone: login.hasPhone, phoneMasked: login.phoneMasked || '' });
    }
    catch (error) {
        wx.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
    } }, onName(event) { this.setData({ name: event.detail.value }); }, onDate(event) { this.setData({ date: String(event.detail.value) }); }, togglePrivacy() { this.setData({ privacyAccepted: !this.data.privacyAccepted }); }, onManualPhone(event) { this.setData({ manualPhone: String(event.detail.value).replace(/\D/g, '').slice(0, 11) }); }, async saveManualPhone() { if (!/^1\d{10}$/.test(this.data.manualPhone))
        return wx.showToast({ title: '请输入 11 位手机号', icon: 'none' }); try {
        const result = await (0, auth_1.submitManualPhone)(this.data.manualPhone);
        this.setData({ hasPhone: true, phoneMasked: result.phoneMasked });
    }
    catch (error) {
        wx.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' });
    } }, async getPhone(event) { if (!event.detail.code)
        return wx.showToast({ title: '您暂未授权手机号', icon: 'none' }); try {
        const result = await (0, auth_1.authorizePhone)(event.detail.code);
        this.setData({ hasPhone: result.hasPhone, phoneMasked: result.phoneMasked });
    }
    catch (error) {
        wx.showToast({ title: error instanceof Error ? error.message : '授权失败', icon: 'none' });
    } }, async submit() { if (!this.data.packageItem.id)
        return wx.showToast({ title: '套餐信息未加载完成', icon: 'none' }); if (!this.data.date)
        return wx.showToast({ title: '请选择预约日期', icon: 'none' }); if (!this.data.hasPhone)
        return wx.showToast({ title: '请先绑定联系电话', icon: 'none' }); if (!this.data.privacyAccepted)
        return wx.showToast({ title: '请先同意隐私协议', icon: 'none' }); if (this.data.submitting)
        return; this.setData({ submitting: true }); try {
        const appointment = await (0, enterprise_1.createPackageApplication)({ packageId: this.data.packageItem.id, appointmentDate: this.data.date, name: this.data.name.trim(), privacyAccepted: true, source: 'enterprise_package_mini' });
        wx.setStorageSync('enterpriseAppointment', appointment);
        wx.redirectTo({ url: '/pages/enterprise-success/enterprise-success' });
    }
    catch (error) {
        wx.showToast({ title: error instanceof Error ? error.message : '提交失败', icon: 'none' });
    }
    finally {
        this.setData({ submitting: false });
    } } });
