<template>
  <el-container class="layout" :class="{ 'is-collapsed': sidebarCollapsed, 'mobile-nav-open': mobileNavigationOpen, 'layout--embedded': embedded }">
    <el-aside v-if="!embedded" :width="isMobile ? '232px' : (sidebarCollapsed ? '76px' : '232px')" class="aside">
      <div class="brand">
        <div class="brand-mark">管</div>
        <div v-show="!sidebarCollapsed || isMobile" class="brand-copy">
          <strong>傅小念的运营工作台</strong>

        </div>
      </div>

      <nav class="navigation" aria-label="后台主导航">
        <el-menu router :default-active="$route.path" :collapse="isMobile ? false : sidebarCollapsed" :collapse-transition="false" @select="closeMobileNavigation">
          <el-menu-item index="/dashboard"><el-icon><DataLine /></el-icon><template #title>仪表盘</template></el-menu-item>
          <el-sub-menu v-if="['BUSINESS_LEADS','BUSINESS_APPOINTMENTS','BUSINESS_USERS','BUSINESS_NOTIFICATIONS'].some(canAccess)" index="business"><template #title><el-icon><Tickets /></el-icon><span>线索管理</span></template><el-menu-item v-if="canAccess('BUSINESS_LEADS')" index="/tencent-ad-leads">腾讯线索</el-menu-item><el-menu-item v-if="canAccess('BUSINESS_APPOINTMENTS')" index="/appointments">挂号管理</el-menu-item><el-menu-item v-if="canAccess('BUSINESS_USERS')" index="/users">用户管理</el-menu-item><el-menu-item v-if="canAccess('BUSINESS_NOTIFICATIONS')" index="/notifications">通知记录</el-menu-item></el-sub-menu>
          <el-sub-menu v-if="canAccess('CONSULTATION_VIEW') || canAccess('CONSULTATION_SETTINGS')" index="consultations"><template #title><el-icon><ChatLineRound /></el-icon><span>网咨数据</span></template><el-menu-item v-if="canAccess('CONSULTATION_VIEW')" index="/consultations">全部表单</el-menu-item><el-menu-item v-if="canAccess('CONSULTATION_VIEW')" index="/consultations/callbacks">今日需回访</el-menu-item><el-menu-item v-if="canAccess('CONSULTATION_VIEW')" index="/consultations/channel-report">渠道报表</el-menu-item><el-menu-item v-if="canAccess('CONSULTATION_VIEW')" index="/consultations/report">网咨报表</el-menu-item><el-menu-item v-if="canAccess('CONSULTATION_SETTINGS')" index="/consultations/settings">网咨设置</el-menu-item></el-sub-menu>
          <el-sub-menu v-if="['PROMOTION_HOME','PROMOTION_DAILY','PROMOTION_WEEKLY','PROMOTION_MONTHLY','PROMOTION_FILTER','PROMOTION_DAILY_REPORT','PROMOTION_WEEKLY_REPORT','PROMOTION_MONTHLY_REPORT','PROMOTION_ACCOUNTS','PROMOTION_SYNC','PROMOTION_FIELDS','PROMOTION_SALARY'].some(canAccess)" index="operations"><template #title><el-icon><DataLine /></el-icon><span>推广数据</span></template><el-menu-item v-if="canAccess('PROMOTION_HOME')" index="/operations/dashboard">数据首页</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_DAILY')" index="/operations/daily">日统计</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_WEEKLY')" index="/operations/weekly">周统计</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_MONTHLY')" index="/operations/monthly">月统计</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_FILTER')" index="/operations/filter">数据筛选</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_DAILY_REPORT')" index="/operations/daily-report">推广日报</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_WEEKLY_REPORT')" index="/operations/weekly-report">推广周报</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_MONTHLY_REPORT')" index="/operations/monthly-report">推广月报</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_ACCOUNTS')" index="/operations/accounts">推广账户</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_SYNC')" index="/operations/sync-settings">数据同步设置</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_FIELDS')" index="/operations/fields">字段设置</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_SALARY')" index="/operations/salary">工资测算</el-menu-item></el-sub-menu>
          <el-sub-menu v-if="canAccess('PROMOTION_OPERATIONS') || canAccess('PROMOTION_SMART_MONITOR_VIEW') || canAccess('PROMOTION_CREATIVE_BATCH_VIEW') || canAccess('PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW') || canAccess('PROMOTION_CREATIVE_DEFAULT_COMPONENT_VIEW')" index="promotion-operations"><template #title><el-icon><TrendCharts /></el-icon><span>推广运营</span></template><el-menu-item v-if="canAccess('PROMOTION_OPERATIONS')" index="/promotion-operations/account-health">账户健康</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_OPERATIONS')" index="/promotion-operations/material-analysis">素材分析</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_SMART_MONITOR_VIEW')" index="/promotion/smart-monitor">智能监控</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_CREATIVE_BATCH_VIEW')" index="/promotion-operations/creative-batches">新建创意</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW')" index="/promotion/multi-account-creative-batch">批量新建</el-menu-item><el-menu-item v-if="canAccess('PROMOTION_CREATIVE_DEFAULT_COMPONENT_VIEW')" index="/promotion/creative-default-components">默认组件</el-menu-item></el-sub-menu>
          <el-sub-menu v-if="['CONTENT_HOME','CONTENT_DEPARTMENTS','CONTENT_DOCTORS','CONTENT_PACKAGES','CONTENT_MEDIA','CONTENT_LINKS','SYSTEM_CONFIGS','WECHAT_GROUP_NOTIFY_VIEW'].some(canAccess)" index="content"><template #title><el-icon><Menu /></el-icon><span>小程序页</span></template><el-menu-item v-if="canAccess('CONTENT_HOME')" index="/home-manage">首页管理</el-menu-item><el-menu-item v-if="canAccess('CONTENT_DEPARTMENTS')" index="/department-manage">科室与项目</el-menu-item><el-menu-item v-if="canAccess('CONTENT_DOCTORS')" index="/doctor-manage">医生与出诊</el-menu-item><el-menu-item v-if="canAccess('CONTENT_PACKAGES')" index="/package-manage">套餐管理</el-menu-item><el-menu-item v-if="canAccess('CONTENT_MEDIA')" index="/media-library">图片库</el-menu-item><el-menu-item v-if="canAccess('CONTENT_LINKS')" index="/mini-program-links">页面跳转链接</el-menu-item><el-menu-item v-if="canAccess('SYSTEM_CONFIGS')" index="/configs">留资页面</el-menu-item><el-menu-item v-if="canAccess('WECHAT_GROUP_NOTIFY_VIEW')" index="/wechat-group-notifications">微信群挂号通知</el-menu-item><el-menu-item v-if="canAccess('WECHAT_GROUP_NOTIFY_VIEW')" index="/wechat-group-notifications/sender">专用微信账号</el-menu-item></el-sub-menu>
          <el-sub-menu v-if="['WEBSITE_SETTINGS','WEBSITE_CATEGORIES','WEBSITE_ARTICLES'].some(canAccess)" index="website"><template #title><el-icon class="website-nav-icon"><Monitor /></el-icon><span>官网内容</span></template><el-menu-item v-if="canAccess('WEBSITE_SETTINGS')" index="/website-settings">官网设置</el-menu-item><el-menu-item v-if="canAccess('WEBSITE_CATEGORIES')" index="/website-categories">资讯分类</el-menu-item><el-menu-item v-if="canAccess('WEBSITE_ARTICLES')" index="/website-articles">口腔资讯</el-menu-item></el-sub-menu>
          <el-sub-menu v-if="canAccess('WECHAT_MENU') || canAccess('WECHAT_AUTO_REPLY') || canAccess('SYSTEM_OFFICIAL_BINDING') || canAccess('SYSTEM_APPOINTMENT_NOTIFY')" index="wechat"><template #title><el-icon><ChatLineRound /></el-icon><span>微信运营</span></template><el-menu-item v-if="canAccess('WECHAT_MENU')" index="/official-menu">公众号菜单</el-menu-item><el-menu-item v-if="canAccess('WECHAT_AUTO_REPLY')" index="/official-auto-reply">自动回复</el-menu-item><el-menu-item v-if="canAccess('SYSTEM_OFFICIAL_BINDING') || canAccess('SYSTEM_APPOINTMENT_NOTIFY')" index="/official-binding">公众号绑定</el-menu-item></el-sub-menu>
          <el-sub-menu index="system"><template #title><el-icon><Setting /></el-icon><span>系统管理</span></template><el-menu-item v-if="canAccess('SYSTEM_MEMBERS')" index="/admin-users">成员管理</el-menu-item><el-menu-item v-if="canAccess('SYSTEM_MEMBERS')" index="/admin-teams">团队管理</el-menu-item><el-menu-item v-if="canAccess('SYSTEM_ROLES')" index="/admin-roles">角色管理</el-menu-item><el-menu-item v-if="canAccess('SYSTEM_FOLLOWUP')" index="/followup-forward">回访接口</el-menu-item><el-menu-item v-if="canAccess('SYSTEM_WEBSITE_ANALYTICS')" index="/website-analytics">官网浏览统计</el-menu-item><el-menu-item v-if="canAccess('SYSTEM_AUDIT')" index="/audit-logs">审计日志</el-menu-item><el-menu-item index="/change-password">修改密码</el-menu-item></el-sub-menu>
        </el-menu>
      </nav>

      <div class="sidebar-footer">
        <span class="status-dot" />
        <span v-show="!sidebarCollapsed || isMobile">系统运行中</span>
      </div>
    </el-aside>
    <div v-if="!embedded && isMobile && mobileNavigationOpen" class="mobile-nav-mask" @click="closeMobileNavigation" />

    <el-container class="main-shell">
      <el-header v-if="!embedded" class="header">
        <div class="header-left">
          <el-button class="collapse-button" text :aria-label="isMobile ? (mobileNavigationOpen ? '收起导航' : '展开导航') : (sidebarCollapsed ? '展开导航' : '收起导航')" @click="toggleSidebar">
            <el-icon size="18"><Expand v-if="isMobile ? !mobileNavigationOpen : sidebarCollapsed" /><Fold v-else /></el-icon>
          </el-button>
          <div class="breadcrumb-copy">
            <span>傅小念的运营工作台</span>
            <strong>{{ currentPageTitle }}</strong>
          </div>
        </div>

        <el-dropdown trigger="click">
          <button class="account-button" type="button">
            <span class="account-avatar">{{ accountInitial }}</span>
            <span class="account-copy">
              <strong>{{ accountName }}</strong>
              <small>{{ roleLabel }}</small>
            </span>
            <el-icon><ArrowDown /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>{{ accountName }} · {{ roleLabel }}</el-dropdown-item>
              <el-dropdown-item @click="router.push('/change-password')">修改密码</el-dropdown-item>
              <el-dropdown-item divided @click="auth.logout">
                <el-icon><SwitchButton /></el-icon>退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>

      <nav v-if="!embedded" class="page-tabs" aria-label="已打开的后台页面">
        <div v-for="tab in openTabs" :key="tab.path" class="page-tab" :class="{ active: route.path === tab.path }">
          <RouterLink :to="tab.path" class="page-tab-main" :aria-current="route.path === tab.path ? 'page' : undefined" :title="tab.title">{{ tab.title }}</RouterLink>
          <button type="button" class="page-tab-close" :aria-label="`关闭${tab.title}`" :title="`关闭${tab.title}`" @click.stop="closeTab(tab.path)">×</button>
        </div>
      </nav>

      <el-main class="main-content">
        <div class="page-container">
          <RouterView />
        </div>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
  TrendCharts,
} from '@element-plus/icons-vue';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const embedded = window.self !== window.top;
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
  '/tencent-ad-leads': '腾讯线索',
  '/consultations': '全部网咨表单',
  '/consultations/callbacks': '今日需回访',
  '/consultations/channel-report': '渠道报表',
  '/consultations/report': '网咨报表',
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
  '/promotion-operations/account-health': '账户健康',
  '/promotion-operations/material-analysis': '素材分析',
  '/promotion/smart-monitor': '智能监控',
  '/promotion-operations/creative-batches': '新建创意',
  '/promotion/multi-account-creative-batch': '批量新建',
  '/promotion/creative-default-components': '默认组件',
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
  '/configs': '留资页面',
  '/wechat-group-notifications': '微信群挂号通知',
  '/wechat-group-notifications/sender': '专用微信账号',
  '/official-menu': '公众号菜单',
  '/official-auto-reply': '自动回复',
  '/appointment-notify': '公众号绑定',
  '/followup-forward': '回访接口',
  '/website-analytics': '官网浏览统计',
  '/admin-users': '成员管理',
  '/admin-teams': '团队管理',
  '/change-password': '修改密码',
  '/admin-roles': '角色管理',
  '/official-binding': '公众号绑定',
  '/audit-logs': '审计日志'
};

