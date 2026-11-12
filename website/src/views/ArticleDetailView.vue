<template>
  <article v-if="article" class="article-detail">
    <header class="article-header"><div class="article-narrow"><div class="breadcrumb"><RouterLink to="/">首页</RouterLink><span>/</span><RouterLink to="/articles">口腔资讯</RouterLink></div><p class="eyebrow">{{ article.category?.name || 'ORAL HEALTH ARTICLE' }}</p><h1>{{ article.title }}</h1><p v-if="article.digest" class="article-intro">{{ article.digest }}</p><div class="article-meta"><span>作者：{{ article.author || settings?.defaultAuthor }}</span><time>发布于 {{ formatDate(article.publishedAt) }}</time></div></div></header>
    <div class="article-narrow article-layout">
      <div class="wechat-content" v-html="article.contentHtml"></div>
      <div class="article-disclaimer"><strong>健康提示</strong><p>本文用于口腔健康知识普及，不能替代医生面诊。若症状持续、加重或影响进食，请及时就医。</p></div>
      <div class="article-end"><RouterLink to="/articles">← 返回全部资讯</RouterLink><a v-if="article.originalUrl" :href="article.originalUrl" target="_blank" rel="noopener noreferrer">参考来源</a></div>
    </div>
  </article>
  <div v-else class="state-card container">{{ error || '正在加载资讯…' }}</div>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { Article, websiteApi } from '../api';
import { clearArticleSchema, formatDate, setArticleSchema, setSeo, useSite } from '../site';
const route = useRoute(); const article = ref<Article | null>(null); const error = ref(''); const { settings } = useSite();
async function load() {
  article.value = null; error.value = '';
  try {
    article.value = await websiteApi.article(String(route.params.slug));
    setSeo({ title: article.value.seoTitle || `${article.value.title}｜傅小念口腔资讯`, description: article.value.seoDescription || article.value.digest, keywords: article.value.seoKeywords, image: article.value.coverUrl, canonicalPath: route.path, type: 'article', publishedAt: article.value.publishedAt, author: article.value.author });
    setArticleSchema(article.value);
  } catch (e) { error.value = e instanceof Error ? e.message : '文章加载失败'; }
}
watch(() => route.params.slug, load, { immediate: true });
onBeforeUnmount(clearArticleSchema);
</script>
