<template>
  <div class="page-heading">
    <div><h1 class="page-title">官网浏览统计</h1><p>统计官网独立访客人数，仅管理后台可见；同一访客在同一统计周期内只计算一次。</p></div>
    <el-button type="primary" :loading="loading" @click="load">刷新数据</el-button>
  </div>
  <div class="analytics-grid" v-loading="loading">
    <section v-for="item in cards" :key="item.key" class="content-panel analytics-card">
      <span>{{ item.label }}</span>
      <strong>{{ format(item.value) }}</strong>
      <small>{{ item.description }}</small>
    </section>
  </div>
  <div class="content-panel analytics-note">
    <h2>统计说明</h2>
    <p>系统通过不可逆匿名标识统计独立访客，不保存访客原始 IP。自动化爬虫、监控程序和命令行访问不会计入统计。</p>
    <p>统计日期按北京时间计算。今日、本周、本月和本年度数据会随自然周期自动重新计算，累计浏览人数不会清零。</p>
    <small v-if="summary">统计日期：{{ summary.statDate }}</small>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getWebsiteAnalytics, type WebsiteAnalyticsSummary } from '../api/admin';

const loading = ref(false);
const summary = ref<WebsiteAnalyticsSummary | null>(null);
const cards = computed(() => [
  { key: 'today', label: '今日浏览', value: summary.value?.today || 0, description: '今天访问官网的独立访客' },
  { key: 'week', label: '本周浏览', value: summary.value?.week || 0, description: '本周一至今天的独立访客' },
  { key: 'month', label: '本月浏览', value: summary.value?.month || 0, description: '本月 1 日至今天的独立访客' },
  { key: 'year', label: '本年度浏览', value: summary.value?.year || 0, description: '本年度 1 月 1 日至今天的独立访客' },
  { key: 'total', label: '总浏览', value: summary.value?.total || 0, description: '自启用统计以来的累计独立访客' }
]);
const format = (value: number) => new Intl.NumberFormat('zh-CN').format(value);
async function load() { loading.value = true; try { summary.value = await getWebsiteAnalytics(); } finally { loading.value = false; } }
onMounted(load);
</script>

<style scoped>
.page-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}.page-title{margin:0 0 6px}.page-heading p{margin:0;color:var(--admin-text-muted)}.analytics-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}.analytics-card{display:flex;min-height:150px;flex-direction:column;justify-content:center}.analytics-card span{color:var(--admin-text-muted);font-size:14px}.analytics-card strong{margin:12px 0 8px;color:var(--admin-primary);font-size:38px;line-height:1}.analytics-card small,.analytics-note p,.analytics-note small{color:var(--admin-text-muted)}.analytics-note{margin-top:18px}.analytics-note h2{margin:0 0 12px;font-size:18px}.analytics-note p{margin:6px 0;line-height:1.7}@media(max-width:1100px){.analytics-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){.page-heading{flex-direction:column}.page-heading .el-button{width:100%}.analytics-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.analytics-card:last-child{grid-column:1/-1}.analytics-card{min-height:128px}.analytics-card strong{font-size:32px}}@media(max-width:430px){.analytics-grid{grid-template-columns:1fr}.analytics-card:last-child{grid-column:auto}}
</style>