const currentPageTitle = computed(() => pageTitles[route.path] || '傅小念的运营工作台');
interface PageTab { path: string; title: string }
const openTabs = ref<PageTab[]>([]);
const tabStorageKey = computed(() => `admin_page_tabs_${auth.user?.id || 'anonymous'}`);
function permittedTab(path: string): PageTab | null {
  const resolved = router.resolve(path);
  if (resolved.path !== path || !pageTitles[path]) return null;
  const permission = String(resolved.matched[resolved.matched.length - 1]?.meta.permission || '');
  return permission && !auth.hasPermission(permission) ? null : { path, title: pageTitles[path] };
}
function saveTabs() {
  try { sessionStorage.setItem(tabStorageKey.value, JSON.stringify(openTabs.value.map(tab => tab.path))); } catch { /* 无存储权限时仅保留当前会话内的标签 */ }
}
watch(() => auth.user?.id, () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(tabStorageKey.value) || '[]') as unknown;
    openTabs.value = Array.isArray(saved) ? [...new Set(saved.filter((item): item is string => typeof item === 'string'))].map(permittedTab).filter((item): item is PageTab => !!item).slice(-12) : [];
  } catch { openTabs.value = []; }
}, { immediate: true });
watch(() => route.path, path => {
  if (embedded) return;
  const tab = permittedTab(path);
  if (!tab) return;
  if (!openTabs.value.some(item => item.path === path)) {
    openTabs.value.push(tab);
    if (openTabs.value.length > 12) openTabs.value.shift();
  }
  saveTabs();
}, { immediate: true });
function closeTab(path: string) {
  const index = openTabs.value.findIndex(item => item.path === path);
  if (index < 0) return;
  openTabs.value.splice(index, 1);
  saveTabs();
  if (route.path === path) router.push(openTabs.value[Math.min(index, openTabs.value.length - 1)]?.path || '/dashboard');
}
const accountName = computed(() => auth.user?.username === 'admin' ? 'admin' : (auth.user?.nickname || auth.user?.username || '管理员'));
const accountInitial = computed(() => accountName.value.slice(0, 1).toUpperCase());
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
  border-right: 1px solid var(--admin-border);
  transition: width 200ms ease;
}

