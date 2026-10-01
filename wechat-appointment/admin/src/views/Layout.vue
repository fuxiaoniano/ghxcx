<template>
  <el-container class="layout" :class="{ 'is-collapsed': sidebarCollapsed, 'mobile-nav-open': mobileNavigationOpen }">
    <el-aside :width="isMobile ? '232px' : (sidebarCollapsed ? '76px' : '232px')" class="aside">
      <div class="brand">
        <div class="brand-mark">管</div>
        <div v-show="!sidebarCollapsed || isMobile" class="brand-copy">
          <strong>傅小念的运营管理后台</strong>
          <span>预约管理中心</span>
        </div>
      </div>

      <nav class="navigation" aria-label="后台主导航">
        <el-menu router :default-active="$route.path" :collapse="isMobile ? false : sidebarCollapsed" :collapse-transition="false" @select="closeMobileNavigation">
          <el-menu-item index="/dashboard"><el-icon><DataLine /></el-icon><template #title>仪表盘</template></el-menu-item>
          <el-sub-menu v-if="['BUSINESS_LEADS','BUSINESS_APPOINTMENTS','BUSINESS_USERS','BUSINESS_NOTIFICATIONS'].some(canAccess)" index="business"><template #title><el-icon><Tickets /></el-icon><span>业务管理</span></template><el-menu-item v-if="canAccess('BUSINESS_LEADS')" index="/tencent-ad-leads">腾讯广告线索</el-menu-item><el-menu-item v-if="canAccess('BUSINESS_APPOINTMENTS')" index="/appointments">挂号管理</el-menu-item><el-menu-item v-if="canAccess('BUSINESS_USERS')" index="/users">用户管理</el-menu-item><el-menu-item v-if="canAccess('BUSINESS_NOTIFICATIONS')" index="/notifications">通知记录</el-menu-item></el-sub-menu>
          <el-sub-menu v-if="canAccess('CONSULTATION_VIEW') || canAccess('CONSULTATION_SETTINGS')" index="consultations"><template #title><el-icon><ChatLineRound /></el-icon><span>网咨数据</span></template><el-menu-item v-if="canAccess('CONSULTATION_VIEW')" index="/consultations">全部表单</el-menu-item><el-menu-item v-if="canAccess('CONSULTATION_VIEW')" index="/consultations/callbacks">今日需回访</el-menu-item><el-menu-item v-if="canAccess('CONSULTATION_SETTINGS')" index="/consultations/settings">网咨设置</el-menu-item></el-sub-menu>
          <el-sub-menu v-if="['PROMOTION_HOME','PROMOTION_DAILY','PROMOTION_WEEKLY','PROMOTION_MONTHLY','PROMOTION_FILTER','PROMOTION_DAILY_REPORT','PROMOTION_WEEKLY_REPORT','PROMOTION_MONTHLY_REPORT','PROMOTION_ACCOUNTS','PROMOTION_SYNC','PROMOTION_FIELDS','PROMOTION_SALARY'].some(canAccess)" index="operations"><template #title><el-icon><DataLine /></el-icon><span>推广数据</span></template><el-menu-item v-if="canAccess('PROMOTION_HOME')" index="/operations/dashboard">数据首页</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_DAILY')" index="/operations/daily">日统计</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_WEEKLY')" index="/operations/weekly">周统计</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_MONTHLY')" index="/operations/monthly">月统计</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_FILTER')" index="/operations/filter">数据筛选</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_DAILY_REPORT')" index="/operations/daily-report">推广日报</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_WEEKLY_REPORT')" index="/operations/weekly-report">推广周报</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_MONTHLY_REPORT')" index="/operations/monthly-report">推广月报</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_ACCOUNTS')" index="/operations/accounts">推广账户</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_SYNC')" index="/operations/sync-settings">数据同步设置</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_FIELDS')" index="/operations/fields">字段设置</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_SALARY')" index="/operations/salary">工资测算</el-menu-item></el-sub-menu>
          <el-sub-menu v-if="['CONTENT_HOME','CONTENT_DEPARTMENTS','CONTENT_DOCTORS','CONTENT_PACKAGES','CONTENT_MEDIA','CONTENT_LINKS'].some(canAccess)" index="content"><template #title><el-icon><Menu /></el-icon><span>内容管理</span></template><el-menu-item v-if="canAccess('CONTENT_HOME')" index="/home-manage">首页管理</el-menu-item><el-menu-item v-if="canAccess('CONTENT_DEPARTMENTS')" index="/department-manage">科室与项目</el-menu-item><el-menu-item v-if="canAccess('CONTENT_DOCTORS')" index="/doctor-manage">医生与出诊</el-menu-item><el-menu-item v-if="canAccess('CONTENT_PACKAGES')" index="/package-manage">套餐管理</el-menu-item><el-menu-item v-if="canAccess('CONTENT_MEDIA')" index="/media-library">图片库</el-menu-item><el-menu-item v-if="canAccess('CONTENT_LINKS')" index="/mini-program-links">页面跳转链接</el-menu-item></el-sub-menu>
          <el-sub-menu v-if="['WEBSITE_SETTINGS','WEBSITE_CATEGORIES','WEBSITE_ARTICLES'].some(canAccess)" index="website"><template #title><el-icon class="website-nav-icon"><Monitor /></el-icon><span>官网内容</span></template><el-menu-item v-if="canAccess('WEBSITE_SETTINGS')" index="/website-settings">官网设置</el-menu-item><el-menu-item v-if="canAccess('WEBSITE_CATEGORIES')" index="/website-categories">资讯分类</el-menu-item><el-menu-item v-if="canAccess('WEBSITE_ARTICLES')" index="/website-articles">口腔资讯</el-menu-item></el-sub-menu>
          <el-sub-menu v-if="canAccess('WECHAT_MENU') || canAccess('WECHAT_AUTO_REPLY')" index="wechat"><template #title><el-icon><ChatLineRound /></el-icon><span>微信运营</span></template><el-menu-item v-if="canAccess('WECHAT_MENU')" index="/official-menu">公众号菜单</el-menu-item><el-menu-item v-if="canAccess('WECHAT_AUTO_REPLY')" index="/official-auto-reply">自动回复</el-menu-item></el-sub-menu>
          <el-sub-menu v-if="['SYSTEM_MEMBERS','SYSTEM_ROLES','SYSTEM_OFFICIAL_BINDING','SYSTEM_CONFIGS','SYSTEM_FOLLOWUP','SYSTEM_WEBSITE_ANALYTICS','SYSTEM_AUDIT'].some(canAccess)" index="system"><template #title><el-icon><Setting /></el-icon><span>系统管理</span></template><el-menu-item v-if="canAccess('SYSTEM_MEMBERS')" index="/admin-users">成员与预约通知</el-menu-item><el-menu-item v-if="canAccess('SYSTEM_ROLES')" index="/admin-roles">角色管理</el-menu-item><el-menu-item v-if="canAccess('SYSTEM_OFFICIAL_BINDING')" index="/official-binding">公众号绑定</el-menu-item><el-menu-item v-if="canAccess('SYSTEM_CONFIGS')" index="/configs">系统配置</el-menu-item><el-menu-item v-if="canAccess('SYSTEM_FOLLOWUP')" index="/followup-forward">回访接口</el-menu-item><el-menu-item v-if="canAccess('SYSTEM_WEBSITE_ANALYTICS')" index="/website-analytics">官网浏览统计</el-menu-item><el-menu-item v-if="canAccess('SYSTEM_AUDIT')" index="/audit-logs">审计日志</el-menu-item></el-sub-menu>
        </el-menu>
      </nav>

      <div class="sidebar-footer">
        <span class="status-dot" />
        <span v-show="!sidebarCollapsed || isMobile">系统运行中</span>
      </div>
    </el-aside>
    <div v-if="isMobile && mobileNavigationOpen" class="mobile-nav-mask" @click="closeMobileNavigation" />

    <el-container class="main-shell">
      <el-header class="header">
        <div class="header-left">
          <el-button class="collapse-button" text :aria-label="isMobile ? (mobileNavigationOpen ? '收起导航' : '展开导航') : (sidebarCollapsed ? '展开导航' : '收起导航')" @click="toggleSidebar">
            <el-icon size="18"><Expand v-if="isMobile ? !mobileNavigationOpen : sidebarCollapsed" /><Fold v-else /></el-icon>
          </el-button>
          <div class="breadcrumb-copy">
            <span>傅小念的运营管理后台</span>
            <strong>{{ currentPageTitle }}</strong>
          </div>
        </div>

        <el-dropdown trigger="click">
          <button class="account-button" type="button">
            <span class="account-avatar">{{ accountInitial }}</span>
            <span class="account-copy">
              <strong>{{ auth.user?.nickname || auth.user?.username || '管理员' }}</strong>
              <small>{{ roleLabel }}</small>
            </span>
            <el-icon><ArrowDown /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>{{ auth.user?.nickname || auth.user?.username }} · {{ roleLabel }}</el-dropdown-item>
              <el-dropdown-item divided @click="auth.logout">
                <el-icon><SwitchButton /></el-icon>退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>

      <el-main class="main-content">
        <div class="page-container">
          <RouterView />
        </div>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import {
  ArrowDown,
  ChatLineRound,
  DataLine,
  Expand,
  Fold,
  Menu,
  Monitor,
  Setting,
  SwitchButton,
  Tickets,
} from '@element-plus/icons-vue';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const auth = useAuthStore();
const sidebarCollapsed = ref(localStorage.getItem('admin_sidebar_collapsed') === '1');
const isMobile = ref(false);
const mobileNavigationOpen = ref(false);
const canAccess = (permission: string) => auth.hasPermission(permission);
function toggleSidebar() {
  if (isMobile.value) {
    mobileNavigationOpen.value = !mobileNavigationOpen.value;
    return;
  }
  sidebarCollapsed.value = !sidebarCollapsed.value;
  localStorage.setItem('admin_sidebar_collapsed', sidebarCollapsed.value ? '1' : '0');
}
function closeMobileNavigation() {
  mobileNavigationOpen.value = false;
}
function updateViewport() {
  isMobile.value = window.innerWidth <= 900;
  if (!isMobile.value) closeMobileNavigation();
}
onMounted(() => {
  updateViewport();
  window.addEventListener('resize', updateViewport);
});
onBeforeUnmount(() => window.removeEventListener('resize', updateViewport));

