import { http } from './http';
import { AdminProfile } from '../stores/auth';
import { ElMessage } from 'element-plus';

export interface PageResult<T> {
  total: number;
  page: number;
  pageSize: number;
  list: T[];
}
export interface PlatformPageInfo { page: number; pageSize: number; totalNumber: number; totalPage: number; }

export interface WebsiteAnalyticsSummary {
  today: number;
  week: number;
  month: number;
  year: number;
  total: number;
  statDate: string;
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
  roleName?: string;
  customRoleId?: string | null;
  customRole?: { id: string; name: string } | null;
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
  dataScope: 'SELF' | 'ASSIGNED_MEMBERS' | 'TEAM' | 'ALL';
  dataScopeMemberIds: string[];
  teamId?: string | null;
  team?: { id: string; name: string } | null;
  consultationReceivable: boolean;
}

export interface AdminRoleDefinitionItem {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  dataScope: 'SELF' | 'ASSIGNED_MEMBERS' | 'TEAM' | 'ALL';
  dataScopeMemberIds: string[];
}

export interface AdminTeamItem {
  id: string;
  name: string;
  parentId?: string | null;
  leaderAdminId?: string | null;
  status: 'ACTIVE' | 'DISABLED';
  leader?: { id: string; username: string; nickname: string } | null;
  _count?: { members: number; children: number };
}

export interface ConsultationMetadata {
  projects: Array<{ id: string; name: string }>;
  promotionAccounts: Array<{ id: string; name: string; project: string; channel: string }>;
  statuses: ConsultationStatusItem[];
  tags: ConsultationTagItem[];
  fields: ConsultationFieldItem[];
  members: Array<{ id: string; username: string; nickname: string; teamId?: string | null }>;
  preference?: Array<{ code: string; visible: boolean; order: number; width: number }> | null;
}

