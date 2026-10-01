<template>
  <div v-if="!data" class="page-loading container" aria-live="polite"><span></span><span></span><span></span><p>正在整理今日口腔资讯…</p></div>
  <template v-else>
    <section class="home-intro">
      <div class="container intro-grid">
        <div class="intro-copy">
          <p class="eyebrow">{{ data.settings.siteTagline }}</p>
          <h1>{{ data.settings.heroTitle }}</h1>
          <p class="intro-lead">{{ data.settings.heroDescription }}</p>
          <form class="home-search" @submit.prevent="submitSearch"><label class="sr-only" for="home-keyword">搜索口腔资讯</label><input id="home-keyword" v-model="keyword" type="search" placeholder="搜索牙龈出血、儿童龋齿、矫正……" /><button type="submit">搜索资讯</button></form>
          <div class="topic-row"><span>资讯分类</span><RouterLink v-for="category in categories" :key="category.id" :to="{ path: '/articles', query: { category: category.id } }">{{ category.name }}</RouterLink></div>
        </div>
        <RouterLink v-if="leadArticle" :to="`/articles/${leadArticle.slug}`" class="lead-story">
          <div class="lead-cover" :class="{ placeholder: !leadArticle.coverUrl }"><img v-if="leadArticle.coverUrl" :src="leadArticle.coverUrl" :alt="leadArticle.title" fetchpriority="high" /><span v-else>今日<br>值得读</span></div>
          <div class="lead-body"><p>重点阅读 · {{ formatDate(leadArticle.publishedAt) }}</p><h2>{{ leadArticle.title }}</h2><span>{{ leadArticle.digest }}</span><b>阅读全文 →</b></div>
        </RouterLink>
        <div v-else class="lead-story lead-story-empty"><div><b>首篇资讯正在准备中</b><p>发布后的内容会自动出现在这里。</p></div></div>
      </div>
    </section>

    <section class="section latest-section">
      <div class="container">
        <div class="section-heading"><div><p class="eyebrow">LATEST STORIES</p><h2>最新口腔资讯</h2></div><RouterLink to="/articles" class="text-link">查看全部 →</RouterLink></div>
        <div v-if="otherArticles.length" class="story-grid">
          <RouterLink v-for="(article, index) in otherArticles" :key="article.id" :to="`/articles/${article.slug}`" class="story-card">
            <div class="story-cover" :class="{ placeholder: !article.coverUrl }"><img v-if="article.coverUrl" :src="article.coverUrl" :alt="article.title" loading="lazy" /><span v-else>{{ String(index + 1).padStart(2, '0') }}</span></div>
            <div class="story-body"><time>{{ formatDate(article.publishedAt) }}</time><h3>{{ article.title }}</h3><p>{{ article.digest || '阅读这篇口腔健康资讯。' }}</p><b>继续阅读</b></div>
          </RouterLink>
        </div>
        <div v-else class="empty-news">更多口腔资讯正在编辑中。</div>
      </div>
    </section>

    <section class="editorial-note"><div class="container editorial-inner"><span>内容原则</span><h2>讲依据，也讲人话。</h2><p>我们尽量交代信息适用的人群、边界和就医提示，不用夸张标题制造焦虑。</p></div></section>
  </template>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { formatDate, useSite } from '../site';
const { state } = useSite();
const router = useRouter();
const keyword = ref('');
const data = computed(() => state.data);
const leadArticle = computed(() => data.value?.articles[0]);
const otherArticles = computed(() => data.value?.articles.slice(1, 7) || []);
const categories = computed(() => data.value?.categories.slice(0, 6) || []);
function submitSearch() { void router.push({ path: '/articles', query: keyword.value.trim() ? { keyword: keyword.value.trim() } : {} }); }
</script>
