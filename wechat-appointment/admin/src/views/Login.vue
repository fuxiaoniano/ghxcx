<template>
  <main class="login-page">
    <section class="login-shell">
      <div class="identity-panel">
        <div class="identity-brand">
          <span class="identity-mark">种</span>
          <div><strong>傅小念的运营工作台</strong></div>
        </div>
        <div class="identity-message">
          <span class="identity-label">运营工作台</span>
          <h1>让每一条预约<br />都被及时跟进</h1>
          <p>统一管理预约、用户、通知与公众号运营。</p>
        </div>
        <div class="identity-footer"><el-icon><Lock /></el-icon><span>安全登录 · 操作全程留痕</span></div>
      </div>

      <div class="login-panel">
        <div class="mobile-brand"><span class="identity-mark">管</span><strong>傅小念的运营工作台</strong></div>
        <div class="form-heading">
          <span>ADMIN CONSOLE</span>
          <h2>{{ loginMode === 'wechat' ? '微信扫码登录' : '账号密码登录' }}</h2>
          <p>{{ loginMode === 'wechat' ? '请使用已绑定后台账号的微信扫码确认' : '请输入管理后台账号和密码' }}</p>
        </div>

        <div class="login-mode-switch"><el-button :type="loginMode === 'password' ? 'primary' : 'default'" @click="selectMode('password')">账号密码</el-button><el-button :type="loginMode === 'wechat' ? 'primary' : 'default'" @click="selectMode('wechat')">微信扫码</el-button></div>

        <div v-if="loginMode === 'wechat'" class="wechat-login">
          <div class="qr-frame" :class="{ 'is-disabled': qrStatus !== 'PENDING' }">
            <QrcodeVue v-if="session.oauthUrl" :value="session.oauthUrl" :size="206" level="M" />
            <div v-else class="qr-loading"><el-icon class="is-loading" size="28"><Loading /></el-icon><span>正在生成登录二维码</span></div>
            <div v-if="qrStatus !== 'PENDING'" class="qr-overlay">
              <el-icon v-if="qrStatus === 'CONFIRMED'" size="34" color="#159174"><CircleCheckFilled /></el-icon>
              <el-icon v-else size="34" color="#909399"><WarningFilled /></el-icon>
              <strong>{{ qrStatus === 'CONFIRMED' ? '登录成功' : '二维码已失效' }}</strong>
              <el-button v-if="qrStatus !== 'CONFIRMED'" type="primary" size="small" @click="createSession">刷新二维码</el-button>
            </div>
          </div>
          <div class="scan-status">
            <el-icon><FullScreen /></el-icon>
            <span>{{ statusText }}</span>
          </div>
          <a v-if="session.oauthUrl" class="pc-wechat-link" :href="session.oauthUrl" target="_blank" rel="noopener">
            <el-icon><Monitor /></el-icon>在当前电脑打开微信授权
          </a>
          <small class="pc-tip">电脑浏览器无法直接读取微信账号；上方入口会打开微信官方授权页。</small>
        </div>

        <div v-else class="fallback-login">
            <el-form :model="form" label-position="top" @keyup.enter="submitPassword">
              <el-form-item label="管理员账号">
                <el-input v-model="form.username" autocomplete="username" placeholder="请输入管理员账号"><template #prefix><el-icon><User /></el-icon></template></el-input>
              </el-form-item>
              <el-form-item label="密码">
                <el-input v-model="form.password" type="password" autocomplete="current-password" placeholder="请输入登录密码" show-password><template #prefix><el-icon><Key /></el-icon></template></el-input>
              </el-form-item>
              <el-button type="primary" :loading="passwordLoading" class="password-button" @click="submitPassword">账号密码登录</el-button>
            </el-form>
        </div>
        <p class="form-footer">仅限已授权的工作人员使用</p>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { CircleCheckFilled, FullScreen, Key, Loading, Lock, Monitor, User, WarningFilled } from '@element-plus/icons-vue';
import QrcodeVue from 'qrcode.vue';
import { createAdminWechatLoginSession, getAdminLoginPreference, pollAdminWechatLoginSession } from '../api/admin';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const passwordLoading = ref(false);
const loginMode = ref<'password' | 'wechat'>('password');
const qrStatus = ref<'PENDING' | 'CONFIRMED' | 'ERROR' | 'EXPIRED'>('PENDING');
const qrMessage = ref('');
const session = reactive({ sessionId: '', oauthUrl: '' });
const form = reactive({ username: 'admin', password: '' });
let pollTimer: number | undefined;
let creating = false;

const statusText = computed(() => {
  if (qrStatus.value === 'CONFIRMED') return '身份确认成功，正在进入后台';
  if (qrStatus.value === 'ERROR') return qrMessage.value || '此微信尚未绑定后台账号';
  if (qrStatus.value === 'EXPIRED') return '二维码已过期，请刷新';
  return '打开微信扫一扫，确认后自动登录';
});

async function createSession() {
  if (creating) return;
  creating = true;
  stopPolling();
  qrStatus.value = 'PENDING';
  qrMessage.value = '';
  session.sessionId = '';
  session.oauthUrl = '';
  try {
    const result = await createAdminWechatLoginSession();
    session.sessionId = result.sessionId;
    session.oauthUrl = result.oauthUrl;
    pollTimer = window.setInterval(pollSession, 1800);
  } catch {
    qrStatus.value = 'ERROR';
    qrMessage.value = '登录服务暂时不可用，请刷新二维码重试';
  } finally {
    creating = false;
  }
}

