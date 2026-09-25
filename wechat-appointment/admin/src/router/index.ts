import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import Login from '../views/Login.vue';
import Layout from '../views/Layout.vue';
import Dashboard from '../views/Dashboard.vue';
import Users from '../views/Users.vue';
import Appointments from '../views/Appointments.vue';
import Notifications from '../views/Notifications.vue';
import Configs from '../views/Configs.vue';
import OfficialMenu from '../views/OfficialMenu.vue';
import OfficialAutoReply from '../views/OfficialAutoReply.vue';
import FollowupForward from '../views/FollowupForward.vue';
import AdminUsers from '../views/AdminUsers.vue';
import AuditLogs from '../views/AuditLogs.vue';
import HomeManage from '../views/HomeManage.vue';
import DoctorManage from '../views/DoctorManage.vue';
import DepartmentManage from '../views/DepartmentManage.vue';
import PackageManage from '../views/PackageManage.vue';
import MediaLibrary from '../views/MediaLibrary.vue';
import MiniProgramLinks from '../views/MiniProgramLinks.vue';
import TencentAdLeads from '../views/TencentAdLeads.vue';

const WebsiteSettings = () => import('../views/WebsiteSettings.vue');
const WebsitePages = () => import('../views/WebsitePages.vue');
const WebsiteArticles = () => import('../views/WebsiteArticles.vue');
const OperationsDaily = () => import('../views/OperationsDaily.vue');
const OperationsWeekly = () => import('../views/OperationsWeekly.vue');
const OperationsMonthly = () => import('../views/OperationsMonthly.vue');
const PromotionFieldSettings = () => import('../views/PromotionFieldSettings.vue');
const PromotionDailyReport = () => import('../views/PromotionDailyReport.vue');
const PromotionWeeklyReport = () => import('../views/PromotionWeeklyReport.vue');
const PromotionMonthlyReport = () => import('../views/PromotionMonthlyReport.vue');
const PromotionAccounts = () => import('../views/PromotionAccounts.vue');
const PromotionSyncSettings = () => import('../views/PromotionSyncSettings.vue');

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: Login },
    {
      path: '/',
      component: Layout,
      redirect: '/dashboard',
      children: [
        { path: 'dashboard', component: Dashboard },
        { path: 'users', component: Users },
        { path: 'appointments', component: Appointments },
        { path: 'tencent-ad-leads', component: TencentAdLeads },
        { path: 'operations/daily', component: OperationsDaily, meta: { permission: 'MANAGE_CONFIGS' } },
        { path: 'operations/weekly', component: OperationsWeekly, meta: { permission: 'MANAGE_CONFIGS' } },
        { path: 'operations/monthly', component: OperationsMonthly, meta: { permission: 'MANAGE_CONFIGS' } },
        { path: 'operations/accounts', component: PromotionAccounts, meta: { permission: 'MANAGE_CONFIGS' } },
        { path: 'operations/sync-settings', component: PromotionSyncSettings, meta: { permission: 'MANAGE_CONFIGS' } },
        { path: 'operations/fields', component: PromotionFieldSettings, meta: { permission: 'MANAGE_CONFIGS' } },
        { path: 'operations/daily-report', component: PromotionDailyReport, meta: { permission: 'MANAGE_CONFIGS' } },
        { path: 'operations/weekly-report', component: PromotionWeeklyReport, meta: { permission: 'MANAGE_CONFIGS' } },
        { path: 'operations/monthly-report', component: PromotionMonthlyReport, meta: { permission: 'MANAGE_CONFIGS' } },
        { path: 'notifications', component: Notifications },
        { path: 'home-manage', component: HomeManage, meta: { permission: 'HOME_MANAGE' } },
        { path: 'doctor-manage', component: DoctorManage, meta: { permission: 'DOCTOR_MANAGE' } },
        { path: 'department-manage', component: DepartmentManage, meta: { permission: 'DOCTOR_MANAGE' } },
        { path: 'package-manage', component: PackageManage, meta: { permission: 'PACKAGE_MANAGE' } },
        { path: 'media-library', component: MediaLibrary },
        { path: 'mini-program-links', component: MiniProgramLinks },
        { path: 'website-manage', redirect: '/website-settings' },
        { path: 'website-settings', component: WebsiteSettings, meta: { permission: 'WEBSITE_MANAGE' } },
        { path: 'website-pages', component: WebsitePages, meta: { permission: 'WEBSITE_MANAGE' } },
        { path: 'website-articles', component: WebsiteArticles, meta: { permission: 'WEBSITE_MANAGE' } },
        { path: 'configs', component: Configs },
        { path: 'official-menu', component: OfficialMenu },
        { path: 'official-auto-reply', component: OfficialAutoReply },
        { path: 'appointment-notify', redirect: '/admin-users' },
        { path: 'followup-forward', component: FollowupForward },
        { path: 'admin-users', component: AdminUsers },
        { path: 'audit-logs', component: AuditLogs }
      ]
    }
  ]
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.path !== '/login' && !auth.token) {
    return '/login';
  }
  if (to.path === '/login' && auth.token) {
    return '/dashboard';
  }
  const requiredPermission = String(to.meta.permission || '');
  if (requiredPermission && !auth.hasPermission(requiredPermission)) {
    return '/dashboard';
  }
  return true;
});