const pageTitles: Record<string, string> = {
  '/tencent-ad-leads': '腾讯广告线索',
  '/consultations': '全部网咨表单',
  '/consultations/callbacks': '今日需回访',
  '/consultations/settings': '网咨设置',
  '/operations/dashboard': '数据首页',
  '/operations/daily': '推广数据日统计',
  '/operations/weekly': '推广数据周统计',
  '/operations/monthly': '推广数据月统计',
  '/operations/filter': '数据筛选',
  '/operations/accounts': '推广账户',
  '/operations/sync-settings': '推广数据同步设置',
  '/operations/fields': '推广数据字段设置',
  '/operations/daily-report': '推广日报',
  '/operations/weekly-report': '推广周报',
  '/operations/monthly-report': '推广月报',
  '/operations/salary': '工资测算',
  '/dashboard': '仪表盘',
  '/appointments': '挂号管理',
  '/users': '用户管理',
  '/notifications': '通知记录',
  '/home-manage': '首页管理',
  '/doctor-manage': '医生管理',
  '/department-manage': '科室管理',
  '/package-manage': '套餐管理',
  '/media-library': '图片库',
  '/mini-program-links': '页面跳转链接',
  '/website-settings': '官网设置',
  '/website-categories': '资讯分类',
  '/website-articles': '口腔资讯',
  '/configs': '系统配置',
  '/official-menu': '公众号菜单',
  '/official-auto-reply': '自动回复',
  '/appointment-notify': '成员与通知',
  '/followup-forward': '回访接口',
  '/website-analytics': '官网浏览统计',
  '/admin-users': '成员与通知',
  '/admin-roles': '角色管理',
  '/official-binding': '公众号绑定',
  '/audit-logs': '审计日志'
};