async function pollSession() {
  if (!session.sessionId || qrStatus.value !== 'PENDING') return;
  try {
    const result = await pollAdminWechatLoginSession(session.sessionId);
    const status = result.status || 'PENDING';
    if (status === 'PENDING') return;
    qrStatus.value = status;
    qrMessage.value = result.message || '';
    stopPolling();
    if (status === 'CONFIRMED' && result.token && result.user) {
      auth.acceptLogin({ token: result.token, user: result.user });
      window.setTimeout(() => router.replace('/dashboard'), 450);
    }
  } catch {
    qrStatus.value = 'ERROR';
    qrMessage.value = '无法获取登录状态，请刷新二维码重试';
    stopPolling();
  }
}

function stopPolling() {
  if (pollTimer !== undefined) {
    window.clearInterval(pollTimer);
    pollTimer = undefined;
  }
}

function selectMode(mode: 'password' | 'wechat') {
  if (loginMode.value === mode) return;
  loginMode.value = mode;
  if (mode === 'wechat') void createSession();
  else stopPolling();
}

async function submitPassword() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入账号和密码');
    return;
  }
  passwordLoading.value = true;
  try {
    await auth.login(form.username, form.password);
    await router.push('/dashboard');
  } finally {
    passwordLoading.value = false;
  }
}

onMounted(async () => {
  try {
    const preference = await getAdminLoginPreference();
    if (preference.defaultWechatLogin) selectMode('wechat');
  } catch {
    // 配置不可用时保留账号密码登录入口。
  }
});
onBeforeUnmount(stopPolling);
</script>

<style scoped>
.login-page { display: grid; min-height: 100vh; padding: 32px; place-items: center; background: #f5f5f7; }
.login-shell { display: grid; width: min(940px, 100%); min-height: 640px; grid-template-columns: minmax(340px, .9fr) minmax(420px, 1.1fr); overflow: hidden; background: #fff; border: 1px solid #e5e5ea; border-radius: 18px; box-shadow: 0 12px 40px rgba(0, 0, 0, .06); }
.identity-panel { position: relative; display: flex; flex-direction: column; justify-content: space-between; padding: 42px; overflow: hidden; color: var(--admin-text); background: #e8f2ff; }
.identity-brand, .mobile-brand, .identity-footer, .scan-status, .pc-wechat-link { display: flex; align-items: center; }
.identity-brand, .mobile-brand { gap: 12px; }
.identity-mark { display: grid; flex: 0 0 42px; width: 42px; height: 42px; place-items: center; color: #fff; background: var(--admin-primary); border: 0; border-radius: 14px; font-size: 19px; font-weight: 750; }
.identity-brand > div { display: flex; flex-direction: column; }
.identity-brand strong { font-size: 17px; }
.identity-brand span:last-child { color: var(--admin-text-muted); font-size: 12px; }
.identity-message { position: relative; z-index: 1; }
.identity-label, .form-heading > span { color: var(--admin-primary); font-size: 11px; font-weight: 700; }
.identity-message h1 { margin: 18px 0; font-size: 36px; font-weight: 680; line-height: 1.35; letter-spacing: 0; }
.identity-message p { margin: 0; color: var(--admin-text-secondary); font-size: 14px; }
.identity-footer { position: relative; z-index: 1; gap: 8px; color: var(--admin-text-muted); font-size: 12px; }
.login-panel { display: flex; flex-direction: column; justify-content: center; padding: 38px 72px; }
.mobile-brand { display: none; }
.form-heading { margin-bottom: 18px; text-align: center; }
.form-heading h2 { margin: 7px 0 5px; color: var(--admin-text); font-size: 25px; letter-spacing: 0; }
.form-heading p, .form-footer { margin: 0; color: var(--admin-text-muted); }
.wechat-login { display: flex; flex-direction: column; align-items: center; }
.qr-frame { position: relative; display: grid; width: 232px; height: 232px; padding: 12px; place-items: center; background: #fff; border: 1px solid var(--admin-border); border-radius: 18px; }
.qr-loading { display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--admin-text-muted); font-size: 12px; }
.qr-frame.is-disabled > canvas { opacity: .14; }
.qr-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; background: rgba(255,255,255,.86); }
.scan-status { min-height: 34px; gap: 7px; margin-top: 8px; color: var(--admin-text-secondary); font-size: 13px; }
.pc-wechat-link { gap: 6px; color: var(--admin-primary); font-size: 13px; font-weight: 600; text-decoration: none; }
.pc-wechat-link:hover { text-decoration: underline; }
.pc-tip { margin-top: 5px; color: var(--admin-text-muted); font-size: 11px; text-align: center; }
.fallback-login { width: 100%; margin-top: 13px; }
.login-mode-switch { display: flex; justify-content: center; margin-bottom: 18px; }
.login-mode-switch .el-button { min-width: 120px; }
.fallback-login :deep(.el-collapse-item__header) { justify-content: center; color: var(--admin-text-muted); font-size: 12px; }
.fallback-login :deep(.el-collapse-item__wrap) { border-bottom: 0; }
.fallback-login :deep(.el-form-item) { margin-bottom: 14px; }
.password-button { width: 100%; }
.form-footer { margin-top: 12px; text-align: center; font-size: 11px; }
@media (max-width: 780px) {
  .login-page { padding: 20px; }
  .login-shell { min-height: auto; grid-template-columns: 1fr; }
  .identity-panel { display: none; }
  .login-panel { padding: 36px 34px; }
  .mobile-brand { display: flex; margin-bottom: 26px; }
  .mobile-brand strong { font-size: 17px; }
}
@media (max-width: 420px) {
  .login-page { align-items: stretch; padding: 0; background: #fff; }
  .login-shell { border: 0; box-shadow: none; }
  .login-panel { padding: 28px 22px; }
}
</style>
