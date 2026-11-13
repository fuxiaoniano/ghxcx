<template>
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  <header class="site-header">
    <div class="container header-inner">
      <RouterLink to="/" class="brand" :aria-label="`${fallbackName}首页`">
        <span class="brand-mark" aria-hidden="true">{{ isAfterbeat ? 'A' : '牙' }}</span>
        <span class="brand-copy"><strong>{{ settings?.brandName || fallbackName }}</strong><small>{{ settings?.siteTagline || fallbackTagline }}</small></span>
      </RouterLink>
      <button class="mobile-menu-button" type="button" :aria-expanded="menuOpen" aria-label="打开网站导航" @click="menuOpen = !menuOpen"><span></span><span></span><span></span></button>
      <nav :class="['main-nav', { open: menuOpen }]" aria-label="主要导航" @click="menuOpen = false">
        <RouterLink to="/" :class="{ active: route.path === '/' }">首页</RouterLink><RouterLink to="/articles" :class="{ active: route.path.startsWith('/articles') && !route.query.category }">全部资讯</RouterLink>
        <RouterLink v-for="category in categories.slice(0, 4)" :key="category.id" :to="{ path: '/articles', query: { category: category.id } }" :class="{ active: route.path === '/articles' && route.query.category === category.id }">{{ category.name }}</RouterLink>
      </nav>
      <RouterLink class="header-search" to="/articles" :aria-label="`搜索${isAfterbeat ? '热点新闻' : '口腔资讯'}`">搜索</RouterLink>
    </div>
  </header>
  <main id="main-content" tabindex="-1">
    <div v-if="state.error && !state.data" class="state-card container"><p>{{ state.error }}</p><button class="button button-primary" @click="reload">重新加载</button></div>
    <RouterView v-else />
  </main>
  <footer class="site-footer">
    <div class="container footer-main">
      <div><div class="footer-brand">{{ settings?.brandName || fallbackName }}</div><p>{{ settings?.footerDescription || fallbackFooter }}</p></div>
      <div class="footer-links"><RouterLink to="/">首页</RouterLink><RouterLink to="/articles">全部资讯</RouterLink><RouterLink to="/disclaimer">免责声明</RouterLink><a href="mailto:fuxiaonian@foxmail.com">内容联系</a></div>
    </div>
    <div class="container footer-bottom"><span>© {{ new Date().getFullYear() }} {{ settings?.brandName || fallbackName }}</span><a v-if="settings?.icpNumber" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">{{ settings.icpNumber }}</a><span>{{ isAfterbeat ? '内容仅供信息参考' : '健康信息仅供科普参考，不能替代医生诊断' }}</span></div>
  </footer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { loadSite, useSite } from './site';
import { SITE_KEY } from './api';
const { state, settings, reload } = useSite();
const route = useRoute();
const menuOpen = ref(false);
const isAfterbeat = SITE_KEY === 'afterbeat';
const fallbackName = isAfterbeat ? 'AfterBeat' : '傅小念口腔资讯';
const fallbackTagline = isAfterbeat ? '热点正在发生' : '把口腔知识讲清楚';
const fallbackFooter = isAfterbeat ? '持续关注热点，提供清晰、有价值的信息。' : '用清晰、可靠的口腔健康内容，帮助每个人做出更安心的健康选择。';
const categories = computed(() => state.data?.categories || []);
onMounted(loadSite);
</script>