export interface ConsultationStatusItem { id: string; name: string; code: string; color: string; sort: number; enabled: boolean; category: 'IN_PROGRESS' | 'COMPLETED' | 'INVALID'; }
export interface ConsultationTagItem { id: string; name: string; color: string; sort: number; enabled: boolean; }
export interface ConsultationFieldItem { id: string; name: string; code: string; source: 'FIXED' | 'CUSTOM'; type: string; required: boolean; enabled: boolean; showInForm: boolean; showInDetail: boolean; showInList: boolean; filterable: boolean; exportable: boolean; importable: boolean; listTitle?: string; listOrder: number; listWidth: number; options: string[]; }
export interface ConsultationFormItem {
  id: string; name: string; phone: string; phoneMasked: string; projectId: string; channelSource: string; promotionAccountId?: string | null; accountName?: string; lastFollowUpContent?: string; appointmentScheduled: boolean; paymentAmount: number; statusId: string;
  ownerAdminId: string; createdByAdminId: string; recordedAt: string; lastFollowUpAt?: string; nextFollowUpAt?: string; invalidReason?: string;
  customData?: Record<string, any>; overdue: boolean; project: { id: string; name: string }; status: ConsultationStatusItem;
  owner: { id: string; username: string; nickname: string }; createdBy: { id: string; username: string; nickname: string };
  tags: ConsultationTagItem[]; followUps?: Array<any>; createdAt: string; updatedAt: string;
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

export interface LandingPageItem {
  id: string;
  pageKey: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED';
  isDefault: boolean;
  appointmentCount: number;
  createdAt: string;
  updatedAt: string;
  links: {
    h5: string;
    miniProgramPath: string;
    officialAccount: string;
  };
}

export interface LandingPageDetail extends LandingPageItem {
  config: Record<string, any>;
}

export interface AppointmentNotifyConfig {
  enabled: boolean;
  templateId?: string;
  assignmentEnabled?: boolean;
  assignmentTemplateId?: string;
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

export interface TencentAdLeadItem {
  id: string;
  leadsId: string;
  name?: string;
  phoneMasked?: string;
  area?: string;
  campaignName?: string;
  adName?: string;
  leadsType?: string;
  leadsSource?: string;
  leadsSubType?: string;
  leadsSubSource?: string;
  leadsFollowTag?: string;
  leadsTouchTag?: string;
  leadsTags?: string;
  potentialScore?: string;
  status: 'NEW' | 'CONTACTED' | 'POTENTIAL' | 'HIGH_INTENT' | 'CONVERTED' | 'INVALID';
  statusText: string;
  ineffectiveReason?: string;
  adminRemark?: string;
  leadActionAt?: string;
  leadCreatedAt?: string;
  receivedAt: string;
  accountId?: string;
  advertiserId?: string;
  campaignId?: string;
  adgroupId?: string;
  adgroupName?: string;
  adId?: string;
  adcreativeId?: string;
  pageId?: string;
  pageName?: string;
  pageUrl?: string;
  componentId?: string;
  componentName?: string;
  telLocation?: string;
  email?: string;
  qq?: string;
  wechat?: string;
  gender?: string;
  age?: string;
  profession?: string;
  address?: string;
  shopName?: string;
  shopAddress?: string;
  chatId?: string;
  chatRecordUrl?: string;
  rawPayload?: Record<string, unknown>;
}

export interface TencentAdsReceiverConfig {
  enabled: boolean;
  hasToken: boolean;
  hasSecret: boolean;
  signatureAlgorithm: string;
  webhookPath: string;
  webhookUrl: string;
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
  subscribeMiniProgramEnabled: boolean;
  subscribeMiniProgramType: 'LINK' | 'CARD';
  subscribeMiniProgramAppId: string;
  subscribeMiniProgramPagePath: string;
  subscribeMiniProgramLinkText: string;
  subscribeMiniProgramCardTitle: string;
  subscribeMiniProgramCoverUrl: string;
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

export interface PromotionAccountItem {
  id: string;
  name: string;
  project: '重庆' | '绵阳';
  platform: string;
  accountNo?: string | null;
  owner?: { id: string; username: string; nickname: string | null } | null;
  status: 'ACTIVE' | 'DISABLED';
  remark?: string | null;
  canManageCredentials?: boolean;
}

export interface PromotionMetricFieldItem {
  id: string;
  key: string;
  label: string;
  source: 'SYSTEM' | 'CUSTOM';
  dataType: 'NUMBER' | 'TEXT';
  isVisible: boolean;
  sort: number;
}

export interface PromotionDailyMetricItem {
  id: string;
  accountId: string;
  statDate: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  validLeads: number;
  appointments: number;
  transactions: number;
  revenue: number;
  customMetrics: Record<string, string | number>;
  calculated: PromotionCalculatedMetrics;
  remark?: string | null;
  syncSource?: string;
  syncedAt?: string | null;
  isArchived: boolean;
  account: PromotionAccountItem;
}

export interface PromotionFilterData {
  rows: PromotionDailyMetricItem[];
  fields: PromotionMetricFieldItem[];
  accounts: PromotionAccountItem[];
}

export interface PromotionDataSyncConfigItem {
  id: string;
  provider: 'TENCENT_ADS' | 'OCEANENGINE';
  enabled: boolean;
  reportUrl: string;
  hasAccessToken: boolean;
  clientId?: string;
  hasClientSecret?: boolean;
  hasRefreshToken?: boolean;
  hasUserToken?: boolean;
  userTokenExpiresAt?: string | null;
  authorizedAccountId?: string | null;
  accessTokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
  lastSyncedAt?: string | null;
  lastSyncMessage?: string | null;
}

export interface PromotionHealthIssue {
  key: string;
  level: 'RISK' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  recommendation: string;
}

export interface PromotionHealthTotals {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  validLeads: number;
  clickRate: number | null;
  conversionRate: number | null;
  costPerLead: number | null;
  validRate: number | null;
  validCost: number | null;
}

export interface PromotionHealthAccountResult {
  account: PromotionAccountItem;
  current: PromotionHealthTotals;
  previous: PromotionHealthTotals;
  recordedDays: number;
  latestSyncedAt?: string | null;
  status: 'HEALTHY' | 'ATTENTION' | 'RISK' | 'INSUFFICIENT';
  score: number | null;
  issues: PromotionHealthIssue[];
}

export interface PromotionHealthAccountsResult {
  accounts: PromotionAccountItem[];
  connections: Array<{ provider: 'TENCENT_ADS' | 'OCEANENGINE'; enabled: boolean; connected: boolean; lastSyncedAt?: string | null; lastSyncMessage?: string | null }>;
}

export interface PromotionHealthReport {
  dateFrom: string;
  dateTo: string;
  previousDateFrom: string;
  previousDateTo: string;
  overallScore: number | null;
  summary: { healthy: number; attention: number; risk: number; insufficient: number };
  accounts: PromotionHealthAccountResult[];
  syncResults: Array<{ provider: string; synced: number; noData: number; skippedArchived: number; skipped: number; errors: string[] }>;
  methodology: {
    statement: string;
    internalBaselines: { maxCostPerLead: number; minValidRate: number; trendWarning: number; trendRisk: number };
    sources: Array<{ provider: string; label: string; url: string }>;
  };
}

export type PromotionMaterialType = 'VIDEO' | 'IMAGE' | 'COPY' | 'LANDING_PAGE' | 'BRAND' | 'ACTION_BUTTON' | 'MINI_CARD_LINK' | 'TEXT_LINK' | 'FLOATING_ZONE' | 'LABEL' | 'SOCIAL_SKILL';
export interface PromotionMaterialItem {
  id: string;
  type: PromotionMaterialType;
  name: string;
  status?: string | null;
  previewUrl?: string | null;
  metrics?: { spend: number; impressions: number; clicks: number; conversions: number } | null;
  attributionNote?: string;
  health: 'HEALTHY' | 'ATTENTION' | 'RISK' | 'UNASSESSED';
  issues: string[];
  recommendation: string;
  calculated: { ctr: number | null; conversionRate: number | null; costPerConversion: number | null };
  account?: Pick<PromotionAccountItem, 'id' | 'name' | 'accountNo' | 'project' | 'platform'>;
}
export interface PromotionMaterialReport {
  businessUnit: { provider: 'TENCENT_ADS' | 'OCEANENGINE'; name: string; accountCount: number; analyzedAccountCount: number };
  accounts: Array<Pick<PromotionAccountItem, 'id' | 'name' | 'accountNo' | 'project' | 'platform'>>;
  dateFrom: string;
  dateTo: string;
  summary: { total: number; healthy: number; attention: number; risk: number; unassessed: number; byType: Record<PromotionMaterialType, number> };
  items: PromotionMaterialItem[];
  coverage: Array<{ type: PromotionMaterialType; available: boolean; metricsAvailable: boolean; message: string }>;
  warnings: string[];
  methodology: { statement: string; sources: Array<{ provider: string; label: string; url: string }> };
}

export interface PromotionCreativeBatchOptions {
  accounts: Array<PromotionAccountItem & { authorized: boolean; hasUserToken: boolean; canCreate: boolean; authorizationMessage: string; tencentBusinessUnitKey?: string }>;
  businessUnits: Array<{ key: string; name: string; project: string; accountCount: number }>;
  maxBatchSize: number;
  sdk: { apiVersion: string; packageVersion: string; ordinaryMode: string; programMode: string };
}

export interface PromotionCreativeAdgroup {
  id: string; name: string; marketingGoal?: string | null; marketingSubGoal?: string | null; marketingCarrierType?: string | null;
  marketingTargetType?: string | null; marketingTargetId?: string | null; optimizationGoal?: string | null;
  configuredStatus?: string | null; systemStatus?: string | null; createdTime?: string | null; canCreate: boolean; unavailableReason?: string | null;
}

export interface PromotionCreativeTemplate {
  id: string; name: string; style?: string | null; size?: string | null; sampleImage?: string | null; siteSet?: unknown;
  supportBidModes: string[]; offline: boolean; offlineTips?: string | null;
}

export interface PromotionCreativeAsset {
  id: string; source: 'ACCOUNT' | 'BUSINESS_UNIT'; sourceAccount: { id: string; name: string; accountNo?: string | null; project: string };
  businessUnitKey: string; platformAssetId: string; platformAssetKind: 'COMPONENT' | 'VIDEO' | 'IMAGE' | 'REFERENCE'; type: 'TITLE' | 'VIDEO' | 'IMAGE' | 'LANDING_PAGE' | 'MARKETING' | 'BRAND' | 'WECHAT_CHANNELS' | 'CONVERSION' | 'ACTION_BUTTON' | 'MINI_CARD_LINK' | 'TEXT_LINK' | 'FLOATING_ZONE' | 'LABEL' | 'SOCIAL_SKILL' | 'OTHER';
  componentField?: string | null; name: string; contentSummary?: string | null; labelTexts?: string[]; previewUrl?: string | null; status?: string | null; auditStatus?: string | null;
  componentSubType?: string | null; bundleItemCount?: number | null;
  createdTime?: string | null; dimensions?: string | null; spend7Days?: number | null; spend15Days?: number | null; actualCpa7Days?: number | null; targetConversionCost7Days?: null; usable: boolean; unavailableReason?: string | null;
  linkedLandingPage?: { pageId: string; name: string; platformAssetId: string } | null;
  linkedCreativeCount?: number | null;
}

export interface PromotionCreativeBatchPayload {
  accountId: string; businessUnitKey: string; adgroupId: string; templateId: string;
  deliveryMode: 'DELIVERY_MODE_COMPONENT' | 'DELIVERY_MODE_CUSTOMIZE';
  dynamicCreativeType: 'DYNAMIC_CREATIVE_TYPE_COMMON' | 'DYNAMIC_CREATIVE_TYPE_PROGRAM';
  combinationMode: 'BALANCED' | 'CARTESIAN' | 'MANUAL'; namePattern: string;
  materials: { titles: string[]; videos: string[]; landingPages: string[]; conversionComponents: string[]; images: string[]; otherComponents: string[] };
  rules: { titleCount: number; videoCount: number; landingPageCount: number; conversionCount: number; imageCount: number };
  manualGroups?: Array<{ titleIds: string[]; videoIds: string[]; landingPageIds: string[]; conversionIds: string[]; imageIds: string[]; otherComponentIds?: string[] }>;
  options?: { configuredStatus?: 'AD_STATUS_NORMAL' | 'AD_STATUS_SUSPEND'; impressionTrackingUrl?: string; clickTrackingUrl?: string; pageTrackUrl?: string };
}

export interface PromotionCreativeBatchTask {
  id: string; accountId: string; businessUnitKey: string; adgroupId: string; templateId: string; deliveryMode: string; dynamicCreativeType: string;
  combinationMode: string; status: string; totalCount: number; successCount: number; failedCount: number; unknownCount: number; skippedCount: number;
  createdAt: string; updatedAt: string; startedAt?: string | null; completedAt?: string | null; duplicate?: boolean; message?: string;
  account?: Pick<PromotionAccountItem, 'id' | 'name' | 'accountNo' | 'project'>;
  items?: Array<{ id: string; sequence: number; creativeName: string; status: string; platformCreativeId?: string | null; errorCode?: string | null; errorMessage?: string | null; recoverySuggestion?: string | null; submittedAt?: string | null; verifiedAt?: string | null; materialSnapshot: Array<Record<string, unknown>> }>;
}

export interface MultiAccountCreativePayload {
  assetSnapshotIds: string[];
  targets: Array<{ accountId: string; adgroupIds: string[]; templateId?: string; componentOverrides?: Array<{ componentType: string; configId: string }>; overrideReason?: string; disabledDefaultComponentTypes?: string[] }>;
  deliveryMode: 'DELIVERY_MODE_COMPONENT' | 'DELIVERY_MODE_CUSTOMIZE';
  creativeType: 'DYNAMIC_CREATIVE_TYPE_COMMON' | 'DYNAMIC_CREATIVE_TYPE_PROGRAM';
  combinationMode: 'CARTESIAN' | 'RANDOM_LIMITED' | 'SEQUENTIAL';
  namePattern: string;
  rules: { titleCount: number; videoCount: number; imageCount: number; maxPerAdgroup: number; maxPerAccount: number; maxTotal: number; allowMaterialReuse?: boolean; randomLimit?: number };
  allowSkipInvalid?: boolean;
  configuredStatus?: 'AD_STATUS_NORMAL' | 'AD_STATUS_SUSPEND';
}

export interface MultiAccountCreativePreflight {
  accountCount: number; adgroupCount: number; estimatedCreativeCount: number; passedCount: number; failedCount: number;
  targets: Array<{
    account: { id: string; name: string; accountNo: string }; adgroup: { id: string; name: string }; template: { id: string; name: string };
    status: 'PASSED' | 'FAILED'; reasons: string[]; creativeCount: number;
    mappings: Array<{ assetId: string; name: string; status: string; targetPlatformAssetId?: string; reason?: string }>;
    defaultComponents: Array<{ type: string; id: string; name: string }>;
    items: Array<{ name: string; material: Record<string, unknown> }>;
  }>;
}

export interface MultiAccountCreativeTask {
  id: string; taskNo: string; status: string; totalAccountCount: number; totalAdgroupCount: number; totalCreativeCount: number;
  confirmedCount: number; failedCount: number; skippedCount: number; pendingVerifyCount: number; createdAt: string; duplicate?: boolean; message?: string;
  targets?: Array<{ id: string; adgroupId: string; adgroupName?: string; preflightStatus: string; executionStatus: string; failureReason?: string; account: { id: string; name: string; accountNo: string; project: string }; items: Array<{ id: string; sequence: number; creativeName: string; status: string; platformCreativeId?: string; errorCode?: string; errorMessage?: string; lastRequestedAt?: string; lastVerifiedAt?: string }> }>;
}

export interface PromotionCalculatedMetrics {
  clickRate: number | null;
  validRate: number | null;
  averageCost: number | null;
  validCost: number | null;
  conversionRate: number | null;
  arrivalRate: number | null;
  validArrivalRate: number | null;
  arrivalCost: number | null;
  roi: number | null;
}

export interface PromotionDailyMetricPayload {
  accountId: string;
  statDate: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  validLeads: number;
  appointments: number;
  transactions: number;
  revenue: number;
  customMetrics?: Record<string, string | number>;
  remark?: string;
}

export interface PromotionSummaryItem extends Omit<PromotionDailyMetricItem, 'id' | 'statDate' | 'customMetrics' | 'remark'> {
  customMetrics?: Record<string, string | number>;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  days: number;
  previous?: Omit<PromotionSummaryItem, 'previous'> | null;
}

export interface PromotionDailyReportTotals { conversions: number; averageDailyConversions: number | null; recordedDays: number; spend: number; conversionCost: number | null; invalid: number; invalidRate: number | null; }
export interface PromotionDailyReportAccount extends PromotionDailyReportTotals { accountId: string; accountName: string; accountNo?: string | null; }
export interface PromotionDailyReportChannel { channel: string; accounts: PromotionDailyReportAccount[]; totals: PromotionDailyReportTotals; problem: string; adjustment: string; isManual: boolean; }
export interface PromotionDailyReportProject { project: string; channels: PromotionDailyReportChannel[]; totals: PromotionDailyReportTotals; }
export interface PromotionDailyReport { statDate: string; dateFrom?: string; dateTo?: string; projects: PromotionDailyReportProject[]; }

export interface PromotionSalaryMetrics {
  project?: '重庆' | '绵阳';
  leads: number;
  validLeads: number;
  spend: number;
  validRate: number | null;
  averageCost: number | null;
  recordedDays: number;
  averageDailyLeads: number;
}

export interface PromotionSalaryCriterion {
  key: string;
  project: '重庆' | '绵阳';
  label: string;
  current: number | null;
  target: number;
  achieved: boolean;
  gap: number;
  unit: 'count' | 'rate' | 'money';
  recommendation: string;
}

export interface PromotionSalaryRegionRule { minDailyLeads: number; minValidRate: number; maxAverageCost: number; }
export interface PromotionSalaryConfigTier { salary: number; chongqing: PromotionSalaryRegionRule; mianyang: PromotionSalaryRegionRule; }
export interface PromotionSalaryConfig { baseSalary: number; recentDays: number; tiers: PromotionSalaryConfigTier[]; }
export interface PromotionSalaryTier {
  salary: number;
  chongqing: PromotionSalaryRegionRule;
  mianyang: PromotionSalaryRegionRule;
  achieved: boolean;
  recentAchieved: boolean;
}

export interface PromotionSalaryReport {
  month: string;
  dateFrom: string;
  dateTo: string;
  dataThrough: string | null;
  elapsedDays: number;
  remainingDays: number;
  totalDays: number;
  currentSalary: number;
  forecastSalary: number;
  regions: PromotionSalaryMetrics[];
  overall: PromotionSalaryMetrics;
  recent: { dateFrom: string | null; dateTo: string | null; days: number; regions: PromotionSalaryMetrics[]; overall: PromotionSalaryMetrics };
  tiers: PromotionSalaryTier[];
  nextTier: (PromotionSalaryTier & { criteria: PromotionSalaryCriterion[] }) | null;
  recommendations: string[];
  config: PromotionSalaryConfig;
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

export function changeOwnPassword(data: { currentPassword: string; newPassword: string }) {
  return http.post<unknown, { changed: boolean }>('/api/admin/account/change-password', data);
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
export type DashboardModule = 'METRICS' | 'TREND' | 'RECENT' | `PAGE:${string}`;
export interface DashboardTodo { id: string; title: string; dueAt: string; priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'; completed: boolean }
export const getDashboardPreferences = () => http.get<unknown, { modules: DashboardModule[] }>('/api/admin/dashboard-workspace/preferences');
export const saveDashboardPreferences = (modules: DashboardModule[]) => http.put<unknown, { modules: DashboardModule[] }>('/api/admin/dashboard-workspace/preferences', { modules });
export const getDashboardTodos = () => http.get<unknown, DashboardTodo[]>('/api/admin/dashboard-workspace/todos');
export const createDashboardTodo = (data: { title: string; dueAt: string; priority: DashboardTodo['priority'] }) => http.post<unknown, DashboardTodo>('/api/admin/dashboard-workspace/todos', data);
export const updateDashboardTodo = (id: string, data: Partial<Pick<DashboardTodo, 'title' | 'dueAt' | 'priority' | 'completed'>>) => http.patch<unknown, DashboardTodo>(`/api/admin/dashboard-workspace/todos/${id}`, data);
export const deleteDashboardTodo = (id: string) => http.delete<unknown, { deleted: boolean }>(`/api/admin/dashboard-workspace/todos/${id}`);

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

export function getLandingPages() {
  return http.get<unknown, LandingPageItem[]>('/api/admin/landing-pages');
}

export function getLandingPage(id: string) {
  return http.get<unknown, LandingPageDetail>(`/api/admin/landing-pages/${id}`);
}

export function createLandingPage(data: { name: string; cloneFromId?: string }) {
  return http.post<unknown, LandingPageDetail>('/api/admin/landing-pages', data);
}

export function updateLandingPage(
  id: string,
  data: { name?: string; status?: 'ACTIVE' | 'DISABLED'; config?: Record<string, unknown> }
) {
  return http.patch<unknown, LandingPageDetail>(`/api/admin/landing-pages/${id}`, data);
}

export function setDefaultLandingPage(id: string) {
  return http.post<unknown, LandingPageDetail>(`/api/admin/landing-pages/${id}/set-default`);
}

export function deleteLandingPage(id: string) {
  return http.delete<
    unknown,
    {
      id: string;
      pageKey: string;
      name: string;
      preservedAppointmentCount: number;
      newDefaultPage: { id: string; name: string } | null;
    }
  >(`/api/admin/landing-pages/${id}`);
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

export const getAdminRoles = () => http.get<unknown, AdminRoleDefinitionItem[]>('/api/admin/admin-roles');
export const createAdminRole = (data: { name: string; description?: string; permissions: string[]; dataScope?: string; dataScopeMemberIds?: string[] }) => http.post<unknown, AdminRoleDefinitionItem>('/api/admin/admin-roles', data);
export const updateAdminRole = (id: string, data: { name?: string; description?: string; permissions?: string[]; dataScope?: string; dataScopeMemberIds?: string[] }) => http.patch<unknown, AdminRoleDefinitionItem>(`/api/admin/admin-roles/${id}`, data);
export const deleteAdminRole = (id: string) => http.delete<unknown, { id: string; deleted: boolean; affectedMembers: number }>(`/api/admin/admin-roles/${id}`);

export const getWebsiteAnalytics = () => http.get<unknown, WebsiteAnalyticsSummary>('/api/admin/website/analytics');

export function createAdminUser(data: {
  username: string;
  password: string;
  role: string;
  customRoleId?: string;
  permissions: string[];
  notifyEnabled: boolean;
  dataScope?: string;
  dataScopeMemberIds?: string[];
  teamId?: string;
  consultationReceivable?: boolean;
}) {
  return http.post<unknown, AdminUserItem>('/api/admin/admin-users', data);
}

export function updateAdminUser(id: string, data: {
  password?: string;
  username?: string;
  role?: string;
  customRoleId?: string | null;
  permissions?: string[];
  status?: string;
  notifyEnabled?: boolean;
  dataScope?: string;
  dataScopeMemberIds?: string[];
  teamId?: string | null;
  consultationReceivable?: boolean;
}) {
  return http.patch<unknown, AdminUserItem>(`/api/admin/admin-users/${id}`, data);
}
export function getAdminUserHandoverSummary(id: string) { return http.get<unknown, { consultations: number; todayCallbacks: number; overdueCallbacks: number; appointments: number; promotionAccounts: number; tencentLeads: number; total: number }>(`/api/admin/admin-users/${id}/handover-summary`); }
export function deleteAdminUser(id: string, successorAdminId: string) { return http.delete<unknown, { id: string; deleted: boolean }>(`/api/admin/admin-users/${id}`, { data: { successorAdminId } }); }
export const getAdminTeams = () => http.get<unknown, AdminTeamItem[]>('/api/admin/admin-teams');
export const createAdminTeam = (data: Partial<AdminTeamItem>) => http.post<unknown, AdminTeamItem>('/api/admin/admin-teams', data);
export const updateAdminTeam = (id: string, data: Partial<AdminTeamItem>) => http.patch<unknown, AdminTeamItem>(`/api/admin/admin-teams/${id}`, data);
export const deleteAdminTeam = (id: string) => http.delete(`/api/admin/admin-teams/${id}`);
export interface OfficialAccountBinding { enabled: boolean; appId: string; hasAppSecret: boolean; hasToken: boolean; hasEncodingAesKey: boolean; callbackUrl: string; }
export const getOfficialAccountBinding = () => http.get<unknown, OfficialAccountBinding>('/api/admin/official-account/binding');
export const updateOfficialAccountBinding = (data: { enabled: boolean; appId: string; appSecret?: string; token?: string; encodingAesKey?: string }) => http.patch<unknown, OfficialAccountBinding>('/api/admin/official-account/binding', data);
export interface AdminLoginPreference { defaultWechatLogin: boolean; bindingReady: boolean; }
export const getAdminLoginPreference = () => http.get<unknown, AdminLoginPreference>('/api/admin/auth/login-preference');
export const updateAdminLoginPreference = (defaultWechatLogin: boolean) => http.patch<unknown, AdminLoginPreference>('/api/admin/official-account/login-preference', { defaultWechatLogin });

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

export function updateAppointmentNotifyConfig(data: { enabled?: boolean; templateId?: string; assignmentEnabled?: boolean; assignmentTemplateId?: string }) {
  return http.patch<unknown, AppointmentNotifyConfig>('/api/admin/appointment-notify', data);
}

export function getFollowupForwardConfig() {
  return http.get<unknown, FollowupForwardConfig>('/api/admin/followup-forward');
}

export function updateFollowupForwardConfig(data: Partial<FollowupForwardConfig>) {
  return http.patch<unknown, FollowupForwardConfig>('/api/admin/followup-forward', data);
}

const tencentAdsLeadsBase = '/api/admin/tencent-ads/leads';

export function getTencentAdsReceiverConfig() {
  return http.get<unknown, TencentAdsReceiverConfig>(`${tencentAdsLeadsBase}/receiver-config`);
}

export function getTencentAdLeads(params: Record<string, unknown>) {
  return http.get<unknown, PageResult<TencentAdLeadItem>>(tencentAdsLeadsBase, { params });
}

export function getTencentAdLead(id: string) {
  return http.get<unknown, TencentAdLeadItem>(`${tencentAdsLeadsBase}/${id}`);
}

export function revealTencentAdLeadPhone(id: string) {
  return http.post<unknown, { phone: string }>(`${tencentAdsLeadsBase}/${id}/reveal-phone`);
}

export function updateTencentAdLead(
  id: string,
  data: Pick<TencentAdLeadItem, 'status'> & { ineffectiveReason?: string; adminRemark?: string }
) {
  return http.patch<unknown, TencentAdLeadItem>(`${tencentAdsLeadsBase}/${id}`, data);
}

const operationsBase = '/api/admin/operations';
const operationParams = (params: Record<string, string>) => Object.fromEntries(
  Object.entries(params).filter(([, value]) => value.trim() !== ''),
) as Record<string, string>;
export const getPromotionAccounts = () => http.get<unknown, PromotionAccountItem[]>(`${operationsBase}/accounts`);
export const getPromotionMetricFields = () => http.get<unknown, PromotionMetricFieldItem[]>(`${operationsBase}/fields`);
export const createPromotionMetricField = (data: Pick<PromotionMetricFieldItem, 'label' | 'dataType' | 'isVisible' | 'sort'>) => http.post<unknown, PromotionMetricFieldItem>(`${operationsBase}/fields`, data);
export const updatePromotionMetricField = (id: string, data: Pick<PromotionMetricFieldItem, 'label' | 'dataType' | 'isVisible' | 'sort'>) => http.patch<unknown, PromotionMetricFieldItem>(`${operationsBase}/fields/${id}`, data);
export const deletePromotionMetricField = (id: string) => http.delete<unknown, { id: string; deleted?: boolean; hidden?: boolean }>(`${operationsBase}/fields/${id}`);
export const createPromotionAccount = (data: Omit<PromotionAccountItem, 'id'>) => http.post<unknown, PromotionAccountItem>(`${operationsBase}/accounts`, data);
export const updatePromotionAccount = (id: string, data: Omit<PromotionAccountItem, 'id'>) => http.patch<unknown, PromotionAccountItem>(`${operationsBase}/accounts/${id}`, data);
export const deletePromotionAccount = (id: string) => http.delete<unknown, { id: string; deleted: boolean }>(`${operationsBase}/accounts/${id}`);
export interface PromotionAccountCredentialStatus { accountId?: string; clientId?: string; authorizedAccountId?: string | null; hasAccessToken: boolean; hasClientSecret: boolean; hasRefreshToken: boolean; hasUserToken: boolean; userTokenExpiresAt?: string | null; accessTokenExpiresAt?: string | null; refreshTokenExpiresAt?: string | null; lastValidatedAt?: string | null; }
export const getPromotionAccountCredential = (id: string) => http.get<unknown, PromotionAccountCredentialStatus>(`${operationsBase}/accounts/${id}/credentials`);
export const savePromotionAccountCredential = (id: string, data: { accessToken?: string; clientId?: string; clientSecret?: string; refreshToken?: string; userToken?: string; userTokenExpiresAt?: string; clearAccessToken?: boolean; clearClientSecret?: boolean; clearRefreshToken?: boolean; clearUserToken?: boolean }) => http.put<unknown, PromotionAccountCredentialStatus>(`${operationsBase}/accounts/${id}/credentials`, data);
export interface TencentUserTokenStatus { hasUserToken: boolean; userTokenExpiresAt: string | null; }
export const getMyTencentUserToken = () => http.get<unknown, TencentUserTokenStatus>(`${operationsBase}/my-tencent-user-token`);
export const saveMyTencentUserToken = (data: { userToken?: string; userTokenExpiresAt?: string; clearUserToken?: boolean }) => http.put<unknown, TencentUserTokenStatus>(`${operationsBase}/my-tencent-user-token`, data);
export interface PromotionAccountAccessGrantItem { id: string; adminUserId: string; username?: string; nickname?: string; role?: string; grant?: { canViewData: boolean; canViewMaterials: boolean; canViewCreatives: boolean; canCreateCreatives: boolean }; canViewData?: boolean; canViewMaterials?: boolean; canViewCreatives?: boolean; canCreateCreatives?: boolean; }
export const getPromotionAccountAccessGrants = (id: string) => http.get<unknown, PromotionAccountAccessGrantItem[]>(`${operationsBase}/accounts/${id}/access-grants`);
export const savePromotionAccountAccessGrants = (id: string, grants: Array<Pick<PromotionAccountAccessGrantItem, 'adminUserId' | 'canViewData' | 'canViewMaterials' | 'canViewCreatives' | 'canCreateCreatives'>>) => http.put<unknown, { accountId: string; grants: PromotionAccountAccessGrantItem[] }>(`${operationsBase}/accounts/${id}/access-grants`, { grants });
export const getPromotionDailyMetrics = (params: Record<string, string>) => http.get<unknown, PromotionDailyMetricItem[]>(`${operationsBase}/daily`, { params: operationParams(params) });
export const getPromotionDashboard = (params: Record<string, string>) => http.get<unknown, PromotionFilterData>(`${operationsBase}/dashboard`, { params: operationParams(params) });
export const getPromotionFilterData = (params: Record<string, string>) => http.get<unknown, PromotionFilterData>(`${operationsBase}/filter-data`, { params: operationParams(params) });
export const createPromotionDailyMetric = (data: PromotionDailyMetricPayload) => http.post<unknown, PromotionDailyMetricItem>(`${operationsBase}/daily`, data);
export const updatePromotionDailyMetric = (id: string, data: PromotionDailyMetricPayload) => http.patch<unknown, PromotionDailyMetricItem>(`${operationsBase}/daily/${id}`, data);
export const deletePromotionDailyMetric = (id: string) => http.delete<unknown, { id: string; deleted: boolean }>(`${operationsBase}/daily/${id}`);
export const archivePromotionDailyMetric = (id: string, isArchived: boolean) => http.patch<unknown, PromotionDailyMetricItem>(`${operationsBase}/daily/${id}/archive`, { isArchived });
export const getPromotionSyncConfigs = () => http.get<unknown, PromotionDataSyncConfigItem[]>(`${operationsBase}/sync-configs`);
export const updatePromotionSyncConfig = (data: { provider: 'TENCENT_ADS' | 'OCEANENGINE'; enabled: boolean; reportUrl: string; accessToken?: string; clientId?: string; clientSecret?: string; refreshToken?: string; userToken?: string; userTokenExpiresAt?: string }) => http.put<unknown, PromotionDataSyncConfigItem>(`${operationsBase}/sync-configs`, data);
export interface TencentBusinessUnitCredentialStatus {
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  hasClientSecret: boolean;
  clientId: string;
  updatedAt: string | null;
  accounts: Array<{ id: string; accountNo: string; name: string; covered: boolean }>;
}
export interface TencentBusinessUnitCredentialResult {
  covered: Array<{ accountNo: string; name: string }>;
  rejected: Array<{ accountNo: string; name: string; reason: string }>;
  updatedAt: string;
}
export const getTencentBusinessUnitCredential = () => http.get<unknown, TencentBusinessUnitCredentialStatus>(`${operationsBase}/sync-configs/tencent-business-unit`);
export const updateTencentBusinessUnitCredential = (data: { clientId: string; clientSecret: string; accessToken: string; refreshToken: string }) => http.put<unknown, TencentBusinessUnitCredentialResult>(`${operationsBase}/sync-configs/tencent-business-unit`, data);
export const syncPromotionDailyMetrics = (data: { statDate: string; provider?: 'TENCENT_ADS' | 'OCEANENGINE'; accountIds?: string[] }) => http.post<unknown, Array<{ provider: string; synced: number; noData: number; skippedArchived: number; skipped: number; errors: string[] }>>(`${operationsBase}/daily/sync`, data);
export const getPromotionHealthAccounts = () => http.get<unknown, PromotionHealthAccountsResult>(`${operationsBase}/health/accounts`);
export const analyzePromotionHealth = (data: { accountIds: string[]; dateFrom: string; dateTo: string; syncEndDate?: boolean }) => http.post<unknown, PromotionHealthReport>(`${operationsBase}/health/analyze`, data);
export const analyzePromotionMaterials = (data: { provider?: 'TENCENT_ADS' | 'OCEANENGINE'; accountId?: string; dateFrom: string; dateTo: string }) => http.post<unknown, PromotionMaterialReport>(`${operationsBase}/health/materials`, data);
export const getPromotionCreativeBatchOptions = () => http.get<unknown, PromotionCreativeBatchOptions>(`${operationsBase}/creative-batches/options`);
export const getPromotionCreativeAdgroups = (params: { accountId: string; search?: string; page?: number; pageSize?: number }) => http.get<unknown, { list: PromotionCreativeAdgroup[]; pageInfo: PlatformPageInfo }>(`${operationsBase}/creative-batches/adgroups`, { params });
export const getPromotionCreativeTemplates = (params: { accountId: string; adgroupId: string; deliveryMode: string; dynamicCreativeType: string; search?: string; page?: number; pageSize?: number }) => http.get<unknown, { list: PromotionCreativeTemplate[]; pageInfo: PlatformPageInfo }>(`${operationsBase}/creative-batches/templates`, { params });
export const getPromotionCreativeTemplateDetail = (params: { accountId: string; adgroupId: string; templateId: string; deliveryMode: string; dynamicCreativeType: string }) => http.get<unknown, { id: string; template: Record<string, unknown>; requirements: Array<{ name: string; path: string; required: boolean; elementType?: string; fieldType?: string; min: number; max: number | null; description?: string; restriction?: Record<string, unknown> }> }>(`${operationsBase}/creative-batches/template-detail`, { params });
export const getPromotionCreativeAssets = (params: { accountId: string; source: 'ACCOUNT' | 'BUSINESS_UNIT'; businessUnitKey?: string; assetType?: string; dimensions?: string; search?: string; adgroupId?: string; templateId?: string; deliveryMode?: string; dynamicCreativeType?: string; sortBy?: string; sortOrder?: 'ASC' | 'DESC'; page?: number; pageSize?: number; refresh?: boolean }) => http.get<unknown, { list: PromotionCreativeAsset[]; pageInfo: PlatformPageInfo; availableDimensions: string[] }>(`${operationsBase}/creative-batches/assets`, { params });
export const getPromotionCreativeAssetUsageCounts = (accountId: string, assetIds: string[], refresh = false) => http.get<unknown, { scope: 'TENCENT_PLATFORM'; counts: Record<string, number> }>(`${operationsBase}/creative-batches/assets/usage`, { params: { accountId, assetIds: assetIds.join(','), refresh } });
export const getPromotionCreativeAssetUsage = (accountId: string, assetId: string) => http.get<unknown, { asset: { id: string; name: string }; scope: 'TENCENT_PLATFORM'; total: number; list: Array<{ id: string; name: string; adgroupId: string }> }>(`${operationsBase}/creative-batches/assets/${encodeURIComponent(assetId)}/creatives`, { params: { accountId } });
export const previewPromotionCreativeBatch = (data: PromotionCreativeBatchPayload) => http.post<unknown, { account: Record<string, unknown>; adgroup: Record<string, unknown>; template: Record<string, unknown>; items: Array<{ sequence: number; name: string; materials: Array<Record<string, unknown>>; creativeComponents: Record<string, unknown[]> }>; maxBatchSize: number; requiresConfirmation: boolean }>(`${operationsBase}/creative-batches/preview`, data);
export const createPromotionCreativeBatch = (data: PromotionCreativeBatchPayload) => http.post<unknown, PromotionCreativeBatchTask>(`${operationsBase}/creative-batches`, data);
export const getPromotionCreativeBatchTasks = (params: { accountId?: string; status?: string; search?: string; page?: number; pageSize?: number }) => http.get<unknown, { list: PromotionCreativeBatchTask[]; pageInfo: PlatformPageInfo }>(`${operationsBase}/creative-batches`, { params });
export const getPromotionCreativeBatchTask = (id: string) => http.get<unknown, PromotionCreativeBatchTask>(`${operationsBase}/creative-batches/${id}`);
export const retryPromotionCreativeBatch = (id: string) => http.post<unknown, PromotionCreativeBatchTask>(`${operationsBase}/creative-batches/${id}/retry`);
export const cancelPromotionCreativeBatch = (id: string) => http.post<unknown, { id: string; cancelled: boolean }>(`${operationsBase}/creative-batches/${id}/cancel`);
export async function exportPromotionCreativeBatch(id: string) {
  const token = localStorage.getItem('admin_token') || '';
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}${operationsBase}/creative-batches/${id}/export`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || '导出失败');
  const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `creative-batch-${id}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
export const getMultiAccountCreativeOptions = () => http.get<unknown, PromotionCreativeBatchOptions>(`${operationsBase}/multi-account-creative-batches/options`);
export const getMultiAccountCreativeAdgroups = (params: { accountId: string; search?: string; page?: number; pageSize?: number }) => http.get<unknown, { list: PromotionCreativeAdgroup[]; pageInfo: PlatformPageInfo }>(`${operationsBase}/multi-account-creative-batches/adgroups`, { params });
export const getMultiAccountCreativeTemplates = (params: { accountId: string; adgroupId: string; deliveryMode: string; dynamicCreativeType: string; search?: string; page?: number; pageSize?: number }) => http.get<unknown, { list: PromotionCreativeTemplate[]; pageInfo: PlatformPageInfo }>(`${operationsBase}/multi-account-creative-batches/templates`, { params });
export const getMultiAccountCreativeAssets = (params: { accountId: string; source: 'ACCOUNT' | 'BUSINESS_UNIT'; businessUnitKey?: string; assetType?: string; dimensions?: string; search?: string; sortBy?: string; sortOrder?: 'ASC' | 'DESC'; page?: number; pageSize?: number; refresh?: boolean }) => http.get<unknown, { list: PromotionCreativeAsset[]; pageInfo: PlatformPageInfo; availableDimensions: string[] }>(`${operationsBase}/multi-account-creative-batches/assets`, { params });
export const preflightMultiAccountCreativeBatch = (data: MultiAccountCreativePayload) => http.post<unknown, MultiAccountCreativePreflight>(`${operationsBase}/multi-account-creative-batches/preflight`, data, { timeout: 180000 });
export const createMultiAccountCreativeBatch = (data: MultiAccountCreativePayload) => http.post<unknown, MultiAccountCreativeTask>(`${operationsBase}/multi-account-creative-batches`, data, { timeout: 180000 });
export const getMultiAccountCreativeTasks = (params: { accountId?: string; adgroupId?: string; createdByAdminId?: string; status?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number }) => http.get<unknown, { list: MultiAccountCreativeTask[]; pageInfo: PlatformPageInfo }>(`${operationsBase}/multi-account-creative-batches`, { params });
export const getMultiAccountCreativeTask = (id: string) => http.get<unknown, MultiAccountCreativeTask>(`${operationsBase}/multi-account-creative-batches/${id}`);
export const retryMultiAccountCreativeBatch = (id: string) => http.post<unknown, MultiAccountCreativeTask>(`${operationsBase}/multi-account-creative-batches/${id}/retry`);
export const cancelMultiAccountCreativeBatch = (id: string) => http.post<unknown, { id: string; cancelled: boolean }>(`${operationsBase}/multi-account-creative-batches/${id}/cancel`);
export const getCreativeDefaultComponents = (accountId: string) => http.get<unknown, Array<{ id: string; accountId: string; componentType: string; platformComponentId: string; componentName: string; creativeType?: string; marketingGoal?: string; templateId?: string; status: string; priority: number; lastValidatedAt?: string }>>(`${operationsBase}/multi-account-creative-batches/default-components`, { params: { accountId } });
export const saveCreativeDefaultComponent = (data: { accountId: string; componentType: string; platformComponentId: string; componentName: string; creativeType?: string; marketingGoal?: string; templateId?: string; priority?: number }) => http.post(`${operationsBase}/multi-account-creative-batches/default-components`, data);
export const disableCreativeDefaultComponent = (id: string) => http.delete(`${operationsBase}/multi-account-creative-batches/default-components/${id}`);
export async function exportMultiAccountCreativeBatch(id: string) {
  const token = localStorage.getItem('admin_token') || '';
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}${operationsBase}/multi-account-creative-batches/${id}/export`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || '导出失败');
  const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `multi-account-creative-batch-${id}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
export const getPromotionWeekly = (params: Record<string, string>) => http.get<unknown, PromotionSummaryItem[]>(`${operationsBase}/weekly`, { params: operationParams(params) });
export const getPromotionMonthly = (params: Record<string, string>) => http.get<unknown, PromotionSummaryItem[]>(`${operationsBase}/monthly`, { params: operationParams(params) });
export const getPromotionDailyReport = (date: string) => http.get<unknown, PromotionDailyReport>(`${operationsBase}/daily-report`, { params: { date } });
export const getPromotionWeeklyReport = (date: string, dateTo?: string) => http.get<unknown, PromotionDailyReport>(`${operationsBase}/weekly-report`, { params: { date, dateTo } });
export const getPromotionMonthlyReport = (date: string) => http.get<unknown, PromotionDailyReport>(`${operationsBase}/monthly-report`, { params: { date } });
export const getPromotionSalary = (month: string) => http.get<unknown, PromotionSalaryReport>(`${operationsBase}/salary`, { params: { month } });
export const updatePromotionSalaryConfig = (data: PromotionSalaryConfig) => http.put<unknown, PromotionSalaryConfig>(`${operationsBase}/salary/config`, data);
export const updatePromotionDailyReportNote = (data: { statDate: string; periodType?: 'day' | 'week' | 'month'; project: string; channel: string; problem: string; adjustment: string }) => http.patch<unknown, unknown>(`${operationsBase}/daily-report/note`, data);

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

export interface WebsiteSettings {
  brandName: string; siteTagline: string; heroTitle: string; heroDescription: string;
  topics: string; footerDescription: string; icpNumber: string; defaultAuthor: string;
}
export interface WebsiteArticleItem {
  id: string; slug: string; title: string; categoryId: string; category?: { id: string; name: string; slug: string }; author?: string; digest?: string; coverUrl?: string;
  seoTitle?: string; seoKeywords?: string; seoDescription?: string;
  contentHtml?: string; originalUrl?: string; sourceType: 'MANUAL' | 'WECHAT';
  status: 'ACTIVE' | 'DISABLED'; viewCount: number; publishedAt?: string; lastSyncedAt?: string;
}
export interface WebsiteArticleCategoryItem {
  id: string; name: string; slug: string; description?: string; sort: number;
  status: 'ACTIVE' | 'DISABLED'; _count?: { articles: number };
}
export type WebsiteArticlePayload = Pick<WebsiteArticleItem, 'title' | 'categoryId' | 'author' | 'digest' | 'seoTitle' | 'seoKeywords' | 'seoDescription' | 'coverUrl' | 'contentHtml' | 'originalUrl' | 'publishedAt' | 'status'>;
const websiteAdminBase = '/api/admin/website';
export const getWebsiteSettings = () => http.get<unknown, WebsiteSettings>(`${websiteAdminBase}/settings`);
export const updateWebsiteSettings = (settings: WebsiteSettings) => http.patch<unknown, WebsiteSettings>(`${websiteAdminBase}/settings`, { settings });
export const getWebsiteArticleCategories = () => http.get<unknown, WebsiteArticleCategoryItem[]>(`${websiteAdminBase}/categories`);
export const createWebsiteArticleCategory = (data: Omit<WebsiteArticleCategoryItem, 'id' | '_count'>) => http.post<unknown, WebsiteArticleCategoryItem>(`${websiteAdminBase}/categories`, data);
export const updateWebsiteArticleCategory = (id: string, data: Partial<WebsiteArticleCategoryItem>) => http.patch<unknown, WebsiteArticleCategoryItem>(`${websiteAdminBase}/categories/${id}`, data);
export const deleteWebsiteArticleCategory = (id: string) => http.delete(`${websiteAdminBase}/categories/${id}`);
export const getWebsiteArticles = (status?: 'ACTIVE' | 'DISABLED') => http.get<unknown, { total: number; list: WebsiteArticleItem[] }>(`${websiteAdminBase}/articles`, { params: { page: 1, pageSize: 50, status } });
export const getWebsiteArticle = (id: string) => http.get<unknown, WebsiteArticleItem>(`${websiteAdminBase}/articles/${id}`);
export const createWebsiteArticle = (data: WebsiteArticlePayload) => http.post<unknown, WebsiteArticleItem>(`${websiteAdminBase}/articles`, data);
export const updateWebsiteArticle = (id: string, data: Partial<WebsiteArticlePayload>) => http.patch<unknown, WebsiteArticleItem>(`${websiteAdminBase}/articles/${id}`, data);
export const deleteWebsiteArticle = (id: string) => http.delete(`${websiteAdminBase}/articles/${id}`);

const consultationBase = '/api/admin/consultations';
export const getConsultationMetadata = () => http.get<unknown, ConsultationMetadata>(`${consultationBase}/metadata`);
export interface ConsultationReportRow { key: string; total: number; valid: number; effectiveRate: number; appointment: number; appointmentRate: number; arrived: number; arrivalRate: number; payment: number; custom: Record<string, number> }
export interface ConsultationReportTreeNode extends ConsultationReportRow { id: string; label: string; level: 'TEAM' | 'MEMBER' | 'PROJECT' | 'CHANNEL' | 'ACCOUNT'; children: ConsultationReportTreeNode[] }
export interface ConsultationReport { mode: 'channel' | 'daily'; from: string; to: string; fields: Array<{ code: string; name: string }>; availableFields: Array<{ code: string; name: string }>; summary: ConsultationReportRow; rows: ConsultationReportRow[]; tree: ConsultationReportTreeNode[] }
export const getConsultationReport = (params: { mode: 'channel' | 'daily'; from: string; to: string; project?: string; channel?: string; customFields?: string }) => http.get<unknown, ConsultationReport>('/api/admin/consultation-reports', { params });
export const getConsultations = (params: Record<string, unknown>) => http.get<unknown, PageResult<ConsultationFormItem>>(consultationBase, { params });
export const getConsultation = (id: string) => http.get<unknown, ConsultationFormItem>(`${consultationBase}/${id}`);
export const createConsultation = (data: Record<string, unknown>) => http.post<unknown, ConsultationFormItem>(consultationBase, data);
export const updateConsultation = (id: string, data: Record<string, unknown>) => http.patch<unknown, ConsultationFormItem>(`${consultationBase}/${id}`, data);
export const addConsultationFollowUp = (id: string, data: Record<string, unknown>) => http.post<unknown, ConsultationFormItem>(`${consultationBase}/${id}/follow-ups`, data);
export const assignConsultation = (id: string, data: { ownerAdminId: string; reason?: string }) => http.patch(`${consultationBase}/${id}/assign`, data);
export const bulkAssignConsultations = (data: { ids: string[]; ownerAdminId: string; reason?: string }) => http.post(`${consultationBase}/bulk-assign`, data);
export const previewBulkAssignConsultations = (data: { ids: string[]; ownerAdminId: string; reason?: string }) => http.post(`${consultationBase}/bulk-assign/preview`, data);
export const bulkAddConsultationTags = (data: { ids: string[]; tagIds: string[] }) => http.post(`${consultationBase}/bulk-tags/add`, data);
export const bulkRemoveConsultationTags = (data: { ids: string[]; tagIds: string[] }) => http.post(`${consultationBase}/bulk-tags/remove`, data);
export const getConsultationCallbacks = () => http.get<unknown, { counts: { today: number; overdue: number; completed: number }; today: ConsultationFormItem[]; overdue: ConsultationFormItem[] }>(`${consultationBase}/callbacks/today`);
export const saveConsultationListPreference = (columns: Array<{ code: string; visible: boolean; order: number; width: number }>) => http.put(`${consultationBase}/list-preference`, { columns });
export const getConsultationFields = () => http.get<unknown, ConsultationFieldItem[]>(`${consultationBase}/settings/fields`);
export const createConsultationField = (data: Record<string, unknown>) => http.post<unknown, ConsultationFieldItem>(`${consultationBase}/settings/fields`, data);
export const updateConsultationField = (id: string, data: Record<string, unknown>) => http.patch<unknown, ConsultationFieldItem>(`${consultationBase}/settings/fields/${id}`, data);
export const deleteConsultationField = (id: string) => http.delete(`${consultationBase}/settings/fields/${id}`);
export const getConsultationStatuses = () => http.get<unknown, ConsultationStatusItem[]>(`${consultationBase}/settings/statuses`);
export const createConsultationStatus = (data: Record<string, unknown>) => http.post<unknown, ConsultationStatusItem>(`${consultationBase}/settings/statuses`, data);
export const updateConsultationStatus = (id: string, data: Record<string, unknown>) => http.patch<unknown, ConsultationStatusItem>(`${consultationBase}/settings/statuses/${id}`, data);
export const deleteConsultationStatus = (id: string) => http.delete(`${consultationBase}/settings/statuses/${id}`);
export const getConsultationTags = () => http.get<unknown, ConsultationTagItem[]>(`${consultationBase}/settings/tags`);
export const createConsultationTag = (data: Record<string, unknown>) => http.post<unknown, ConsultationTagItem>(`${consultationBase}/settings/tags`, data);
export const updateConsultationTag = (id: string, data: Record<string, unknown>) => http.patch<unknown, ConsultationTagItem>(`${consultationBase}/settings/tags/${id}`, data);
export const deleteConsultationTag = (id: string) => http.delete(`${consultationBase}/settings/tags/${id}`);
export function validateConsultationImport(file: File) { const data = new FormData(); data.append('file', file); return http.post<unknown, any>(`${consultationBase}/import/validate`, data, { headers: { 'Content-Type': 'multipart/form-data' } }); }
export const commitConsultationImport = (batchId: string, duplicateMode: 'SKIP' | 'CREATE' | 'FOLLOW_UP') => http.post(`${consultationBase}/import/${batchId}/commit`, { duplicateMode });

async function downloadAdminFile(path: string, filename: string, params?: Record<string, unknown>) {
  const query = new URLSearchParams(); Object.entries(params || {}).forEach(([key, value]) => { if (value !== undefined && value !== '' && value !== null) query.set(key, Array.isArray(value) ? value.join(',') : String(value)); });
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''; const token = localStorage.getItem('admin_token') || '';
  const response = await fetch(`${baseUrl}${path}${query.size ? `?${query}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) { const body = await response.json().catch(() => null); const message = body?.message || '下载失败'; ElMessage.error(message); throw new Error(message); }
  const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
export const downloadConsultationTemplate = () => downloadAdminFile(`${consultationBase}/import/template`, '网咨数据导入模板.xlsx');
export const downloadConsultationImportErrors = (batchId: string) => downloadAdminFile(`${consultationBase}/import/${batchId}/errors`, '网咨导入错误明细.xlsx');
export const exportConsultations = (params: Record<string, unknown>) => downloadAdminFile(`${consultationBase}/export/file`, `网咨数据-${new Date().toISOString().slice(0, 10)}.xlsx`, params);

export type SmartMonitorAccount = { id: string; name: string; accountNo: string; platform: string; project: string; status: string; policy: { enabled: boolean; autoEnabled: boolean; emergencyStop: boolean } };
export type SmartMonitorMetrics = { targetCpa: number | null; targetSource: string | null; spend: number | null; impressions: number | null; clicks: number | null; conversions: number | null; actualCpa: number | null; costRatio: number | null; reportSource: string | null; reportPeriodStart: string | null; reportPeriodEnd: string | null; fetchedAt: string | null; reportAgeMinutes: number | null; backfillStatus: string | null; evidenceHours: number; recommendation: string; assessment: { state: 'INSUFFICIENT' | 'NORMAL' | 'WARNING'; evidence: string; ratio: number | null } };
export type SmartMonitorAdgroup = SmartMonitorMetrics & { id: string; name: string; configuredStatus: string | null; systemStatus: string | null; beginDate: string | null; endDate: string | null; optimizationGoal: string | null; bidMode: string | null; targetUnit: string | null; targetStatus: string; targetUpdatedAt: number | null };
export type SmartMonitorPolicy = { enabled: boolean; autoEnabled: boolean; emergencyStop: boolean; spendThreshold: number; emptySpendThreshold: number; cpaThreshold: number; maxReportAgeMinutes: number };
export type SmartMonitorDashboard = { account: Omit<SmartMonitorAccount, 'policy'>; credential: { enabled: boolean; authorized: boolean; hasUserToken: boolean }; policy: SmartMonitorPolicy; policySource: 'CHANNEL' | 'LEGACY_ACCOUNT'; granularity: string; adgroups: SmartMonitorAdgroup[]; creatives: Array<SmartMonitorMetrics & { id: string; name: string; adgroupId: string; configuredStatus: string | null; systemStatus: string | null; auditStatus: string | null; createdTime: string | null; metricsStatus: string }>; warnings: string[]; fetchedAt: string | null; requestIds: { adgroups?: string; creatives?: string }; trend: { labels: string[]; spend: number[] }; capabilities: Array<{ endpoint: string; interfaceExists: boolean; projectImplemented: boolean; accountVerified: boolean; validationStatus: string; requestId: string | null; verifiedAt: string | null; safeNote: string | null }> };
export const getSmartMonitorAccounts = () => http.get<unknown, SmartMonitorAccount[]>(`${operationsBase}/smart-monitor/accounts`);
export const getSmartMonitorDashboard = (accountId: string, refresh = true) => http.get<unknown, SmartMonitorDashboard>(`${operationsBase}/smart-monitor/accounts/${accountId}`, { params: { refresh } });
export const saveSmartMonitorPolicy = (accountId: string, policy: { enabled: boolean; ratioThreshold: number; minSpend: number; minConversions: number; maxReportAgeMinutes: number }) => http.put<unknown, unknown>(`${operationsBase}/smart-monitor/accounts/${accountId}/policy`, policy);
export const saveSmartMonitorChannelPolicy = (channelKey: string, policy: Pick<SmartMonitorPolicy, 'enabled' | 'spendThreshold' | 'emptySpendThreshold' | 'cpaThreshold' | 'maxReportAgeMinutes'>) => http.put<unknown, SmartMonitorPolicy>(`${operationsBase}/smart-monitor/channels/${encodeURIComponent(channelKey)}/policy`, policy);
export type SmartMonitorActionResult = { id?: string; status: string; creativeId: string; adgroupId: string; platformRequestId: string | null; errorCode?: string | null; errorMessage?: string | null; verifiedAt?: string | null; action?: string; scheduledAt?: string | null; attemptedAt?: string | null; createdAt?: string; replacementId?: string | null };
export const changeSmartMonitorCreativeStatus = (accountId: string, creativeId: string, configuredStatus: 'AD_STATUS_NORMAL' | 'AD_STATUS_SUSPEND', idempotencyKey: string, reason: string) =>
  http.post<unknown, SmartMonitorActionResult>(`${operationsBase}/smart-monitor/accounts/${accountId}/creatives/${creativeId}/status`, { configuredStatus, idempotencyKey, reason, confirmed: true });
export const scheduleSmartMonitorCreativeResume = (accountId: string, creativeId: string, scheduledAt: string, idempotencyKey: string, reason: string) =>
  http.post<unknown, SmartMonitorActionResult>(`${operationsBase}/smart-monitor/accounts/${accountId}/creatives/${creativeId}/schedule-resume`, { scheduledAt, idempotencyKey, reason, confirmed: true });
export const reconcileSmartMonitorAction = (accountId: string, actionId: string) =>
  http.post<unknown, SmartMonitorActionResult>(`${operationsBase}/smart-monitor/accounts/${accountId}/actions/${actionId}/reconcile`, {});
export const getSmartMonitorActions = (accountId: string) =>
  http.get<unknown, SmartMonitorActionResult[]>(`${operationsBase}/smart-monitor/accounts/${accountId}/actions`);
export const deleteSmartMonitorCreative = (accountId: string, creativeId: string, confirmationCreativeId: string, idempotencyKey: string, reason: string) =>
  http.post<unknown, SmartMonitorActionResult>(`${operationsBase}/smart-monitor/accounts/${accountId}/creatives/${creativeId}/delete`, { confirmationCreativeId, idempotencyKey, reason, confirmed: true });
export const reconcileSmartMonitorDeletion = (accountId: string, actionId: string) =>
  http.post<unknown, SmartMonitorActionResult>(`${operationsBase}/smart-monitor/accounts/${accountId}/actions/${actionId}/reconcile-deletion`, {});
export const cancelSmartMonitorSchedule = (accountId: string, actionId: string) =>
  http.post<unknown, SmartMonitorActionResult>(`${operationsBase}/smart-monitor/accounts/${accountId}/actions/${actionId}/cancel-schedule`, {});