.brand {
  display: flex;
  flex: 0 0 72px;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  color: var(--admin-text);
  border-bottom: 1px solid var(--admin-border);
}

.brand-mark {
  display: grid;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  place-items: center;
  color: #ffffff;
  background: var(--admin-primary);
  border: 0;
  border-radius: 14px;
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
  color: var(--admin-text-muted);
  font-size: 12px;
}

.navigation {
  flex: 1;
  padding: 14px 10px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-color: #d2d2d7 transparent;
  scrollbar-width: thin;
}

.nav-group-label {
  padding: 4px 12px 7px;
  color: var(--admin-text-muted);
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
  color: var(--admin-text-secondary);
  border-radius: 12px;
  transition: color 160ms ease, background-color 160ms ease, transform 160ms ease;
}

.navigation :deep(.el-sub-menu__title) {
  height: 44px;
  margin-bottom: 4px;
  padding: 0 12px !important;
  color: var(--admin-text-secondary);
  border-radius: 12px;
  transition: color 160ms ease, background-color 160ms ease;
}

.navigation :deep(.el-sub-menu__title:hover) {
  color: var(--admin-primary);
  background: var(--admin-sidebar-hover);
}

.navigation :deep(.el-sub-menu .el-menu-item) {
  min-width: 0;
  padding-left: 46px !important;
  color: var(--admin-text-secondary);
}

