<template>
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  <header class="site-header">
    <div class="top-line"><div class="container top-line-inner"><span>专业口腔医疗服务</span><span>{{ settings?.serviceHours }}<template v-if="settings?.phone"> · 咨询 {{ settings.phone }}</template></span></div></div>
    <div class="container nav-wrap">
      <RouterLink to="/" class="brand" aria-label="重庆种博士口腔首页">
        <span class="brand-mark" aria-hidden="true">Z</span>
        <span><strong>{{ settings?.brandName || '重庆种博士口腔' }}</strong><small>ZHONG BOSHI DENTAL</small></span>
      </RouterLink>
      <button class="mobile-menu-button" type="button" :aria-expanded="menuOpen" aria-label="打开网站导航" @click="menuOpen=!menuOpen"><span></span><span></span><span></span></button>
      <nav :class="['main-nav',{open:menuOpen}]" aria-label="主要导航" @click="menuOpen=false">
        <RouterLink to="/">首页</RouterLink><RouterLink to="/services">诊疗科室</RouterLink><RouterLink to="/doctors">医生团队</RouterLink><RouterLink to="/articles">口腔资讯</RouterLink>
        <RouterLink v-for="page in navPages" :key="page.id" :to="`/page/${page.slug}`">{{page.menuTitle}}</RouterLink>
      </nav>
      <div class="nav-actions">
        <button class="theme-toggle" type="button" :aria-label="dark?'切换日间模式':'切换夜间模式'" @click="toggleTheme">{{dark?'日间':'夜间'}}</button>
        <a class="button button-primary nav-appointment" :href="settings?.appointmentUrl || '/landing/default'">{{settings?.appointmentText || '在线预约'}}</a>
      </div>
    </div>
  </header>

  <main id="main-content" tabindex="-1">
    <div v-if="state.error && !state.data" class="state-card container"><p>{{state.error}}</p><button class="button button-primary" @click="reload">重新加载</button></div>
    <RouterView v-else />
  </main>

  <footer class="site-footer">
    <div class="container footer-grid">
      <div><div class="footer-brand">{{settings?.brandName || '重庆种博士口腔'}}</div><p>{{settings?.footerDescription}}</p></div>
      <div><h2>快捷导航</h2><RouterLink to="/services">诊疗科室</RouterLink><RouterLink to="/doctors">医生团队</RouterLink><RouterLink to="/articles">口腔资讯</RouterLink></div>
      <div><h2>联系与服务</h2><p>{{settings?.serviceHours}}</p><p v-if="settings?.address">{{settings.address}}</p><a v-if="settings?.phone" :href="`tel:${settings.phone}`">{{settings.phone}}</a></div>
    </div>
    <div class="container footer-bottom"><span>© {{new Date().getFullYear()}} {{settings?.brandName || '重庆种博士口腔'}}</span><a v-if="settings?.icpNumber" class="icp-link" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">{{settings.icpNumber}}</a><span>医疗信息仅供参考，具体诊疗请遵医嘱</span></div>
  </footer>
  <div :class="['mobile-actions',{single:!settings?.phone}]"><a v-if="settings?.phone" :href="`tel:${settings.phone}`">电话咨询</a><a :href="settings?.appointmentUrl || '/landing/default'">在线预约</a></div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { loadSite, useSite } from './site';

const {state,settings,reload}=useSite();
const menuOpen=ref(false);
const stored=localStorage.getItem('website-theme');
const dark=ref(stored?stored==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches);
const navPages=computed(()=>state.data?.pages.filter(page=>page.showInNav) || []);
function applyTheme(){document.documentElement.dataset.theme=dark.value?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark.value?'#101722':'#ffffff');}
function toggleTheme(){dark.value=!dark.value;localStorage.setItem('website-theme',dark.value?'dark':'light');applyTheme();}
applyTheme();onMounted(loadSite);
</script>
