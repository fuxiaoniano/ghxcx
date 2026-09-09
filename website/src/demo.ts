import type { Article, Bootstrap, Department, Doctor, WebsitePage } from './api';

export const demoCategories: Department[] = [
  { id: 'implant', name: '数字化种植', icon: '', projects: [
    { id: 'implant-single', categoryId: 'implant', name: '单颗牙种植', description: '针对单颗缺牙进行系统检查与种植修复方案设计。' },
    { id: 'implant-multi', categoryId: 'implant', name: '多颗牙种植', description: '综合评估牙槽骨与咬合关系，制定个性化修复计划。' },
    { id: 'implant-full', categoryId: 'implant', name: '全口种植修复', description: '面向全口或半口缺牙人群的综合种植修复服务。' }
  ] },
  { id: 'orthodontics', name: '牙齿矫正', icon: '', projects: [
    { id: 'ortho-invisible', categoryId: 'orthodontics', name: '隐形矫正', description: '兼顾美观与日常便利的数字化矫正方案。' },
    { id: 'ortho-fixed', categoryId: 'orthodontics', name: '固定矫正', description: '由医生结合牙列情况制定规范的固定矫治计划。' }
  ] },
  { id: 'restoration', name: '美学修复', icon: '', projects: [
    { id: 'restoration-crown', categoryId: 'restoration', name: '全瓷修复', description: '重视形态、颜色与咬合协调的牙体修复。' },
    { id: 'restoration-veneer', categoryId: 'restoration', name: '瓷贴面', description: '在专业评估基础上改善牙齿外观与协调度。' }
  ] },
  { id: 'periodontal', name: '牙周诊疗', icon: '', projects: [
    { id: 'perio-basic', categoryId: 'periodontal', name: '牙周基础治疗', description: '针对牙龈出血、牙周炎等问题开展检查与治疗。' },
    { id: 'perio-care', categoryId: 'periodontal', name: '牙周维护', description: '提供治疗后的定期复查与口腔卫生指导。' }
  ] },
  { id: 'children', name: '儿童齿科', icon: '', projects: [
    { id: 'child-prevention', categoryId: 'children', name: '儿童口腔预防', description: '通过检查、涂氟和窝沟封闭等方式守护乳恒牙健康。' },
    { id: 'child-treatment', categoryId: 'children', name: '儿童牙病诊疗', description: '重视沟通与舒适体验的儿童口腔诊疗服务。' }
  ] },
  { id: 'general', name: '综合齿科', icon: '', projects: [
    { id: 'general-root', categoryId: 'general', name: '显微根管治疗', description: '针对牙髓及根尖周问题开展精细化诊疗。' },
    { id: 'general-extract', categoryId: 'general', name: '复杂牙拔除', description: '经影像检查与风险评估后制定规范处置方案。' }
  ] }
];

export const demoDoctors: Doctor[] = [
  { id: 'demo-doctor-1', name: '周医生', avatar: '', title: '种植学科医生', displayText: '数字化种植诊疗', specialty: '擅长缺失牙种植修复、复杂种植评估及种植后的长期维护。', description: '长期从事口腔种植与修复临床工作，重视充分沟通、规范检查和个性化方案设计。', recommend: true, departments: [demoCategories[0]], clinic: { id: 'demo-clinic', name: '重庆种博士口腔总院', address: '重庆市' }, schedules: [{ id: 's1', date: '2026-09-10', timeSlot: '上午', capacity: 10, bookedCount: 4, status: 'AVAILABLE' }] },
  { id: 'demo-doctor-2', name: '陈医生', avatar: '', title: '正畸学科医生', displayText: '数字化正畸诊疗', specialty: '擅长成人与青少年错颌畸形评估、隐形矫正和固定矫正。', description: '关注面型、咬合与长期稳定之间的平衡，为患者清晰讲解不同矫治路径。', recommend: true, departments: [demoCategories[1]], clinic: { id: 'demo-clinic', name: '重庆种博士口腔总院', address: '重庆市' }, schedules: [{ id: 's2', date: '2026-09-11', timeSlot: '下午', capacity: 8, bookedCount: 2, status: 'AVAILABLE' }] },
  { id: 'demo-doctor-3', name: '李医生', avatar: '', title: '综合齿科医生', displayText: '牙周与美学修复', specialty: '擅长牙周基础治疗、牙体美学修复及口腔健康长期管理。', description: '坚持以检查结果为依据，注重治疗细节与患者舒适度。', recommend: true, departments: [demoCategories[2], demoCategories[3]], clinic: { id: 'demo-clinic', name: '重庆种博士口腔总院', address: '重庆市' }, schedules: [] }
];

