<template>
  <div class="page-heading"><h1 class="page-title">公众号菜单</h1></div>
  <div class="content-panel">
    <el-alert
      class="menu-tip"
      type="info"
      :closable="false"
      show-icon
      title="多个公众号菜单、阅读原文、二维码、推广页都可以使用下面生成的链接。source 用来区分来源，会写入挂号记录。"
    />

    <div class="section-heading"><h3>入口链接生成器</h3><p>不同入口使用独立来源标识，便于追踪预约渠道</p></div>
    <el-form label-width="120px" class="link-form">
      <el-form-item label="来源标识">
        <el-input v-model="entrySource" placeholder="例如 menu_main、article_01、qr_chongqing，只能用字母数字下划线" style="max-width: 420px" />
      </el-form-item>
      <el-form-item label="挂号链接">
        <div class="link-row">
          <el-input :model-value="landingOauthLink" readonly />
          <el-button @click="copyLink(landingOauthLink)">复制</el-button>
        </div>
      </el-form-item>
      <el-form-item label="我的挂号链接">
        <div class="link-row">
          <el-input :model-value="myOauthLink" readonly />
          <el-button @click="copyLink(myOauthLink)">复制</el-button>
        </div>
      </el-form-item>
      <el-form-item label="H5 落地页链接">
        <div class="link-row">
          <el-input :model-value="landingDirectLink" readonly />
          <el-button @click="copyLink(landingDirectLink)">复制</el-button>
        </div>
      </el-form-item>
    </el-form>

    <div class="section-heading menu-section-heading"><h3>公众号自定义菜单</h3><p>最多可添加 3 个一级菜单，每个一级菜单最多 5 个二级菜单</p></div>
    <div class="toolbar">
      <el-button @click="useStandardMenu">一键填入标准菜单</el-button>
      <el-button type="primary" @click="addTopButton" :disabled="menu.button.length >= 3">新增一级菜单</el-button>
      <el-button @click="saveMenu">保存配置</el-button>
      <el-button type="success" @click="publishMenu">发布到公众号</el-button>
    </div>

    <el-empty v-if="menu.button.length === 0" description="暂无菜单" />
    <div v-for="(button, index) in menu.button" :key="index" class="menu-block">
      <div class="menu-heading">
        <span><i>{{ index + 1 }}</i> 一级菜单</span>
        <el-button text type="danger" @click="removeTopButton(index)">删除</el-button>
      </div>
      <el-form label-width="100px">
        <el-form-item label="名称"><el-input v-model="button.name" maxlength="16" /></el-form-item>
        <template v-if="!button.sub_button?.length">
          <el-form-item label="类型">
            <el-select v-model="button.type" style="width: 180px">
              <el-option label="网页跳转" value="view" />
              <el-option label="点击事件" value="click" />
              <el-option label="小程序" value="miniprogram" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="button.type === 'view' || button.type === 'miniprogram'" label="URL">
            <el-input v-model="button.url" />
          </el-form-item>
          <el-form-item v-if="button.type === 'click'" label="Key">
            <el-input v-model="button.key" />
          </el-form-item>
          <template v-if="button.type === 'miniprogram'">
            <el-form-item label="AppID"><el-input v-model="button.appid" /></el-form-item>
            <el-form-item label="页面路径"><el-input v-model="button.pagepath" /></el-form-item>
          </template>
        </template>

        <el-form-item label="二级菜单">
          <el-button @click="addSubButton(button)" :disabled="(button.sub_button?.length || 0) >= 5">新增二级菜单</el-button>
        </el-form-item>
      </el-form>

      <div v-for="(child, childIndex) in button.sub_button || []" :key="childIndex" class="submenu-block">
        <div class="menu-heading">
          <span>二级菜单 {{ childIndex + 1 }}</span>
          <el-button text type="danger" @click="removeSubButton(button, childIndex)">删除</el-button>
        </div>
        <el-form label-width="100px">
          <el-form-item label="名称"><el-input v-model="child.name" maxlength="16" /></el-form-item>
          <el-form-item label="类型">
            <el-select v-model="child.type" style="width: 180px">
              <el-option label="网页跳转" value="view" />
              <el-option label="点击事件" value="click" />
              <el-option label="小程序" value="miniprogram" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="child.type === 'view' || child.type === 'miniprogram'" label="URL">
            <el-input v-model="child.url" />
          </el-form-item>
          <el-form-item v-if="child.type === 'click'" label="Key">
            <el-input v-model="child.key" />
          </el-form-item>
          <template v-if="child.type === 'miniprogram'">
            <el-form-item label="AppID"><el-input v-model="child.appid" /></el-form-item>
            <el-form-item label="页面路径"><el-input v-model="child.pagepath" /></el-form-item>
          </template>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  OfficialAccountMenuButton,
  OfficialAccountMenuConfig,
  getOfficialAccountMenu,
  publishOfficialAccountMenu,
  updateOfficialAccountMenu
} from '../api/admin';