const currentPageTitle = computed(() => pageTitles[route.path] || '傅小念的运营管理后台');
const accountInitial = computed(() => (auth.user?.nickname || auth.user?.username || '管').slice(0, 1).toUpperCase());
const roleLabel = computed(() => {
  const labels: Record<string, string> = {
    SUPER_ADMIN: '超级管理员',
    MANAGER: '经理',
    STAFF: '员工'
  };
  return auth.user?.roleName || labels[auth.user?.role || ''] || auth.user?.role || '管理员';
});
</script>

<style scoped>
.layout {
  min-height: 100vh;
}

.aside {
  position: fixed;
  z-index: 30;
  top: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--admin-sidebar);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  transition: width 200ms ease;
}

.brand {
  display: flex;
  flex: 0 0 72px;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  color: #ffffff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand-mark {
  display: grid;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  place-items: center;
  color: #ffffff;
  background: var(--admin-primary);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  font-size: 18px;
  font-weight: 750;
}

.brand-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  white-space: nowrap;
}

.brand-copy strong {
  font-size: 16px;
  line-height: 22px;
}

.brand-copy span {
  color: #cce0f4;
  font-size: 12px;
}

.navigation {
  flex: 1;
  padding: 14px 10px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-color: #cce0f4 transparent;
  scrollbar-width: thin;
}

