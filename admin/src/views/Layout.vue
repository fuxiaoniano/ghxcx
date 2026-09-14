<template>
  <el-container
    class="layout"
    :class="{
      'is-collapsed': !isMobile && sidebarCollapsed,
      'is-mobile-nav-open': isMobile && mobileNavOpen
    }"
  >
    <el-aside id="admin-navigation" :width="isMobile ? '280px' : sidebarCollapsed ? '76px' : '232px'" class="aside">
      <div class="brand">
        <div class="brand-mark">种</div>
        <div v-show="isMobile || !sidebarCollapsed" class="brand-copy">
          <strong>种博士口腔</strong>
          <span>预约管理中心</span>
        </div>
      </div>

      <nav class="navigation" aria-label="后台主导航">
        <el-menu
          router
          :default-active="$route.path"
          :collapse="!isMobile && sidebarCollapsed"
          :collapse-transition="false"
          @select="handleMenuSelect"
        >
          <el-menu-item index="/dashboard"><el-icon><DataLine /></el-icon><template #title>仪表盘</template></el-menu-item>
          <el-sub-menu index="business"><template #title><el-icon><Tickets /></el-icon><span>业务管理</span></template><el-menu-item index="/tencent-ad-leads">腾讯广告线索</el-menu-item><el-menu-item index="/appointments">挂号管理</el-menu-item><el-menu-item index="/users">用户管理</el-menu-item><el-menu-item index="/notifications">通知记录</el-menu-item></el-sub-menu>
          <el-sub-menu index="content"><template #title><el-icon><Menu /></el-icon><span>内容管理</span></template><el-menu-item v-if="canAccess('HOME_MANAGE')" index="/home-manage">首页管理</el-menu-item><el-menu-item v-if="canAccess('DOCTOR_MANAGE')" index="/department-manage">科室与项目</el-menu-item><el-menu-item v-if="canAccess('DOCTOR_MANAGE')" index="/doctor-manage">医生与出诊</el-menu-item><el-menu-item v-if="canAccess('PACKAGE_MANAGE')" index="/package-manage">套餐管理</el-menu-item><el-menu-item v-if="canAccess('HOME_MANAGE') || canAccess('DOCTOR_MANAGE') || canAccess('PACKAGE_MANAGE')" index="/media-library">图片库</el-menu-item><el-menu-item index="/mini-program-links">页面跳转链接</el-menu-item></el-sub-menu>
          <el-sub-menu v-if="canAccess('WEBSITE_MANAGE')" index="website"><template #title><el-icon><Monitor /></el-icon><span>官网内容</span></template><el-menu-item index="/website-settings">官网设置</el-menu-item><el-menu-item index="/website-pages">官网页面</el-menu-item><el-menu-item index="/website-articles">口腔资讯</el-menu-item></el-sub-menu>
          <el-sub-menu index="wechat"><template #title><el-icon><ChatLineRound /></el-icon><span>微信运营</span></template><el-menu-item index="/official-menu">公众号菜单</el-menu-item><el-menu-item index="/official-auto-reply">自动回复</el-menu-item><el-menu-item index="/admin-users">成员与预约通知</el-menu-item></el-sub-menu>
          <el-sub-menu index="system"><template #title><el-icon><Setting /></el-icon><span>系统管理</span></template><el-menu-item index="/configs">系统配置</el-menu-item><el-menu-item index="/followup-forward">回访接口</el-menu-item><el-menu-item index="/audit-logs">审计日志</el-menu-item></el-sub-menu>
        </el-menu>
      </nav>

      <div class="sidebar-footer">
        <span class="status-dot" />
        <span v-show="isMobile || !sidebarCollapsed">系统运行中</span>
      </div>
    </el-aside>

    <button
      v-if="isMobile && mobileNavOpen"
      class="mobile-nav-backdrop"
      type="button"
      aria-label="关闭导航"
      @click="closeMobileNav"
    />

    <el-container class="main-shell">
      <el-header class="header">
        <div class="header-left">
          <el-button
            class="collapse-button"
            text
            aria-controls="admin-navigation"
            :aria-expanded="isMobile ? mobileNavOpen : !sidebarCollapsed"
            :aria-label="navigationButtonLabel"
            @click="toggleSidebar"
          >
            <el-icon size="18"><Expand v-if="isMobile ? !mobileNavOpen : sidebarCollapsed" /><Fold v-else /></el-icon>
          </el-button>
          <div class="breadcrumb-copy">
            <span>管理后台</span>
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
const isMobile = ref(window.matchMedia('(max-width: 900px)').matches);
const mobileNavOpen = ref(false);
const canAccess = (permission: string) => auth.hasPermission(permission);

function toggleSidebar() {
  if (isMobile.value) {
    mobileNavOpen.value = !mobileNavOpen.value;
    return;
  }
  sidebarCollapsed.value = !sidebarCollapsed.value;
  localStorage.setItem('admin_sidebar_collapsed', sidebarCollapsed.value ? '1' : '0');
}

function closeMobileNav() {
  mobileNavOpen.value = false;
}

function handleMenuSelect() {
  if (isMobile.value) closeMobileNav();
}

function updateViewport() {
  const nextIsMobile = window.innerWidth <= 900;
  if (!nextIsMobile) mobileNavOpen.value = false;
  isMobile.value = nextIsMobile;
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && mobileNavOpen.value) closeMobileNav();
}

onMounted(() => {
  updateViewport();
  window.addEventListener('resize', updateViewport, { passive: true });
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport);
  window.removeEventListener('keydown', handleKeydown);
});

watch(() => route.fullPath, closeMobileNav);

