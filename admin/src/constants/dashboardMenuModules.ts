export interface DashboardMenuModule { path: string; title: string }
export interface DashboardMenuGroup { name: string; items: DashboardMenuModule[] }

export const dashboardMenuGroups: DashboardMenuGroup[] = [
  { name: '线索管理', items: [
    { path: '/tencent-ad-leads', title: '腾讯线索' }, { path: '/appointments', title: '挂号管理' },
    { path: '/users', title: '用户管理' }, { path: '/notifications', title: '通知记录' }
  ] },
  { name: '网咨数据', items: [
    { path: '/consultations', title: '全部表单' }, { path: '/consultations/callbacks', title: '今日需回访' },
    { path: '/consultations/channel-report', title: '渠道报表' }, { path: '/consultations/report', title: '网咨报表' },
    { path: '/consultations/settings', title: '网咨设置' }
  ] },
  { name: '推广数据', items: [
    { path: '/operations/dashboard', title: '数据首页' }, { path: '/operations/daily', title: '日统计' },
    { path: '/operations/weekly', title: '周统计' }, { path: '/operations/monthly', title: '月统计' },
    { path: '/operations/filter', title: '数据筛选' }, { path: '/operations/daily-report', title: '推广日报' },
    { path: '/operations/weekly-report', title: '推广周报' }, { path: '/operations/monthly-report', title: '推广月报' },
    { path: '/operations/accounts', title: '推广账户' }, { path: '/operations/sync-settings', title: '数据同步设置' },
    { path: '/operations/fields', title: '字段设置' }, { path: '/operations/salary', title: '工资测算' }
  ] },
  { name: '推广运营', items: [
    { path: '/promotion-operations/account-health', title: '账户健康' }, { path: '/promotion-operations/material-analysis', title: '素材分析' },
    { path: '/promotion/smart-monitor', title: '智能监控' }, { path: '/promotion-operations/creative-batches', title: '新建创意' },
    { path: '/promotion/multi-account-creative-batch', title: '批量新建' }, { path: '/promotion/creative-default-components', title: '默认组件' }
  ] },
  { name: '小程序页', items: [
    { path: '/home-manage', title: '首页管理' }, { path: '/department-manage', title: '科室与项目' },
    { path: '/doctor-manage', title: '医生与出诊' }, { path: '/package-manage', title: '套餐管理' },
    { path: '/media-library', title: '图片库' }, { path: '/mini-program-links', title: '页面跳转链接' },
    { path: '/configs', title: '留资页面' }, { path: '/wechat-group-notifications', title: '微信群挂号通知' },
    { path: '/wechat-group-notifications/sender', title: '专用微信账号' }
  ] },
  { name: '官网内容', items: [
    { path: '/website-settings', title: '官网设置' }, { path: '/website-categories', title: '资讯分类' },
    { path: '/website-articles', title: '口腔资讯' }
  ] },
  { name: 'AfterBeat', items: [
    { path: '/afterbeat-settings', title: '页面设置' }, { path: '/afterbeat-categories', title: '资讯分类' },
    { path: '/afterbeat-articles', title: '热点新闻' }
  ] },
  { name: '微信运营', items: [
    { path: '/official-menu', title: '公众号菜单' }, { path: '/official-auto-reply', title: '自动回复' },
    { path: '/official-binding', title: '公众号绑定' }
  ] },
  { name: '系统管理', items: [
    { path: '/admin-users', title: '成员管理' }, { path: '/admin-teams', title: '团队管理' }, { path: '/appointment-notify', title: '预约通知' },
    { path: '/admin-roles', title: '角色管理' }, { path: '/followup-forward', title: '回访接口' },
    { path: '/website-analytics', title: '官网浏览统计' }, { path: '/audit-logs', title: '审计日志' },
    { path: '/change-password', title: '修改密码' }
  ] }
];