const menu = reactive<OfficialAccountMenuConfig>({ button: [] });
const entrySource = ref('menu_main');
const publicBase = window.location.origin.includes('fxnadmin.')
  ? window.location.origin.replace('wechatadmin.', 'wechat.')
  : 'https://wechat.fuxiaonian.net';
const miniAppId = import.meta.env.VITE_MINI_APP_ID || 'wx99b598314f56c2f1';

const safeEntrySource = computed(() =>
  entrySource.value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 60) || 'menu_main'
);
const landingOauthLink = computed(() => `${publicBase}/wechat/oa/oauth?state=landing&source=${encodeURIComponent(safeEntrySource.value)}`);
const myOauthLink = computed(() => `${publicBase}/wechat/oa/oauth?state=my&source=${encodeURIComponent(safeEntrySource.value)}`);
const landingDirectLink = computed(() => `${publicBase}/?source=${encodeURIComponent(safeEntrySource.value)}`);

function blankButton(): OfficialAccountMenuButton {
  return { name: '', type: 'view', url: '' };
}

async function load() {
  const result = await getOfficialAccountMenu();
  menu.button = result.button || [];
}

function addTopButton() {
  if (menu.button.length < 3) {
    menu.button.push(blankButton());
  }
}

function removeTopButton(index: number) {
  menu.button.splice(index, 1);
}

function addSubButton(button: OfficialAccountMenuButton) {
  button.sub_button = button.sub_button || [];
  if (button.sub_button.length < 5) {
    button.sub_button.push(blankButton());
  }
}

function removeSubButton(button: OfficialAccountMenuButton, index: number) {
  button.sub_button?.splice(index, 1);
}

function useStandardMenu() {
  menu.button = [
    {
      name: '立即挂号',
      type: 'miniprogram',
      appid: miniAppId,
      pagepath: 'pages/landing/landing?source=official_menu',
      url: landingOauthLink.value
    },
    {
      name: '我的挂号',
      type: 'miniprogram',
      appid: miniAppId,
      pagepath: 'pages/appointments/appointments?source=official_menu',
      url: myOauthLink.value
    },
    { name: '联系客服', type: 'click', key: 'CONTACT_STAFF' }
  ];
}

async function copyLink(link: string) {
  try {
    await navigator.clipboard.writeText(link);
  } catch {
    const input = document.createElement('textarea');
    input.value = link;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }
  ElMessage.success('链接已复制');
}

async function saveMenu() {
  const payload = normalizeMenu();
  const saved = await updateOfficialAccountMenu(payload);
  menu.button = saved.button || payload.button;
  ElMessage.success('公众号菜单配置已保存');
}

async function publishMenu() {
  await saveMenu();
  await publishOfficialAccountMenu();
  ElMessage.success('公众号菜单已发布');
}

function normalizeMenu(): OfficialAccountMenuConfig {
  return {
    button: menu.button.map((item) => normalizeButton(item))
  };
}

function normalizeButton(button: OfficialAccountMenuButton): OfficialAccountMenuButton {
  const children = button.sub_button?.filter((item) => item.name?.trim()).map((item) => normalizeButton(item));
  if (children?.length) {
    return { name: button.name.trim(), sub_button: children };
  }
  const result: OfficialAccountMenuButton = { name: button.name.trim(), type: button.type || 'view' };
  if (result.type === 'view') {
    result.url = button.url?.trim();
  }
  if (result.type === 'click') {
    result.key = button.key?.trim();
  }
  if (result.type === 'miniprogram') {
    result.url = button.url?.trim();
    result.appid = button.appid?.trim();
    result.pagepath = button.pagepath?.trim();
  }
  return result;
}

onMounted(load);
</script>

<style scoped>
.page-heading { margin-bottom: 18px; }
.page-heading .page-title { margin-bottom: 2px; }
.page-heading p, .section-heading p { margin: 0; color: var(--admin-text-muted); font-size: 13px; }

.menu-tip {
  margin-bottom: 16px;
}

.section-heading {
  margin: 24px 0 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--admin-border);
}

.section-heading h3 { margin: 0 0 3px; font-size: 16px; }
.menu-section-heading { margin-top: 30px; }

.link-form { max-width: 900px; }

.link-row {
  display: flex;
  gap: 10px;
  width: 100%;
}

.menu-block {
  margin-top: 12px;
  padding: 18px;
  background: #fbfcfc;
  border: 1px solid var(--admin-border);
  border-radius: 6px;
}

.submenu-block {
  margin: 10px 0 12px 36px;
  padding: 14px;
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  background: #ffffff;
}

.menu-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-weight: 700;
}

.menu-heading i {
  display: inline-grid;
  width: 24px;
  height: 24px;
  margin-right: 7px;
  place-items: center;
  color: var(--admin-primary);
  background: var(--admin-primary-soft);
  border-radius: 4px;
  font-style: normal;
  font-size: 12px;
}

@media (max-width: 640px) {
  .link-row { align-items: stretch; flex-direction: column; }
  .submenu-block { margin-left: 0; }
  .link-form :deep(.el-form-item) { display: block; }
  .link-form :deep(.el-form-item__label) { display: block; width: auto !important; margin-bottom: 6px; text-align: left; }
}
</style>