.nav-group-label {
  padding: 4px 12px 7px;
  color: #cce0f4;
  font-size: 11px;
  font-weight: 650;
}

.nav-group-label--spaced {
  margin-top: 12px;
}

.navigation :deep(.el-menu) {
  background: transparent;
  border-right: 0;
}

.navigation :deep(.el-menu-item) {
  height: 44px;
  margin-bottom: 4px;
  padding: 0 12px !important;
  color: #eaf4fc;
  border-radius: 6px;
  transition: color 160ms ease, background-color 160ms ease, transform 160ms ease;
}

.navigation :deep(.el-sub-menu__title) {
  height: 44px;
  margin-bottom: 4px;
  padding: 0 12px !important;
  color: #eaf4fc;
  border-radius: 6px;
  transition: color 160ms ease, background-color 160ms ease;
}

.navigation :deep(.el-sub-menu__title:hover) {
  color: #ffffff;
  background: var(--admin-sidebar-hover);
}

.navigation :deep(.el-sub-menu .el-menu-item) {
  min-width: 0;
  padding-left: 46px !important;
  color: #d9eaf8;
}

.navigation :deep(.el-menu-item .el-icon) {
  width: 20px;
  margin-right: 12px;
  color: #cce0f4;
}

.navigation :deep(.el-menu-item:hover) {
  color: #ffffff;
  background: var(--admin-sidebar-hover);
  transform: translateX(2px);
}

.navigation :deep(.el-menu-item.is-active) {
  color: #ffffff;
  background: var(--admin-sidebar-hover);
  font-weight: 600;
  box-shadow: inset 3px 0 0 #cce0f4;
}

.navigation :deep(.el-menu-item.is-active .el-icon) {
  color: #ffffff;
}

.navigation :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  color: #ffffff;
  background: rgba(131, 142, 124, 0.5);
  font-weight: 600;
}

.navigation :deep(.el-sub-menu.is-active > .el-sub-menu__title > .el-icon) {
  color: #ffffff;
}

.is-collapsed .brand,
.is-collapsed .sidebar-footer {
  justify-content: center;
  padding-right: 0;
  padding-left: 0;
}

.is-collapsed .navigation {
  overflow-x: hidden;
  scrollbar-width: none;
}

.is-collapsed .navigation::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.is-collapsed .navigation :deep(.el-menu--collapse) {
  width: 56px;
}

.is-collapsed .navigation :deep(.el-menu-item),
.is-collapsed .navigation :deep(.el-sub-menu__title) {
  display: flex;
  justify-content: center;
  flex-wrap: nowrap;
  padding: 0 !important;
  overflow: hidden;
  white-space: nowrap;
  transform: none;
}

.is-collapsed .navigation :deep(.el-menu-item > .el-icon),
.is-collapsed .navigation :deep(.el-sub-menu__title > .el-icon) {
  margin: 0 !important;
}

/* 收起状态下，激活子菜单也必须保留图标（Element Plus 会覆盖该布局）。 */
.is-collapsed .navigation :deep(.el-sub-menu > .el-sub-menu__title > .el-icon:first-child) {
  display: inline-flex !important;
  flex: 0 0 20px;
  width: 20px !important;
  height: 20px !important;
  margin: 0 !important;
  visibility: visible !important;
}

.is-collapsed .navigation :deep(.el-sub-menu > .el-sub-menu__title > .el-icon:first-child svg) {
  display: block !important;
  width: 20px;
  height: 20px;
}

