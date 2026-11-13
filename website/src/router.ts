import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';
import { setSeo } from './site';
import { SITE_KEY } from './api';

const ArticlesView = () => import('./views/ArticlesView.vue');
const ArticleDetailView = () => import('./views/ArticleDetailView.vue');
const DisclaimerView = SITE_KEY === 'afterbeat' ? () => import('./views/AfterbeatDisclaimerView.vue') : () => import('./views/DisclaimerView.vue');
const siteName = SITE_KEY === 'afterbeat' ? 'AfterBeat' : '傅小念口腔资讯';
const articleName = SITE_KEY === 'afterbeat' ? '热点新闻' : '口腔资讯';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: (_to, _from, saved) => saved || { top: 0 },
  routes: [
    { path: '/', component: HomeView, meta: { title: `${siteName}｜${SITE_KEY === 'afterbeat' ? '热点正在发生' : '把口腔知识讲清楚'}` } },
    { path: '/articles', component: ArticlesView, meta: { title: `全部${articleName}｜${siteName}` } },
    { path: '/articles/:slug', component: ArticleDetailView },
    { path: '/disclaimer', component: DisclaimerView, meta: { title: `免责声明｜${siteName}` } },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
});

router.afterEach((to) => {
  setSeo({ title: String(to.meta.title || siteName), canonicalPath: to.path });
  requestAnimationFrame(() => document.querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true }));
});
export default router;