.navigation :deep(.el-menu-item .el-icon) {
  width: 20px;
  margin-right: 12px;
  color: var(--admin-text-muted);
}

.navigation :deep(.el-menu-item:hover) {
  color: var(--admin-primary);
  background: var(--admin-sidebar-hover);
  transform: translateX(2px);
}

.navigation :deep(.el-menu-item.is-active) {
  color: var(--admin-primary);
  background: var(--admin-sidebar-hover);
  font-weight: 600;
  box-shadow: none;
}

.navigation :deep(.el-menu-item.is-active .el-icon) {
  color: var(--admin-primary);
}

.navigation :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  color: var(--admin-primary);
  background: var(--admin-primary-soft);
  font-weight: 600;
}

.navigation :deep(.el-sub-menu.is-active > .el-sub-menu__title > .el-icon) {
  color: var(--admin-primary);
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
  color: var(--admin-text-muted) !important;
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
  color: var(--admin-text-muted);
  border-top: 1px solid var(--admin-border);
  font-size: 12px;
  white-space: nowrap;
}

.status-dot {
  flex: 0 0 8px;
  width: 8px;
  height: 8px;
  background: #30a46c;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(48, 164, 108, 0.14);
}

.main-shell {
  min-width: 0;
  margin-left: 232px;
  transition: margin-left 200ms ease;
}

