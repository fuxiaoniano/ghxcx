<template>
  <section class="sender-settings">
    <div class="page-heading">
      <div><h1 class="page-title">专用微信发送账号</h1><p>微信群挂号通知使用独立的个人微信发送端，与现有公众号管理员扫码登录完全分开。</p></div>
      <el-button :loading="loading" @click="load">刷新连接状态</el-button>
    </div>

    <el-alert v-if="overview && !overview.transportReady" type="warning" show-icon :closable="false" :title="overview.blocker" />

    <div class="settings-grid">
      <article class="content-panel settings-card">
        <h2>账号绑定状态</h2>
        <div v-if="!overview?.senders.length" class="empty-state">尚未绑定专用微信账号</div>
        <div v-for="sender in overview?.senders || []" :key="sender.id" class="sender-row">
          <el-tag :type="sender.status === 'ONLINE' ? 'success' : 'warning'">{{ statusText(sender.status) }}</el-tag>
          <strong>{{ sender.nickname || '未识别昵称' }}</strong>
          <span>微信版本：{{ sender.clientVersion || '未知' }}</span>
          <span>适配器：{{ sender.adapterVersion || '未接入' }}</span>
          <span>最近心跳：{{ formatTime(sender.lastHeartbeatAt) }}</span>
        </div>
        <el-button type="primary" disabled class="bind-button">扫码绑定专用微信（发送端未就绪）</el-button>
        <p class="hint">当前不会生成二维码，也不会使用公众号 OAuth 登录二维码代替。完成发送端联调后，才会开放手机扫码确认。</p>
        <p class="hint">本地电脑关机后继续发送的前提是：微信客户端和发送程序运行在独立、持续在线的主机或经验证的托管服务上。仅在本地电脑扫码登录无法满足这个条件。</p>
      </article>

      <article class="content-panel settings-card">
        <h2>接入条件</h2>
        <ol>
          <li>准备由机构控制的专用微信号，并加入两个测试群。</li>
          <li>提供持续在线的交互式桌面发送端，或经过真实验证、具有合法授权的 Linux 适配服务。</li>
          <li>完成扫码登录、掉线恢复、稳定群标识、真实发群与群会话核对测试。</li>
          <li>验证通过后由有权限的管理员在此页绑定，再配置留资页面路由。</li>
        </ol>
        <el-button @click="router.push('/wechat-group-notifications')">返回微信群挂号通知</el-button>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { http } from '../api/http';

interface Sender { id: string; status: string; nickname: string | null; clientVersion: string | null; adapterVersion: string | null; lastHeartbeatAt: string | null }
interface Overview { transportReady: boolean; blocker: string; senders: Sender[] }
const router = useRouter();
const overview = ref<Overview | null>(null);
const loading = ref(false);
const statusText = (status: string) => ({ ONLINE: '已登录', OFFLINE: '离线', SCAN_PENDING: '待扫码', PHONE_CONFIRM_PENDING: '待手机确认', RELOGIN_REQUIRED: '需重新扫码', UNAVAILABLE: '发送端不可用' } as Record<string, string>)[status] || '状态未知';
const formatTime = (value: string | null) => value ? new Date(value).toLocaleString('zh-CN') : '暂无';
async function load() {
  loading.value = true;
  try { overview.value = await http.get('/api/admin/wechat-group-notifications/overview') as unknown as Overview; }
  finally { loading.value = false; }
}
onMounted(() => { void load(); });
</script>

<style scoped>
.sender-settings { min-width: 0; }
.settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
.settings-card { padding: 20px; min-width: 0; }
.settings-card h2 { margin: 0 0 16px; font-size: 18px; }
.empty-state { padding: 24px 0; color: #6e6e73; }
.sender-row { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin-bottom: 16px; }
.sender-row span { overflow-wrap: anywhere; }
.bind-button { max-width: 100%; white-space: normal; height: auto; min-height: 36px; }
.hint, li { color: #6e6e73; line-height: 1.65; }
ol { padding-left: 22px; }
li + li { margin-top: 8px; }
@media (max-width: 768px) { .settings-grid { grid-template-columns: 1fr; } .settings-card { padding: 14px; } }
</style>
