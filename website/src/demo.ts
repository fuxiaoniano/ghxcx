import type { Article, ArticleCategory, Bootstrap } from './api';

const demoCategories: ArticleCategory[] = [
  { id: 'daily', name: '日常护理', slug: 'daily-care' },
  { id: 'perio', name: '牙周健康', slug: 'periodontal-health' },
  { id: 'children', name: '儿童口腔', slug: 'children-dentistry' },
  { id: 'ortho', name: '牙齿矫正', slug: 'orthodontics' },
  { id: 'implant', name: '种植修复', slug: 'implant-restoration' }
];

export const demoArticles: Article[] = [
  { id: 'demo-1', slug: 'why-gums-bleed', title: '刷牙出血，不只是“上火”那么简单', category: demoCategories[1], author: '傅小念口腔资讯编辑部', digest: '牙龈出血常与菌斑和牙龈炎症有关。先从正确清洁开始，也要留意哪些情况需要尽快就医。', publishedAt: '2026-09-25T08:00:00+08:00', contentHtml: '<h2>先观察出血发生在什么时候</h2><p>偶尔因刷牙用力过大出现少量出血，与长期反复出血并不相同。若出血持续、伴有口臭或牙龈肿胀，建议尽早接受口腔检查。</p><h2>日常可以先做好三件事</h2><p>使用软毛牙刷、每天清洁牙缝，并保持规律刷牙。不要因为出血而停止清洁。</p>' },
  { id: 'demo-2', slug: 'children-fluoride-guide', title: '儿童涂氟怎么做？家长关心的 6 个问题', category: demoCategories[2], author: '傅小念口腔资讯编辑部', digest: '涂氟不是一劳永逸。频率、适龄阶段和日常刷牙一样重要。', publishedAt: '2026-09-23T08:00:00+08:00', contentHtml: '<h2>涂氟的作用是什么</h2><p>局部用氟可以增强牙齿表面对酸的抵抗力，是儿童龋病预防措施之一。具体频率应结合孩子的患龋风险由口腔专业人员判断。</p>' },
  { id: 'demo-3', slug: 'scaling-myths', title: '洗牙会让牙缝变大吗？三个常见误区一次说清', category: demoCategories[0], author: '傅小念口腔资讯编辑部', digest: '洁治后感觉牙缝明显，往往是原本占据牙缝的牙结石被清除，而不是洗牙把牙齿洗坏了。', publishedAt: '2026-09-20T08:00:00+08:00', contentHtml: '<h2>洗牙不会把健康牙齿“磨薄”</h2><p>规范的洁治用于去除牙结石和菌斑。治疗后短期敏感可以通过专业建议和日常护理改善。</p>' }
];
export const demoBootstrap: Bootstrap = {
  settings: {
    brandName: '傅小念口腔资讯', siteTagline: '把口腔知识讲清楚',
    heroTitle: '关于牙齿的事，值得认真弄明白',
    heroDescription: '从日常护理到就诊决策，用易懂、可靠的内容回答每一个真实的口腔健康问题。',
    topics: '牙周健康,儿童口腔,牙齿矫正,种植修复,日常护理',
    footerDescription: '用清晰、可靠的口腔健康内容，帮助每个人做出更安心的健康选择。',
    icpNumber: '', defaultAuthor: '傅小念口腔资讯编辑部'
  },
  categories: demoCategories,
  articles: demoArticles
};
