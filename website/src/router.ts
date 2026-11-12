import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';
import { setSeo } from './site';

const ArticlesView = () => import('./views/ArticlesView.vue');
const ArticleDetailView = () => import('./views/ArticleDetailView.vue');
const DisclaimerView = () => import('./views/DisclaimerView.vue');

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: (_to, _from, saved) => saved || { top: 0 },
  routes: [
    { path: '/', component: HomeView, meta: { title: '傅小念口腔资讯｜把口腔知识讲清楚' } },
    { path: '/articles', component: ArticlesView, meta: { title: '全部口腔资讯｜傅小念口腔资讯' } },
    { path: '/articles/:slug', component: ArticleDetailView },
    { path: '/disclaimer', component: DisclaimerView, meta: { title: '免责声明｜傅小念口腔资讯' } },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
});

router.afterEach((to) => {
  setSeo({ title: String(to.meta.title || '傅小念口腔资讯'), canonicalPath: to.path });
  requestAnimationFrame(() => document.querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true }));
});
export default router;
