export const adminPermissionGroups = [
  { label: '业务管理', items: [
    { value: 'MANAGE_APPOINTMENTS', label: '旧版预约管理（兼容权限）', pages: '历史权限；启用后兼容开放业务管理页面' },
    { value: 'BUSINESS_LEADS', label: '腾讯广告线索', pages: '业务管理 / 腾讯广告线索' },
    { value: 'BUSINESS_APPOINTMENTS', label: '挂号管理', pages: '业务管理 / 挂号管理' },
    { value: 'BUSINESS_USERS', label: '用户管理', pages: '业务管理 / 用户管理' },
    { value: 'BUSINESS_NOTIFICATIONS', label: '通知记录', pages: '业务管理 / 通知记录' },
  ] },
  { label: '手机号与隐私权限', items: [
    { value: 'VIEW_FULL_PHONE', label: '查看完整手机号', pages: '预约、线索及网咨详情' },
    { value: 'EXPORT_FULL_PHONE', label: '导出完整手机号', pages: '挂号数据导出' },
  ] },
  { label: '网咨数据', items: [
    { value: 'CONSULTATION_VIEW', label: '查看网咨表单', pages: '网咨数据 / 全部表单、今日需回访' },
    { value: 'CONSULTATION_CREATE', label: '手动录单', pages: '网咨数据 / 全部表单' },
    { value: 'CONSULTATION_EDIT', label: '编辑网咨资料', pages: '基础资料、状态、回访时间、标签' },
    { value: 'CONSULTATION_FOLLOW_UP', label: '新增跟进记录', pages: '网咨表单 / 跟进记录' },
    { value: 'CONSULTATION_IMPORT', label: '批量导入', pages: '网咨数据 / Excel 导入' },
    { value: 'CONSULTATION_EXPORT', label: '导出网咨表单', pages: '网咨数据 / 导出' },
    { value: 'CONSULTATION_EXPORT_FULL_PHONE', label: '导出完整手机号', pages: '网咨数据 / 导出（单独授权）' },
    { value: 'CONSULTATION_ASSIGN', label: '分配网咨负责人', pages: '单条、批量、导入分配' },
    { value: 'CONSULTATION_SETTINGS', label: '网咨设置', pages: '字段、状态、标签和默认列表' },
  ] },
  { label: '推广数据', items: [
    { value: 'PROMOTION_HOME', label: '数据首页', pages: '推广数据 / 数据首页' },
    { value: 'PROMOTION_DAILY', label: '日统计', pages: '推广数据 / 日统计' },
    { value: 'PROMOTION_WEEKLY', label: '周统计', pages: '推广数据 / 周统计' },
    { value: 'PROMOTION_MONTHLY', label: '月统计', pages: '推广数据 / 月统计' },
    { value: 'PROMOTION_FILTER', label: '数据筛选', pages: '推广数据 / 数据筛选' },
    { value: 'PROMOTION_DAILY_REPORT', label: '推广日报', pages: '推广数据 / 推广日报' },
    { value: 'PROMOTION_WEEKLY_REPORT', label: '推广周报', pages: '推广数据 / 推广周报' },
    { value: 'PROMOTION_MONTHLY_REPORT', label: '推广月报', pages: '推广数据 / 推广月报' },
    { value: 'PROMOTION_ACCOUNTS', label: '推广账户', pages: '推广数据 / 推广账户' },
    { value: 'PROMOTION_SYNC', label: '数据同步设置', pages: '推广数据 / 数据同步设置' },
    { value: 'PROMOTION_FIELDS', label: '字段设置', pages: '推广数据 / 字段设置' },
    { value: 'PROMOTION_SALARY', label: '工资测算', pages: '推广数据 / 工资测算' },
    { value: 'PROMOTION_CREATIVE_BATCH_VIEW', label: '查看批量创意', pages: '推广运营 / 素材分析 / 批量创建记录' },
    { value: 'PROMOTION_CREATIVE_BATCH_CREATE', label: '批量新建创意', pages: '推广运营 / 素材分析 / 批量新建创意' },
    { value: 'PROMOTION_CREATIVE_BATCH_RETRY', label: '重试批量创意', pages: '推广运营 / 批量创建记录' },
    { value: 'PROMOTION_CREATIVE_BATCH_CANCEL', label: '取消批量创意', pages: '推广运营 / 批量创建记录' },
    { value: 'PROMOTION_CREATIVE_TEMPLATE_VIEW', label: '查看腾讯创意规格', pages: '推广运营 / 批量新建创意' },
    { value: 'PROMOTION_CREATIVE_ASSET_VIEW', label: '查看腾讯创意资产', pages: '推广运营 / 批量新建创意' },
    { value: 'PROMOTION_CREATIVE_RESULT_EXPORT', label: '导出批量创建结果', pages: '推广运营 / 批量创建记录' },
    { value: 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_VIEW', label: '查看多账户批量创意', pages: '推广运营 / 批量新建' },
    { value: 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CREATE', label: '创建多账户批量创意', pages: '推广运营 / 批量新建' },
    { value: 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_RETRY', label: '重试多账户批量创意', pages: '推广运营 / 批量新建' },
    { value: 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_CANCEL', label: '取消多账户批量创意', pages: '推广运营 / 批量新建' },
    { value: 'PROMOTION_MULTI_ACCOUNT_CREATIVE_BATCH_RESULT_EXPORT', label: '导出多账户创意结果', pages: '推广运营 / 批量新建' },
    { value: 'PROMOTION_CREATIVE_DEFAULT_COMPONENT_VIEW', label: '查看账户默认创意组件', pages: '推广运营 / 批量新建 / 默认组件' },
    { value: 'PROMOTION_CREATIVE_DEFAULT_COMPONENT_MANAGE', label: '维护账户默认创意组件', pages: '推广运营 / 批量新建 / 默认组件' },
    { value: 'PROMOTION_CREATIVE_ASSET_CROSS_ACCOUNT_USE', label: '使用跨账户创意素材', pages: '推广运营 / 批量新建' },
    { value: 'PROMOTION_CREATIVE_ASSET_DISTRIBUTION', label: '分发跨账户创意素材', pages: '推广运营 / 批量新建（当前仅授权预留）' },
  ] },
  { label: '推广运营', items: [
    { value: 'PROMOTION_OPERATIONS', label: '账户与素材分析', pages: '推广运营 / 账户健康、素材分析' },
  ] },
  { label: '内容管理', items: [
    { value: 'CONTENT_HOME', label: '首页管理', pages: '内容管理 / 首页管理' },
    { value: 'CONTENT_DEPARTMENTS', label: '科室与项目', pages: '内容管理 / 科室与项目' },
    { value: 'CONTENT_DOCTORS', label: '医生与出诊', pages: '内容管理 / 医生与出诊' },
    { value: 'CONTENT_PACKAGES', label: '套餐管理', pages: '内容管理 / 套餐管理' },
    { value: 'CONTENT_MEDIA', label: '图片库', pages: '内容管理 / 图片库' },
    { value: 'CONTENT_LINKS', label: '页面跳转链接', pages: '内容管理 / 页面跳转链接' },
  ] },
  { label: '官网内容', items: [
    { value: 'WEBSITE_SETTINGS', label: '官网设置', pages: '官网内容 / 官网设置' },
    { value: 'WEBSITE_CATEGORIES', label: '资讯分类', pages: '官网内容 / 资讯分类' },
    { value: 'WEBSITE_ARTICLES', label: '口腔资讯', pages: '官网内容 / 口腔资讯' },
  ] },
  { label: '微信运营', items: [
    { value: 'WECHAT_MENU', label: '公众号菜单', pages: '微信运营 / 公众号菜单' },
    { value: 'WECHAT_AUTO_REPLY', label: '自动回复', pages: '微信运营 / 自动回复' },
  ] },
  { label: '系统管理', items: [
    { value: 'SYSTEM_MEMBERS', label: '成员与预约通知', pages: '系统管理 / 成员与预约通知' },
    { value: 'SYSTEM_ROLES', label: '角色管理', pages: '系统管理 / 角色管理' },
    { value: 'SYSTEM_OFFICIAL_BINDING', label: '公众号绑定', pages: '系统管理 / 公众号绑定' },
    { value: 'SYSTEM_CONFIGS', label: '系统配置', pages: '系统管理 / 系统配置' },
    { value: 'SYSTEM_FOLLOWUP', label: '回访接口', pages: '系统管理 / 回访接口' },
    { value: 'SYSTEM_WEBSITE_ANALYTICS', label: '官网浏览统计', pages: '系统管理 / 官网浏览统计' },
    { value: 'SYSTEM_AUDIT', label: '审计日志', pages: '系统管理 / 审计日志' },
  ] },
] as const;

export const adminPermissionOptions = adminPermissionGroups.flatMap((group) => [...group.items]);

export function adminPermissionLabel(value: string) {
  return adminPermissionOptions.find((item) => item.value === value)?.label || value;
}