export const demoArticles: Article[] = [
  { id: 'demo-article-1', slug: 'implant-care-guide', title: '种植牙完成后，日常护理要注意什么？', author: '重庆种博士口腔', digest: '从清洁、饮食到定期复查，了解种植牙长期维护的关键事项。', publishedAt: '2026-09-08T08:00:00+08:00', contentHtml: '<p>种植修复完成并不意味着护理结束。良好的日常清洁和规范复查，是长期稳定使用的重要基础。</p><h2>保持有效清洁</h2><p>每天按正确方式刷牙，并根据医生建议使用牙线、间隙刷或冲牙器，重点清洁种植体周围区域。</p><h2>关注咬合与不适</h2><p>如果出现松动感、反复出血或咬合不适，应及时联系医生检查，不建议自行处理。</p><h2>按时复查维护</h2><p>复查频率应由医生结合个人牙周状况、清洁情况和修复类型确定。</p>' },
  { id: 'demo-article-2', slug: 'orthodontic-first-visit', title: '第一次做正畸检查，需要提前准备什么？', author: '重庆种博士口腔', digest: '了解初诊检查、资料采集和方案沟通，让正畸咨询更高效。', publishedAt: '2026-09-02T08:00:00+08:00', contentHtml: '<p>正畸初诊的核心，是让医生充分了解牙列、咬合和面型情况，同时听取您的主要诉求。</p><h2>如实说明健康状况</h2><p>既往口腔治疗经历、全身健康情况和正在服用的药物，都应主动告知医生。</p><h2>准备想要咨询的问题</h2><p>可以提前记录对疗程、复诊频率、不同矫治方式和日常护理的疑问。</p>' },
  { id: 'demo-article-3', slug: 'periodontal-warning', title: '刷牙出血不是小事：牙周健康的几个提醒', author: '重庆种博士口腔', digest: '牙龈出血、口腔异味和牙齿松动，可能是牙周问题发出的信号。', publishedAt: '2026-08-26T08:00:00+08:00', contentHtml: '<p>偶尔一次刷牙出血可能与刷牙方式有关，但如果反复出现，就需要重视牙龈和牙周组织的健康。</p><h2>不要因为出血停止刷牙</h2><p>应保持温和而有效的清洁，并尽快接受专业检查，明确出血原因。</p><h2>定期洁治不等于牙周治疗</h2><p>是否需要进一步牙周治疗，应由医生结合探诊和影像检查判断。</p>' }
];

export const demoPages: WebsitePage[] = [
  { id: 'demo-page-about', slug: 'about', title: '关于种博士', menuTitle: '品牌介绍', summary: '以专业、规范、透明的口腔医疗服务，守护山城家庭的口腔健康。', showInNav: true, contentHtml: '<h2>认真对待每一次诊疗托付</h2><p>重庆种博士口腔坚持以患者需求为中心，从检查、沟通、治疗到复查维护，建立清晰、规范的诊疗服务流程。</p><h2>专业与温度并重</h2><p>我们重视医生团队建设、数字化诊疗能力与院感管理，也重视患者在就诊过程中的理解、感受与长期口腔健康。</p>' }
];

export const demoBootstrap: Bootstrap = {
  settings: { brandName: '重庆种博士口腔', eyebrow: '专注口腔健康 · 规范诊疗服务', heroTitle: '让每一次看牙，都更安心从容', heroDescription: '汇聚专业口腔医生团队，以规范诊疗流程、数字化设备与细致服务，守护每一位患者的口腔健康。', appointmentUrl: '#demo-appointment', appointmentText: '在线预约', phone: '023-8888 8888', serviceHours: '周一至周日 08:30—18:00', address: '重庆市（演示地址，请在后台配置）', footerDescription: '以专业、规范、透明的口腔医疗服务，为山城家庭守护每一颗牙。', icpNumber: '', wechatName: '重庆种博士口腔' },
  pages: demoPages, banners: [], categories: demoCategories, doctors: demoDoctors, articles: demoArticles,
  clinics: [{ id: 'demo-clinic', name: '重庆种博士口腔总院', address: '重庆市' }]
};
