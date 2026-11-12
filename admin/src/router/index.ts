import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { ElMessage } from 'element-plus';
import { ref } from 'vue';
import Login from '../views/Login.vue';
import Layout from '../views/Layout.vue';

const Dashboard = () => import('../views/Dashboard.vue');
const Users = () => import('../views/Users.vue');
const Appointments = () => import('../views/Appointments.vue');
const Notifications = () => import('../views/Notifications.vue');
const Configs = () => import('../views/Configs.vue');
const OfficialMenu = () => import('../views/OfficialMenu.vue');
const OfficialAutoReply = () => import('../views/OfficialAutoReply.vue');
const OfficialAccountBinding = () => import('../views/OfficialAccountBinding.vue');
const FollowupForward = () => import('../views/FollowupForward.vue');
const AdminUsers = () => import('../views/AdminUsers.vue');
const TeamManagement = () => import('../views/TeamManagement.vue');
const ChangePassword = () => import('../views/ChangePassword.vue');
const AuditLogs = () => import('../views/AuditLogs.vue');
const HomeManage = () => import('../views/HomeManage.vue');
const DoctorManage = () => import('../views/DoctorManage.vue');
const DepartmentManage = () => import('../views/DepartmentManage.vue');
const PackageManage = () => import('../views/PackageManage.vue');
const MediaLibrary = () => import('../views/MediaLibrary.vue');
const MiniProgramLinks = () => import('../views/MiniProgramLinks.vue');
const TencentAdLeads = () => import('../views/TencentAdLeads.vue');
const WebsiteSettings = () => import('../views/WebsiteSettings.vue');
const WebsiteCategories = () => import('../views/WebsiteCategories.vue');
const WebsiteArticles = () => import('../views/WebsiteArticles.vue');
const PromotionDashboard = () => import('../views/PromotionDashboard.vue');
const OperationsDaily = () => import('../views/OperationsDaily.vue');
const OperationsWeekly = () => import('../views/OperationsWeekly.vue');
const OperationsMonthly = () => import('../views/OperationsMonthly.vue');
const PromotionDataFilter = () => import('../views/PromotionDataFilter.vue');
const PromotionFieldSettings = () => import('../views/PromotionFieldSettings.vue');
const PromotionDailyReport = () => import('../views/PromotionDailyReport.vue');
const PromotionWeeklyReport = () => import('../views/PromotionWeeklyReport.vue');
const PromotionMonthlyReport = () => import('../views/PromotionMonthlyReport.vue');
const PromotionAccounts = () => import('../views/PromotionAccounts.vue');
const PromotionSyncSettings = () => import('../views/PromotionSyncSettings.vue');
const PromotionSalary = () => import('../views/PromotionSalary.vue');
const PromotionArrivalPatients = () => import('../views/PromotionArrivalPatients.vue');
const PromotionOperations = () => import('../views/PromotionOperations.vue');
const SmartMonitor = () => import('../views/SmartMonitor.vue');
const PromotionCreativeBatch = () => import('../views/PromotionCreativeBatch.vue');
const MultiAccountCreativeBatch = () => import('../views/MultiAccountCreativeBatch.vue');
const CreativeDefaultComponents = () => import('../views/CreativeDefaultComponents.vue');
const WebsiteAnalytics = () => import('../views/WebsiteAnalytics.vue');
const AdminRoles = () => import('../views/AdminRoles.vue');
const ConsultationForms = () => import('../views/ConsultationForms.vue');
const ConsultationReport = () => import('../views/ConsultationReport.vue');
const ConsultationCallbacks = () => import('../views/ConsultationCallbacks.vue');
const ConsultationSettings = () => import('../views/ConsultationSettings.vue');
const ConsultationSchedule = () => import('../views/ConsultationSchedule.vue');
const WechatGroupNotifications = () => import('../views/WechatGroupNotifications.vue');
const WechatGroupSenderSettings = () => import('../views/WechatGroupSenderSettings.vue');

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
        { path: 'users', component: Users, meta: { permission: 'BUSINESS_USERS' } },
        { path: 'appointments', component: Appointments, meta: { permission: 'BUSINESS_APPOINTMENTS' } },
        { path: 'tencent-ad-leads', component: TencentAdLeads, meta: { permission: 'BUSINESS_LEADS' } },
        { path: 'consultations', component: ConsultationForms, meta: { permission: 'CONSULTATION_VIEW' } },
        { path: 'consultations/channel-report', component: ConsultationReport, props: { mode: 'channel' }, meta: { permission: 'CONSULTATION_CHANNEL_REPORT' } },
        { path: 'consultations/report', component: ConsultationReport, props: { mode: 'daily' }, meta: { permission: 'CONSULTATION_TEAM_REPORT' } },
        { path: 'consultations/callbacks', component: ConsultationCallbacks, meta: { permission: 'CONSULTATION_VIEW' } },
        { path: 'consultations/settings', component: ConsultationSettings, meta: { permission: 'CONSULTATION_SETTINGS' } },
        { path: 'consultations/schedule', component: ConsultationSchedule, meta: { permission: 'CONSULTATION_SCHEDULE_VIEW' } },
        { path: 'operations/dashboard', component: PromotionDashboard, meta: { permission: 'PROMOTION_HOME' } },
        { path: 'operations/daily', component: OperationsDaily, meta: { permission: 'PROMOTION_DAILY' } },
        { path: 'operations/weekly', component: OperationsWeekly, meta: { permission: 'PROMOTION_WEEKLY' } },
        { path: 'operations/monthly', component: OperationsMonthly, meta: { permission: 'PROMOTION_MONTHLY' } },
        { path: 'operations/filter', component: PromotionDataFilter, meta: { permission: 'PROMOTION_FILTER' } },
        { path: 'operations/accounts', component: PromotionAccounts, meta: { permission: 'PROMOTION_ACCOUNTS' } },
        { path: 'operations/sync-settings', component: PromotionSyncSettings, meta: { permission: 'PROMOTION_SYNC' } },
        { path: 'operations/fields', component: PromotionFieldSettings, meta: { permission: 'PROMOTION_FIELDS' } },
        { path: 'operations/daily-report', component: PromotionDailyReport, meta: { permission: 'PROMOTION_DAILY_REPORT' } },
        { path: 'operations/weekly-report', component: PromotionWeeklyReport, meta: { permission: 'PROMOTION_WEEKLY_REPORT' } },
        { path: 'operations/monthly-report', component: PromotionMonthlyReport, meta: { permission: 'PROMOTION_MONTHLY_REPORT' } },
        { path: 'operations/salary', component: PromotionSalary, meta: { permission: 'PROMOTION_SALARY' } },
        { path: 'operations/arrival-patients', component: PromotionArrivalPatients, meta: { permission: 'PROMOTION_ARRIVAL_PATIENT_VIEW' } },
        { path: 'promotion-operations', redirect: '/promotion-operations/account-health' },
        { path: 'promotion-operations/account-analysis', redirect: '/promotion-operations/account-health' },
        { path: 'promotion-operations/account-health', component: PromotionOperations, meta: { permission: 'PROMOTION_OPERATIONS' } },
        { path: 'promotion-operations/material-analysis', component: PromotionOperations, meta: { permission: 'PROMOTION_OPERATIONS' } },
        { path: 'promotion/smart-monitor', component: SmartMonitor, meta: { permission: 'PROMOTION_SMART_MONITOR_VIEW' } },
        { path: 'promotion-operations/creative-batches', component: PromotionCreativeBatch, meta: { permission: 'PROMOTION_CREATIVE_BATCH_VIEW' } },
        { path: 'promotion/multi-account-creative-batch', component: MultiAccountCreativeBatch, meta: { permission: 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW' } },
        { path: 'promotion/creative-default-components', component: CreativeDefaultComponents, meta: { permission: 'PROMOTION_CREATIVE_DEFAULT_COMPONENT_VIEW' } },
        { path: 'notifications', component: Notifications, meta: { permission: 'BUSINESS_NOTIFICATIONS' } },
        { path: 'home-manage', component: HomeManage, meta: { permission: 'CONTENT_HOME' } },
        { path: 'doctor-manage', component: DoctorManage, meta: { permission: 'CONTENT_DOCTORS' } },
        { path: 'department-manage', component: DepartmentManage, meta: { permission: 'CONTENT_DEPARTMENTS' } },
        { path: 'package-manage', component: PackageManage, meta: { permission: 'CONTENT_PACKAGES' } },
        { path: 'media-library', component: MediaLibrary, meta: { permission: 'CONTENT_MEDIA' } },
        { path: 'mini-program-links', component: MiniProgramLinks, meta: { permission: 'CONTENT_LINKS' } },
        { path: 'website-manage', redirect: '/website-settings' },
        { path: 'website-settings', component: WebsiteSettings, meta: { permission: 'WEBSITE_SETTINGS' } },
        { path: 'website-categories', component: WebsiteCategories, meta: { permission: 'WEBSITE_CATEGORIES' } },
        { path: 'website-articles', component: WebsiteArticles, meta: { permission: 'WEBSITE_ARTICLES' } },
        { path: 'configs', component: Configs, meta: { permission: 'SYSTEM_CONFIGS' } },
        { path: 'wechat-group-notifications', component: WechatGroupNotifications, meta: { permission: 'WECHAT_GROUP_NOTIFY_VIEW' } },
        { path: 'wechat-group-notifications/sender', component: WechatGroupSenderSettings, meta: { permission: 'WECHAT_GROUP_NOTIFY_VIEW' } },
        { path: 'official-menu', component: OfficialMenu, meta: { permission: 'WECHAT_MENU' } },
        { path: 'official-auto-reply', component: OfficialAutoReply, meta: { permission: 'WECHAT_AUTO_REPLY' } },
        { path: 'official-binding', component: OfficialAccountBinding, meta: { permission: 'SYSTEM_OFFICIAL_BINDING' } },
        { path: 'appointment-notify', redirect: '/official-binding' },
        { path: 'followup-forward', component: FollowupForward, meta: { permission: 'SYSTEM_FOLLOWUP' } },
        { path: 'website-analytics', component: WebsiteAnalytics, meta: { permission: 'SYSTEM_WEBSITE_ANALYTICS' } },
        { path: 'admin-users', component: AdminUsers, meta: { permission: 'SYSTEM_MEMBERS' } },
        { path: 'admin-teams', component: TeamManagement, meta: { permission: 'SYSTEM_MEMBERS' } },
        { path: 'change-password', component: ChangePassword },
        { path: 'admin-roles', component: AdminRoles, meta: { permission: 'SYSTEM_ROLES' } },
        { path: 'audit-logs', component: AuditLogs, meta: { permission: 'SYSTEM_AUDIT' } }
      ]
    }
  ]
});