const pageTitles: Record<string, string> = {
  '/tencent-ad-leads': '腾讯广告线索',
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
  '/website-pages': '官网页面',
  '/website-articles': '口腔资讯',
  '/configs': '系统配置',
  '/official-menu': '公众号菜单',
  '/official-auto-reply': '自动回复',
  '/appointment-notify': '成员与通知',
  '/followup-forward': '回访接口',
  '/admin-users': '成员与通知',
  '/audit-logs': '审计日志'
};

const currentPageTitle = computed(() => pageTitles[route.path] || '管理后台');
const navigationButtonLabel = computed(() => {
  if (isMobile.value) return mobileNavOpen.value ? '关闭导航' : '打开导航';
  return sidebarCollapsed.value ? '展开导航' : '收起导航';
});
const accountInitial = computed(() => (auth.user?.nickname || auth.user?.username || '管').slice(0, 1).toUpperCase());
const roleLabel = computed(() => {
  const labels: Record<string, string> = {
    SUPER_ADMIN: '超级管理员',
    MANAGER: '经理',
    STAFF: '员工'
  };
  return labels[auth.user?.role || ''] || auth.user?.role || '管理员';
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
  color: #9ba9bc;
  font-size: 12px;
}

.navigation {
  flex: 1;
  padding: 14px 10px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-color: #344158 transparent;
  scrollbar-width: thin;
}

.nav-group-label {
  padding: 4px 12px 7px;
  color: #76958f;
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
  color: #c3cbd8;
  border-radius: 6px;
}

.navigation :deep(.el-sub-menu__title) {
  height: 44px;
  margin-bottom: 4px;
  padding: 0 12px !important;
  color: #c3cbd8;
  border-radius: 6px;
}

.navigation :deep(.el-sub-menu__title:hover) {
  color: #ffffff;
  background: var(--admin-sidebar-hover);
}

.navigation :deep(.el-sub-menu .el-menu-item) {
  min-width: 0;
  padding-left: 46px !important;
  color: #aeb9c9;
}

.navigation :deep(.el-menu-item .el-icon) {
  width: 20px;
  margin-right: 12px;
  color: #93a4bb;
}

.navigation :deep(.el-menu-item:hover) {
  color: #ffffff;
  background: var(--admin-sidebar-hover);
}

.navigation :deep(.el-menu-item.is-active) {
  color: #ffffff;
  background: var(--admin-primary);
  font-weight: 600;
}

.navigation :deep(.el-menu-item.is-active .el-icon) {
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
  justify-content: center;
  padding: 0 !important;
}

.is-collapsed .navigation :deep(.el-menu-item > .el-icon),
.is-collapsed .navigation :deep(.el-sub-menu__title > .el-icon) {
  margin: 0 !important;
}

.is-collapsed .navigation :deep(.el-sub-menu__icon-arrow) {
  display: none;
}

.sidebar-footer {
  display: flex;
  flex: 0 0 54px;
  align-items: center;
  gap: 9px;
  padding: 0 22px;
  color: #9ba9bc;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
  white-space: nowrap;
}

.status-dot {
  flex: 0 0 8px;
  width: 8px;
  height: 8px;
  background: #4ade80;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.12);
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
  background: rgba(255, 255, 255, 0.97);
  border-bottom: 1px solid var(--admin-border);
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
  background: #f4f6f9;
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

.mobile-nav-backdrop {
  display: none;
}

@media (max-width: 900px) {
  .layout.is-mobile-nav-open {
    height: 100dvh;
    overflow: hidden;
  }

  .aside {
    z-index: 50;
    width: min(280px, calc(100vw - 48px)) !important;
    max-width: 280px;
    transform: translateX(-100%);
    box-shadow: 18px 0 48px rgba(15, 23, 42, 0.24);
    transition: transform 200ms ease;
  }

  .is-mobile-nav-open .aside {
    transform: translateX(0);
  }

  .brand-copy,
  .sidebar-footer span:not(.status-dot) {
    display: flex !important;
  }

  .navigation :deep(.el-menu) {
    width: 100%;
  }

  .navigation :deep(.el-menu-item),
  .navigation :deep(.el-sub-menu__title) {
    justify-content: flex-start;
    padding: 0 12px !important;
  }

  .navigation :deep(.el-menu-item .el-icon),
  .navigation :deep(.el-sub-menu__title > .el-icon) {
    margin-right: 12px !important;
  }

  .navigation :deep(.el-sub-menu .el-menu-item) {
    padding-left: 46px !important;
  }

  .main-shell,
  .is-collapsed .main-shell {
    margin-left: 0;
  }

  .collapse-button {
    display: inline-flex;
  }

  .mobile-nav-backdrop {
    position: fixed;
    z-index: 40;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    background: rgba(15, 23, 42, 0.5);
    border: 0;
    cursor: pointer;
  }
}

@media (max-width: 640px) {
  .main-shell,
  .is-collapsed .main-shell {
    margin-left: 0;
  }

  .header {
    height: 60px;
    padding: 0 max(10px, env(safe-area-inset-right)) 0 max(8px, env(safe-area-inset-left));
  }

  .header-left {
    min-width: 0;
    gap: 6px;
  }

  .breadcrumb-copy {
    min-width: 0;
  }

  .breadcrumb-copy span {
    display: none;
  }

  .breadcrumb-copy strong {
    max-width: calc(100vw - 132px);
    overflow: hidden;
    font-size: 15px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .account-copy,
  .account-button > .el-icon {
    display: none;
  }

  .main-content {
    padding: 12px 10px calc(18px + env(safe-area-inset-bottom));
  }
}
</style>