/* Element Plus 收起子菜单时会重置图标布局；官网图标保持固定占位。 */
.is-collapsed .navigation :deep(.website-nav-icon) {
  display: inline-flex !important;
  flex: 0 0 20px;
  width: 20px !important;
  height: 20px !important;
  margin: 0 !important;
  color: #cce0f4 !important;
  visibility: visible !important;
}

.is-collapsed .navigation :deep(.website-nav-icon svg) {
  display: block !important;
  width: 20px;
  height: 20px;
}

.is-collapsed .navigation :deep(.el-sub-menu__icon-arrow),
.is-collapsed .navigation :deep(.el-sub-menu > .el-sub-menu__title > .el-sub-menu__icon-arrow),
.is-collapsed .navigation :deep(.el-icon-arrow-right),
.is-collapsed .navigation :deep(.el-sub-menu__title > svg:last-child) {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  visibility: hidden !important;
}

.sidebar-footer {
  display: flex;
  flex: 0 0 54px;
  align-items: center;
  gap: 9px;
  padding: 0 22px;
  color: #cce0f4;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
  white-space: nowrap;
}

.status-dot {
  flex: 0 0 8px;
  width: 8px;
  height: 8px;
  background: #838e7c;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(131, 142, 124, 0.22);
}

.main-shell {
  min-width: 0;
  margin-left: 232px;
  transition: margin-left 200ms ease;
}

.is-collapsed .main-shell {
  margin-left: 76px;
}

.header {
  position: sticky;
  z-index: 20;
  top: 0;
  display: flex;
  height: 64px;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid var(--admin-border);
  box-shadow: 0 4px 18px rgba(69, 126, 169, 0.06);
  backdrop-filter: blur(10px);
}

.header-left,
.account-button {
  display: flex;
  align-items: center;
}

.header-left {
  gap: 12px;
}

.collapse-button {
  width: 40px;
  height: 40px;
  padding: 0;
  color: var(--admin-text-secondary);
}

.breadcrumb-copy {
  display: flex;
  flex-direction: column;
}

.breadcrumb-copy span {
  color: var(--admin-text-muted);
  font-size: 11px;
}

.breadcrumb-copy strong {
  color: var(--admin-text);
  font-size: 14px;
  line-height: 20px;
}

.account-button {
  gap: 10px;
  min-height: 44px;
  padding: 4px 8px 4px 5px;
  color: inherit;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
}

.account-button:hover,
.account-button:focus-visible {
  background: #edf5fb;
  border-color: var(--admin-border);
  outline: none;
}

.account-avatar {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  color: #ffffff;
  background: var(--admin-primary);
  border-radius: 6px;
  font-weight: 700;
}

.account-copy {
  display: flex;
  min-width: 88px;
  flex-direction: column;
  align-items: flex-start;
}

.account-copy strong {
  max-width: 130px;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
}

.account-copy small {
  color: var(--admin-text-muted);
  font-size: 11px;
}

.main-content {
  min-width: 0;
  padding: 24px;
  background: var(--admin-bg);
}

.page-container {
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
}

@media (max-width: 900px) {
  .aside {
    position: fixed;
    z-index: 1002;
    width: 232px !important;
    height: 100dvh;
    transform: translateX(-100%);
    transition: transform .22s ease;
    box-shadow: none;
  }

  .mobile-nav-open .aside {
    transform: translateX(0);
    box-shadow: 8px 0 24px rgba(15, 23, 42, .24);
  }

  .mobile-nav-mask {
    position: fixed;
    z-index: 1001;
    inset: 0;
    background: rgba(15, 23, 42, .4);
  }

  .navigation :deep(.el-menu) {
    width: 100%;
  }

  .navigation :deep(.el-menu-item) {
    padding-left: 20px !important;
  }

  .main-shell,
  .is-collapsed .main-shell {
    margin-left: 0;
  }

  .collapse-button {
    display: inline-flex;
  }
}

@media (max-width: 640px) {
  .aside {
    width: min(82vw, 280px) !important;
  }

  .brand {
    justify-content: center;
    padding: 0;
  }

  .brand-mark {
    width: 36px;
    height: 36px;
    flex-basis: 36px;
  }

  .header {
    height: 58px;
    padding: 0 12px;
  }

  .account-copy,
  .account-button > .el-icon {
    display: none;
  }

  .main-content {
    padding: 14px 10px;
  }
}
</style>