export const navigationPending = ref(false);

router.beforeEach((to, from) => {
  navigationPending.value = to.fullPath !== from.fullPath;
  const auth = useAuthStore();
  if (to.path !== '/login' && !auth.token) {
    return '/login';
  }
  if (to.path === '/login' && auth.token) {
    return '/dashboard';
  }
  if (to.path === '/official-binding' && auth.hasPermission('SYSTEM_APPOINTMENT_NOTIFY')) return true;
  const requiredPermission = String(to.meta.permission || '');
  if (requiredPermission && !auth.hasPermission(requiredPermission)) {
    return '/dashboard';
  }
  return true;
});

const routeLoadRetryKey = 'admin_route_load_retry';
router.onError((error, to) => {
  navigationPending.value = false;
  const message = error instanceof Error ? error.message : String(error);
  if (/dynamically imported module|importing a module script failed|failed to load module script/i.test(message)) {
    const retryPath = to.fullPath;
    let alreadyRetried = false;
    let canRememberRetry = true;
    try {
      alreadyRetried = sessionStorage.getItem(routeLoadRetryKey) === retryPath;
      if (!alreadyRetried) sessionStorage.setItem(routeLoadRetryKey, retryPath);
    } catch { canRememberRetry = false; }
    if (canRememberRetry && !alreadyRetried) {
      window.location.replace(retryPath);
      return;
    }
  }
  ElMessage.error('页面加载失败，请稍后重试');
});
router.afterEach((_to, _from, failure) => {
  navigationPending.value = false;
  if (!failure) {
    try { sessionStorage.removeItem(routeLoadRetryKey); } catch { /* 无存储权限 */ }
  }
});
