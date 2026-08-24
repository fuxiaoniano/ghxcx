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
        { path: 'notifications', component: Notifications },
        { path: 'home-manage', component: HomeManage, meta: { permission: 'HOME_MANAGE' } },
        { path: 'doctor-manage', component: DoctorManage, meta: { permission: 'DOCTOR_MANAGE' } },
        { path: 'department-manage', component: DepartmentManage, meta: { permission: 'DOCTOR_MANAGE' } },
        { path: 'package-manage', component: PackageManage, meta: { permission: 'PACKAGE_MANAGE' } },
        { path: 'media-library', component: MediaLibrary },
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
