<template>
  <el-container class="layout" :class="{ 'is-collapsed': sidebarCollapsed }">
    <el-aside :width="sidebarCollapsed ? '76px' : '232px'" class="aside">
      <div class="brand">
        <div class="brand-mark">种</div>
        <div v-show="!sidebarCollapsed" class="brand-copy">
          <strong>种博士口腔</strong>
          <span>预约管理中心</span>
        </div>
      </div>

      <nav class="navigation" aria-label="后台主导航">
        <div v-show="!sidebarCollapsed" class="nav-group-label">业务管理</div>
        <el-menu router :default-active="$route.path" :collapse="sidebarCollapsed">
          <el-menu-item index="/dashboard"><el-icon><DataLine /></el-icon><template #title>仪表盘</template></el-menu-item>
          <el-menu-item index="/appointments"><el-icon><Tickets /></el-icon><template #title>挂号管理</template></el-menu-item>
          <el-menu-item index="/users"><el-icon><User /></el-icon><template #title>用户管理</template></el-menu-item>
          <el-menu-item index="/notifications"><el-icon><Bell /></el-icon><template #title>通知记录</template></el-menu-item>

          <div v-show="!sidebarCollapsed" class="nav-group-label nav-group-label--spaced">官网内容</div>
          <el-menu-item index="/home-manage"><el-icon><Menu /></el-icon><template #title>首页管理</template></el-menu-item>
          <el-menu-item index="/doctor-manage"><el-icon><UserFilled /></el-icon><template #title>医生管理</template></el-menu-item>
          <el-menu-item index="/department-manage"><el-icon><Tickets /></el-icon><template #title>科室管理</template></el-menu-item>
          <el-menu-item index="/package-manage"><el-icon><Setting /></el-icon><template #title>套餐管理</template></el-menu-item>

          <div v-show="!sidebarCollapsed" class="nav-group-label nav-group-label--spaced">运营配置</div>
          <el-menu-item index="/configs"><el-icon><Setting /></el-icon><template #title>系统配置</template></el-menu-item>
          <el-menu-item index="/official-menu"><el-icon><Menu /></el-icon><template #title>公众号菜单</template></el-menu-item>
          <el-menu-item index="/official-auto-reply"><el-icon><ChatLineRound /></el-icon><template #title>自动回复</template></el-menu-item>
          <el-menu-item index="/followup-forward"><el-icon><Setting /></el-icon><template #title>回访接口</template></el-menu-item>

          <div v-show="!sidebarCollapsed" class="nav-group-label nav-group-label--spaced">安全管理</div>
          <el-menu-item index="/admin-users"><el-icon><UserFilled /></el-icon><template #title>成员与通知</template></el-menu-item>
          <el-menu-item index="/audit-logs"><el-icon><DocumentChecked /></el-icon><template #title>审计日志</template></el-menu-item>
        </el-menu>
      </nav>

      <div class="sidebar-footer">
        <span class="status-dot" />
        <span v-show="!sidebarCollapsed">系统运行中</span>
      </div>
    </el-aside>

    <el-container class="main-shell">
      <el-header class="header">
        <div class="header-left">
          <el-button class="collapse-button" text :aria-label="sidebarCollapsed ? '展开导航' : '收起导航'" @click="sidebarCollapsed = !sidebarCollapsed">
            <el-icon size="18"><Expand v-if="sidebarCollapsed" /><Fold v-else /></el-icon>
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
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import {
  ArrowDown,
  Bell,
  ChatLineRound,
  DataLine,
  DocumentChecked,
  Expand,
  Fold,
  Menu,
  Setting,
  SwitchButton,
  Tickets,
  User,
  UserFilled
} from '@element-plus/icons-vue';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const auth = useAuthStore();
const sidebarCollapsed = ref(false);

const pageTitles: Record<string, string> = {
  '/dashboard': '仪表盘',
  '/appointments': '挂号管理',
  '/users': '用户管理',
  '/notifications': '通知记录',
  '/home-manage': '首页管理',
  '/doctor-manage': '医生管理',
  '/department-manage': '科室管理',
  '/package-manage': '套餐管理',
  '/configs': '系统配置',
  '/official-menu': '公众号菜单',
  '/official-auto-reply': '自动回复',
  '/appointment-notify': '成员与通知',
  '/followup-forward': '回访接口',
  '/admin-users': '成员与通知',
  '/audit-logs': '审计日志'
};

const currentPageTitle = computed(() => pageTitles[route.path] || '管理后台');
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
  color: #8fb0aa;
  font-size: 12px;
}

.navigation {
  flex: 1;
  padding: 14px 10px;
  overflow-y: auto;
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
  color: #b9cbc7;
  border-radius: 6px;
}

.navigation :deep(.el-menu-item .el-icon) {
  width: 20px;
  margin-right: 12px;
  color: #8fb0aa;
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

.is-collapsed .navigation :deep(.el-menu-item) {
  justify-content: center;
  padding: 0 !important;
}

.is-collapsed .navigation :deep(.el-menu-item .el-icon) {
  margin: 0;
}

.sidebar-footer {
  display: flex;
  flex: 0 0 54px;
  align-items: center;
  gap: 9px;
  padding: 0 22px;
  color: #8fb0aa;
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
  background: #f3f7f6;
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
    width: 76px !important;
  }

  .brand-copy,
  .nav-group-label,
  .sidebar-footer span:not(.status-dot) {
    display: none !important;
  }

  .navigation :deep(.el-menu) {
    width: 56px;
  }

  .navigation :deep(.el-menu-item) {
    justify-content: center;
    padding: 0 !important;
  }

  .navigation :deep(.el-menu-item .el-icon) {
    margin: 0;
  }

  .main-shell,
  .is-collapsed .main-shell {
    margin-left: 76px;
  }

  .collapse-button {
    display: none;
  }
}

@media (max-width: 640px) {
  .aside {
    width: 64px !important;
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

  .navigation {
    padding-right: 4px;
    padding-left: 4px;
  }

  .navigation :deep(.el-menu) {
    width: 56px;
  }

  .main-shell,
  .is-collapsed .main-shell {
    margin-left: 64px;
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
