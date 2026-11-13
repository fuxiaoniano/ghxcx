<template>
  <section class="archive-hero"><div class="container"><h1>{{ articleName }}</h1></div></section>
  <section class="section archive-section"><div class="container">
    <form class="article-search" @submit.prevent="search"><label for="article-keyword">搜索资讯</label><div><input id="article-keyword" v-model="keyword" type="search" placeholder="输入关键词" /><button class="button button-primary" type="submit">搜索</button></div></form>
    <div class="quick-topics"><button type="button" :class="{ active: !categoryId }" @click="pickCategory('')">全部资讯</button><button v-for="category in categories" :key="category.id" type="button" :class="{ active: categoryId === category.id }" @click="pickCategory(category.id)">{{ category.name }}</button></div>
    <div v-if="loading" class="state-card">正在加载{{ articleName }}…</div>
    <div v-else-if="error" class="state-card"><p>{{ error }}</p><button class="button button-primary" @click="load">重新加载</button></div>
    <div v-else-if="!result.list.length" class="state-card">暂未找到相关资讯，请更换分类或关键词。</div>
    <div v-else class="archive-list"><RouterLink v-for="article in result.list" :key="article.id" :to="`/articles/${article.slug}`" class="archive-item"><div class="archive-cover" :class="{ placeholder: !article.coverUrl }"><img v-if="article.coverUrl" :src="article.coverUrl" :alt="article.title" loading="lazy" /><span v-else>{{ isAfterbeat ? 'AFTER\nBEAT' : 'ORAL\nHEALTH' }}</span></div><div><div class="archive-meta"><span>{{ article.category?.name }}</span><time>{{ formatDate(article.publishedAt) }}</time></div><h2>{{ article.title }}</h2><p>{{ article.digest || `阅读这篇${articleName}。` }}</p><b>阅读全文 →</b></div></RouterLink></div>
    <div v-if="result.total > result.pageSize" class="pagination"><button :disabled="page <= 1" @click="go(page - 1)">上一页</button><span>第 {{ page }} 页</span><button :disabled="page * result.pageSize >= result.total" @click="go(page + 1)">下一页</button></div>
  </div></section>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { Article, SITE_KEY, websiteApi } from '../api';
import { formatDate, useSite } from '../site';
const route = useRoute(); const router = useRouter(); const { state } = useSite();
const keyword = ref(String(route.query.keyword || '')); const categoryId = ref(String(route.query.category || '')); const page = ref(1); const loading = ref(true); const error = ref('');
const categories = computed(() => state.data?.categories || []);
const isAfterbeat = SITE_KEY === 'afterbeat'; const articleName = isAfterbeat ? '热点新闻' : '口腔资讯';
const result = reactive<{ total: number; pageSize: number; list: Article[] }>({ total: 0, pageSize: 12, list: [] });
async function load() { loading.value = true; error.value = ''; try { Object.assign(result, await websiteApi.articles(page.value, keyword.value, categoryId.value)); } catch (e) { error.value = e instanceof Error ? e.message : `${articleName}加载失败`; } finally { loading.value = false; } }
function updateRoute() { void router.replace({ query: { ...(keyword.value.trim() ? { keyword: keyword.value.trim() } : {}), ...(categoryId.value ? { category: categoryId.value } : {}) } }); }
function search() { page.value = 1; updateRoute(); void load(); }
function pickCategory(id: string) { categoryId.value = id; page.value = 1; updateRoute(); void load(); }
function go(value: number) { page.value = value; void load(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
watch(() => [route.query.keyword, route.query.category], ([nextKeyword, nextCategory]) => {
  const nextK = String(nextKeyword || ''); const nextC = String(nextCategory || '');
  if (nextK !== keyword.value || nextC !== categoryId.value) { keyword.value = nextK; categoryId.value = nextC; page.value = 1; void load(); }
});
onMounted(load);
</script>
