# 微信公众号阅读者挂号服务系统

这是一个从公众号文章、菜单、二维码或推广页进入小程序完成挂号咨询的 monorepo 项目。系统包含原生微信小程序、NestJS 后端、Vue 管理后台、MySQL、Redis、Prisma、Docker 部署配置。

系统只用于挂号咨询和线索跟进，不做医疗诊断承诺。品牌、活动文案、价格、备案号、机构名称、隐私协议、模板消息 ID 等均通过后台配置或 `.env` 配置，不写死在页面里。

## 技术栈

- 小程序：原生微信小程序 + TypeScript
- 后端：NestJS + TypeScript + Prisma + MySQL 8 + Redis 7
- 后台：Vue 3 + Vite + TypeScript + Element Plus + Pinia
- 安全：手机号 AES-256-GCM 加密、HMAC hash 搜索、JWT、权限控制、审计日志、微信签名校验、Redis 限流和防重复提交

## 目录结构

```text
root/
  README.md
  DEPLOYMENT.md
  CHECKLIST.md
  docker-compose.yml
  .env.example
  miniprogram/
    project.config.json
    miniprogram/
      app.json
      api/
      pages/landing/
      pages/success/
      pages/appointments/
  server/
    Dockerfile
    prisma/schema.prisma
    prisma/seed.ts
    src/main.ts
    src/modules/auth/
    sn���$z{-���jםlowupForwardRetryCount?: number;
  adminRemark?: string;
  remark?: string;
  createdAt: string;
  clinic?: { id: string; name: string } | null;
  assignedTo?: { id: string; username: string } | null;
  notifications?: unknown[];
}

export interface UserItem {
  id: string;
  name?: string;
  phoneMasked?: string;
  ageRange?: string;
  status: string;
  createdAt: string;
  wechat: {
    hasMiniOpenId: boolean;
    hasOfficialAccountOpenId: boolean;
    hasUnionId: boolean;
  };
}

export interface NotificationLog {
  id: string;
  channel: string;
  targetOpenId?: string;
  templateId?: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
}

export interface OfficialAccountMenuButton {
  name: string;
  type?: 'view' | 'click' | 'miniprogram';
  url?: string;
  key?: string;
  appid?: string;
  pagepath?: string;
  sub_button?: OfficialAccountMenuButton[];
}

export interface OfficialAccountMenuConfig {
  button: OfficialAccountMenuButton[];
}

export interface AdminUserItem {
  id: string;
  username: string;
  nickname: string;
  role: string;
  permissions: string[];
  status: string;
  wechatBound: boolean;
  oaOpenIdMasked?: string;
  subscribedOfficialAccount: boolean;
  notifyEnabled: boolean;
  wechatBoundAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminWechatInviteItem {
  id: string;
  nickname: string;
  role: string;
  permissions: string[];
  notifyEnabled: boolean;
  status: string;
  bindUrl?: string;
  expiresAt: string;
  createdAt: string;
}

export interface AdminWechatLoginSession {
  sessionId: string;
  oauthUrl: string;
  expiresIn: number;
  status?: 'PENDING' | 'CONFIRMED' | 'ERROR' | 'EXPIRED';
  message?: string;
  token?: string;
  user?: AdminProfile;
}

export interface ClinicItem {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentNotifyConfig {
  enabled: boolean;
  templateId?: string;
}

export interface FollowupForwardConfig {
  enabled: boolean;
  url: string;
  authHeader: string;
  authScheme: string;
  authToken: string;
  hasAuthToken?: boolean;
  authTokenMasked?: string;
  timeoutMs: number;
  includeFullPhone: boolean;
  extraHeaders: Record<string, string>;
}

export interface OfficialAutoReplyKeywordRule {
  id: string;
  keyword: string;
  matchMode: 'CONTAINS' | 'EXACT';
  replyContent: string;
  enabled: boolean;
  createdAt?: string;
}

export interface OfficialAutoReplyConfig {
  enabled: boolean;
  subscribeReplyEnabled: boolean;
  subscribeReply: string;
  messageReplyEnabled: boolean;
  messageReply: string;
  keywordReplyEnabled: boolean;
  keywordRules: OfficialAutoReplyKeywordRule[];
}

export function adminLogin(data: { username: string; password: string }) {
  return http.post<unknown, { token: string; user: AdminProfile }>('/api/admin/auth/login', data);
}

export function createAdminWechatLoginSession() {
  return http.post<unknown, AdminWechatLoginSession>('/api/admin/auth/wechat/session');
}

export function pollAdminWechatLoginSession(sessionId: string) {
  return http.get<unknown, AdminWechatLoginSession>(`/api/admin/auth/wechat/session/${sessionId}`);
}

export function getDashboard() {
  return http.get<unknown, Record<string, unknown>>('/api/admin/dashboard');
}

export function getUsers(params: Record<string, unknown>) {
  return http.get<unknown, PageResult<UserItem>>('/api/admin/users', { params });
}

export function getUserDetail(id: string) {
  return http.get<unknown, Record<string, unknown>>(`/api/admin/users/${id}`);
}

export function revealUserPhone(id: string) {
  return http.post<unknown, { phone: string }>(`/api/admin/users/${id}/reveal-phone`);
}

export function getAppointments(params: Record<string, unknown>) {
  return http.get<unknown, PageResult<AppointmentItem>>('/api/admin/appointments', { params });
}

export function getAppointmentDetail(id: string) {
  return http.get<unknown, AppointmentItem>(`/api/admin/appointments/${id}`);
}

export function revealPhone(id: string) {
  return http.post<unknown, { phone: string }>(`/api/admin/appointments/${id}/reveal-phone`);
}

export function updateAppointmentStatus(id: string, status: string) {
  return http.patch<unknown, AppointmentItem>(`/api/admin/appointments/${id}/status`, { status });
}

export function updateAppointmentRemark(id: string, adminRemark: string) {
  return http.patch<unknown, AppointmentItem>(`/api/admin/appointments/${id}/remark`, { adminRemark });
}

export function assignAppointment(id: string, adminUserId?: string) {
  return http.patch<unknown, AppointmentItem>(`/api/admin/appointments/${id}/assign`, { adminUserId });
}

export function resendNotification(id: string) {
  return http.post<unknown, Record<string, unknown>>(`/api/admin/appointments/${id}/resend-notification`);
}

export function resendFollowupForward(id: string) {
  return http.post<unknown, Record<string, unknown>>(`/api/admin/appointments/${id}/resend-followup-forward`);
}

export function getNotificationLogs(params: Record<string, unknown>) {
  return http.get<unknown, PageResult<NotificationLog>>('/api/admin/notification-logs', { params });
}

export function retryNotification(id: string) {
  return http.post<unknown, Record<string, unknown>>(`/api/admin/notification-logs/${id}/retry`);
}

export function getAuditLogs(params: Record<string, unknown>) {
  return http.get<unknown, PageResult<Record<string, unknown>>>('/api/admin/audit-logs', { params });
}

export function getConfigs() {
  return http.get<unknown, Array<{ key: string; valueJson: Record<string, unknown>; description?: string }>>('/api/admin/configs');
}

export function updateConfigs(configs: Array<{ key: string; valueJson: Record<string, unknown>; description?: string }>) {
  return http.patch<unknown, unknown>('/api/admin/configs', { configs });
}

export function uploadLandingAsset(file: File) {
  const data = new FormData();
  data.append('file', file);
  return http.post<unknown, { url: string }>('/api/admin/landing-assets', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
}

export function getOfficialAccountMenu() {
  return http.get<unknown, OfficialAccountMenuConfig>('/api/admin/official-account/menu');
}

export function updateOfficialAccountMenu(menu: OfficialAccountMenuConfig) {
  return http.patch<unknown, OfficialAccountMenuConfig>('/api/admin/official-account/menu', { menu });
}

export function publishOfficialAccountMenu() {
  return http.post<unknown, { published: boolean; result: Record<string, unknown> }>('/api/admin/official-account/menu/publish');
}

export function getOfficialAutoReply() {
  return http.get<unknown, OfficialAutoReplyConfig>('/api/admin/official-account/auto-reply');
}

export function updateOfficialAutoReply(autoReply: OfficialAutoReplyConfig) {
  return http.patch<unknown, OfficialAutoReplyConfig>('/api/admin/official-account/auto-reply', { autoReply });
}

export function getAdminUsers(params: Record<string, unknown>) {
  return http.get<unknown, PageResult<AdminUserItem>>('/api/admin/admin-users', { params });
}

export function updateAdminUser(id: string, data: {
  password?: string;
  nickname?: string;
  role?: string;
  permissions?: string[];
  status?: string;
  notifyEnabled?: boolean;
}) {
  return http.patch<unknown, AdminUserItem>(`/api/admin/admin-users/${id}`, data);
}

export function getAdminWechatInvitations() {
  return http.get<unknown, AdminWechatInviteItem[]>('/api/admin/admin-users/invitations');
}

export function createAdminWechatInvitation(data: {
  nickname: string;
  role: string;
  permissions: string[];
  notifyEnabled: boolean;
}) {
  return http.post<unknown, AdminWechatInviteItem>('/api/admin/admin-users/invitations', data);
}

export function cancelAdminWechatInvitation(id: string) {
  return http.delete<unknown, { cancelled: boolean }>(`/api/admin/admin-users/invitations/${id}`);
}

export function createExistingAdminWechatInvitation(id: string) {
  return http.post<unknown, AdminWechatInviteItem>(`/api/admin/admin-users/${id}/wechat-invitation`);
}

export function getClinics() {
  return http.get<unknown, ClinicItem[]>('/api/admin/clinics');
}

export function createClinic(data: { name: string; address?: string; phone?: string; status?: string }) {
  return http.post<unknown, ClinicItem>('/api/admin/clinics', data);
}

export function updateClinic(id: string, data: { name?: string; address?: string; phone?: string; status?: string }) {
  return http.patch<unknown, ClinicItem>(`/api/admin/clinics/${id}`, data);
}

export function getAppointmentNotifyConfig() {
  return http.get<unknown, AppointmentNotifyConfig>('/api/admin/appointment-notify');
}

export function updateAppointmentNotifyConfig(data: { enabled?: boolean; templateId?: string }) {
  return http.patch<unknown, AppointmentNotifyConfig>('/api/admin/appointment-notify', data);
}

export function getFollowupForwardConfig() {
  return http.get<unknown, FollowupForwardConfig>('/api/admin/followup-forward');
}

export function updateFollowupForwardConfig(data: Partial<FollowupForwardConfig>) {
  return http.patch<unknown, FollowupForwardConfig>('/api/admin/followup-forward', data);
}

export async function exportAppointments(params: Record<string, unknown>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const token = localStorage.getItem('admin_token') || '';
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const response = await fetch(`${baseUrl}/api/admin/export/appointments.csv?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.message || '导出失败';
    ElMessage.error(message);
    throw new Error(message);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'appointments.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