.layout--embedded .main-shell,
.layout--embedded.is-collapsed .main-shell {
  margin-left: 0;
}

.layout--embedded .main-content {
  padding: 10px;
}

.is-collapsed .main-shell {
  margin-left: 76px;
}

.header {
  position: sticky;
  z-index: 20;
  top: 0;
  display: flex;
  height: 56px;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid var(--admin-border);
  box-shadow: none;
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
  border-radius: 20px;
  cursor: pointer;
}

.account-button:hover,
.account-button:focus-visible {
  background: var(--admin-primary-soft);
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
  border-radius: 50%;
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
  padding: 16px;
  background: var(--admin-bg);
}
.page-tabs{position:sticky;z-index:19;top:56px;display:flex;align-items:center;gap:6px;min-width:0;min-height:40px;padding:3px 16px;overflow-x:auto;overflow-y:hidden;border-bottom:1px solid var(--admin-border);background:#fff;box-shadow:none;scrollbar-width:thin}
.page-tab{display:flex;align-items:center;flex:none;max-width:210px;height:34px;border:1px solid transparent;border-radius:18px;background:#f5f5f7;color:var(--admin-text-secondary)}
.page-tab.active{border-color:transparent;background:var(--admin-primary-soft);color:var(--admin-primary);box-shadow:none}
.page-tab-main,.page-tab-close{height:100%;border:0;background:transparent;color:inherit;cursor:pointer}
.page-tab-main{display:inline-flex;align-items:center;min-width:0;max-width:175px;padding:0 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-decoration:none;font-size:12px;font-weight:600}
.page-tab-main:focus-visible{border-radius:7px 0 0 7px;outline:2px solid var(--admin-primary);outline-offset:-2px}
.page-tab-close{flex:none;width:28px;padding:0;font-size:19px;line-height:1}
.page-tab-close:hover,.page-tab-close:focus-visible{border-radius:0 18px 18px 0;background:#d1e8ff;outline:none}

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
    height: 52px;
    padding: 0 12px;
  }

  .account-copy,
  .account-button > .el-icon {
    display: none;
  }

  .main-content {
    padding: 14px 10px;
  }
  .page-tabs{top:52px;padding:3px 10px;min-height:39px}.page-tab{max-width:155px}.page-tab-main{max-width:119px}
}
</style>
