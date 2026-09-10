import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';

const ServicesView = () => import('./views/ServicesView.vue');
const DoctorsView = () => import('./views/DoctorsView.vue');
const DoctorDetailView = () => import('./views/DoctorDetailView.vue');
const ArticlesView = () => import('./views/ArticlesView.vue');
const ArticleDetailView = () => import('./views/ArticleDetailView.vue');
const ContentPageView = () => import('./views/ContentPageView.vue');

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: (_to, _from, saved) => saved || { top: 0 },
  routes: [
    { path: '/', component: HomeView, meta: { title: '重庆种博士口腔｜专业口腔医疗服务' } },
    { path: '/services', component: ServicesView, meta: { title: '诊疗科室｜重庆种博士口腔' } },
    { path: '/doctors', component: DoctorsView, meta: { title: '医生团队｜重庆种博士口腔' } },
    { path: '/doctors/:id', component: DoctorDetailView },
    { path: '/articles', component: ArticlesView, meta: { title: '口腔资讯｜重庆种博士口腔' } },
    { path: '/articles/:slug', component: ArticleDetailView },
    { path: '/page/:slug', component: ContentPageView }
  ]
});

router.afterEach((to) => {
  document.title = String(to.meta.title || '重庆种博士口腔');
  requestAnimationFrame(() => document.querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true }));
});

export default router;
