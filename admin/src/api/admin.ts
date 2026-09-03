import { http } from './http';
import { AdminProfile } from '../stores/auth';
import { ElMessage } from 'element-plus';

export interface PageResult<T> {
  total: number;
  page: number;
  pageSize: number;
  list: T[];
}

export interface AppointmentItem {
  id: string;
  appointmentNo: string;
  name: string;
  phoneMasked: string;
  ageRange: string;
  missingTeethType: string;
  type: string;
  typeText: string;
  appointmentDate?: string;
  appointmentTime?: string;
  symptomDescription?: string;
  gender?: string;
  source?: string;
  status: string;
  statusText: string;
  followupForwardStatus: string;
  followupForwardStatusText: string;
  followupForwardedAt?: string;
  followupForwardLastTriedAt?: string;
  followupForwardErrorCode?: string;
  followupForwardErrorMessage?: string;
  followupForwardRetryCount?: number;
  adminRemark?: string;
  remark?: string;
  createdAt: string;
  clinic?: { id: string; name: string } | null;
  doctor?: { id: string; name: string; title: string } | null;
  dentalCategory?: { id: string; name: string } | null;
  dentalProject?: { id: string; name: string } | null;
  package?: { id: string; title: string } | null;
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

export interface ManagedContent {
  id: string;
  sort: number;
  status: 'ACTIVE' | 'DISABLED';
  createdAt?: string;
  updatedAt?: string;
}

export interface HomeBannerItem extends ManagedContent {
  imageUrl: string;
  title: string;
  linkType: string;
  linkValue?: string;
}

export interface HomeAdItem extends ManagedContent {
  imageUrl: string;
  title: string;
  linkType: string;
  linkValue?: string;
}

export interface DentalCategoryItem extends ManagedContent {
  name: string;
  icon?: string;
  projects?: DentalProjectItem[];
}

export interface DentalProjectItem extends ManagedContent {
  categoryId: string;
  name: string;
  description?: string;
  category?: DentalCategoryItem;
}

export interface DoctorItem extends ManagedContent {
  name: string;
  avatar: string;
  title: string;
  displayText?: string;
  departmentId: string;
  departmentIds?: string[];
  clinicId?: string;
  specialty: string;
  description: string;
  images: string[];
  recommend: boolean;
  department?: DentalCategoryItem;
  departments?: DentalCategoryItem[];
  clinic?: ClinicItem;
}

export interface MediaAssetItem {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface DoctorScheduleItem {
  id: string;
  doctorId: string;
  clinicId?: string;
  date: string;
  timeSlot: string;
  capacity: number;
  bookedCount: number;
  sort: number;
  status: 'AVAILABLE' | 'FULL' | 'DISABLED';
  doctor?: DoctorItem;
  clinic?: ClinicItem;
}

export interface PackageItem extends ManagedContent {
  categoryId: string;
  title: string;
  cover: string;
  originalPrice: string | number;
  salePrice: string | number;
  salesCount: number;
  description: string;
  category?: DentalCategoryItem;
  images?: Array<{ id: string; imageUrl: string; sort: number }>;
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

const enterpriseAdminBase = '/api/admin/enterprise';

export function uploadEnterpriseAsset(file: File) {
  const data = new FormData();
  data.append('file', file);
  return http.post<unknown, MediaAssetItem>(`${enterpriseAdminBase}/assets`, data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
}

export const getMediaAssets = () => http.get<unknown, MediaAssetItem[]>(`${enterpriseAdminBase}/assets`);
export const deleteMediaAsset = (id: string) => http.delete(`${enterpriseAdminBase}/assets/${id}`);

export const getEnterpriseHomeConfig = () => http.get<unknown, Record<string, string>>(`${enterpriseAdminBase}/home-config`);
export const updateEnterpriseHomeConfig = (data: Record<string, string>) => http.patch<unknown, Record<string, string>>(`${enterpriseAdminBase}/home-config`, data);

export const getHomeBanners = () => http.get<unknown, HomeBannerItem[]>(`${enterpriseAdminBase}/banners`);
export const createHomeBanner = (data: Omit<HomeBannerItem, 'id'>) => http.post<unknown, HomeBannerItem>(`${enterpriseAdminBase}/banners`, data);
export const updateHomeBanner = (id: string, data: Partial<HomeBannerItem>) => http.patch<unknown, HomeBannerItem>(`${enterpriseAdminBase}/banners/${id}`, data);
export const deleteHomeBanner = (id: string) => http.delete(`${enterpriseAdminBase}/banners/${id}`);

export const getHomeAds = () => http.get<unknown, HomeAdItem[]>(`${enterpriseAdminBase}/ads`);
export const createHomeAd = (data: Omit<HomeAdItem, 'id'>) => http.post<unknown, HomeAdItem>(`${enterpriseAdminBase}/ads`, data);
export const updateHomeAd = (id: string, data: Partial<HomeAdItem>) => http.patch<unknown, HomeAdItem>(`${enterpriseAdminBase}/ads/${id}`, data);
export const deleteHomeAd = (id: string) => http.delete(`${enterpriseAdminBase}/ads/${id}`);

export const getDentalCategories = () => http.get<unknown, DentalCategoryItem[]>(`${enterpriseAdminBase}/dental-categories`);
export const createDentalCategory = (data: Partial<DentalCategoryItem>) => http.post<unknown, DentalCategoryItem>(`${enterpriseAdminBase}/dental-categories`, data);
export const updateDentalCategory = (id: string, data: Partial<DentalCategoryItem>) => http.patch<unknown, DentalCategoryItem>(`${enterpriseAdminBase}/dental-categories/${id}`, data);
export const deleteDentalCategory = (id: string) => http.delete(`${enterpriseAdminBase}/dental-categories/${id}`);

export const getDentalProjects = () => http.get<unknown, DentalProjectItem[]>(`${enterpriseAdminBase}/dental-projects`);
export const createDentalProject = (data: Partial<DentalProjectItem>) => http.post<unknown, DentalProjectItem>(`${enterpriseAdminBase}/dental-projects`, data);
export const updateDentalProject = (id: string, data: Partial<DentalProjectItem>) => http.patch<unknown, DentalProjectItem>(`${enterpriseAdminBase}/dental-projects/${id}`, data);
export const deleteDentalProject = (id: string) => http.delete(`${enterpriseAdminBase}/dental-projects/${id}`);

export const getDoctorsAdmin = () => http.get<unknown, DoctorItem[]>(`${enterpriseAdminBase}/doctors`);
export const getPublishedDoctors = () => http.get<unknown, DoctorItem[]>('/api/enterprise/doctors');
export const getEnterpriseClinics = () => http.get<unknown, ClinicItem[]>(`${enterpriseAdminBase}/clinics`);
export const createDoctorAdmin = (data: Partial<DoctorItem>) => http.post<unknown, DoctorItem>(`${enterpriseAdminBase}/doctors`, data);
export const updateDoctorAdmin = (id: string, data: Partial<DoctorItem>) => http.patch<unknown, DoctorItem>(`${enterpriseAdminBase}/doctors/${id}`, data);
export const deleteDoctorAdmin = (id: string) => http.delete(`${enterpriseAdminBase}/doctors/${id}`);

export const getDoctorSchedules = (doctorId?: string) => http.get<unknown, DoctorScheduleItem[]>(`${enterpriseAdminBase}/doctor-schedules`, { params: { doctorId } });
export const createDoctorSchedule = (data: Partial<DoctorScheduleItem>) => http.post<unknown, DoctorScheduleItem>(`${enterpriseAdminBase}/doctor-schedules`, data);
export const updateDoctorSchedule = (id: string, data: Partial<DoctorScheduleItem>) => http.patch<unknown, DoctorScheduleItem>(`${enterpriseAdminBase}/doctor-schedules/${id}`, data);
export const deleteDoctorSchedule = (id: string) => http.delete(`${enterpriseAdminBase}/doctor-schedules/${id}`);

export const getPackageCategories = () => http.get<unknown, DentalCategoryItem[]>(`${enterpriseAdminBase}/package-categories`);
export const createPackageCategory = (data: Partial<DentalCategoryItem>) => http.post<unknown, DentalCategoryItem>(`${enterpriseAdminBase}/package-categories`, data);
export const updatePackageCategory = (id: string, data: Partial<DentalCategoryItem>) => http.patch<unknown, DentalCategoryItem>(`${enterpriseAdminBase}/package-categories/${id}`, data);
export const deletePackageCategory = (id: string) => http.delete(`${enterpriseAdminBase}/package-categories/${id}`);

export const getPackagesAdmin = () => http.get<unknown, PackageItem[]>(`${enterpriseAdminBase}/packages`);
export const getPublishedPackages = () =>
  http.get<unknown, { categories: DentalCategoryItem[]; packages: PackageItem[] }>('/api/enterprise/packages');
export const createPackageAdmin = (data: Partial<PackageItem>) => http.post<unknown, PackageItem>(`${enterpriseAdminBase}/packages`, data);
export const updatePackageAdmin = (id: string, data: Partial<PackageItem>) => http.patch<unknown, PackageItem>(`${enterpriseAdminBase}/packages/${id}`, data);
export const deletePackageAdmin = (id: string) => http.delete(`${enterpriseAdminBase}/packages/${id}`);
export const replacePackageImages = (id: string, images: Array<{ id?: string; imageUrl: string; sort: number }>) => http.patch<unknown, Array<{ id: string; imageUrl: string; sort: number }>>(`${enterpriseAdminBase}/packages/${id}/images`, { images });
