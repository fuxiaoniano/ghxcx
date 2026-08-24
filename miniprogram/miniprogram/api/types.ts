export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface ClinicOption {
  id: string;
  name: string;
  address?: string;
  phone?: string;
}

export interface LandingPageConfig {
  brandName: string;
  activityTitle: string;
  originalPrice: string;
  activityPrice: string;
  subsidyText: string;
  includedItems: string[];
  filingNo: string;
  institutionName: string;
  privacyAgreement: string;
  customerServicePhone: string;
  footerText: string;
  formTopImages: string[];
  miniSubscribeTemplateId?: string;
  display: {
    brandSection: boolean;
    logo: boolean;
    brandName: boolean;
    brandSubtitle: boolean;
    brandBadge: boolean;
    bannerSection: boolean;
    subsidyText: boolean;
    priceCard: boolean;
    includedItems: boolean;
    formTopImages: boolean;
    formTitle: boolean;
    privacyAgreement: boolean;
    noticeText: boolean;
    footerSection: boolean;
    institutionName: boolean;
    filingNo: boolean;
    footerText: boolean;
    customerServicePhone: boolean;
    myAppointmentsButton: boolean;
  };
  text: {
    logoText: string;
    brandSubtitle: string;
    brandBadgeText: string;
    originalPriceLabel: string;
    activityPriceLabel: string;
    nameLabel: string;
    namePlaceholder: string;
    phoneLabel: string;
    phoneAuthorizedPrefix: string;
    phoneAuthorizeButtonText: string;
    ageLabel: string;
    missingTeethLabel: string;
    clinicLabel: string;
    clinicPlaceholder: string;
    remarkLabel: string;
    remarkPlaceholder: string;
    privacyCheckboxText: string;
    submitButtonText: string;
    noticeText: string;
    myAppointmentsButtonText: string;
    authModalTitle: string;
    authModalDescription: string;
    authModalButtonText: string;
    authModalCancelText: string;
    customerServiceLabel: string;
  };
  formOptions: {
    ageRanges: string[];
    missingTeethTypes: string[];
  };
  clinics: ClinicOption[];
}

export interface LoginResult {
  token: string;
  userId: string;
  phoneMasked?: string;
  hasPhone: boolean;
  miniOpenId: string;
  needManualPhone?: boolean;
  message?: string;
}

export interface Appointment {
  id: string;
  appointmentNo: string;
  name: string;
  phoneMasked: string;
  phoneTail: string;
  ageRange: string;
  missingTeethType: string;
  clinic: ClinicOption | null;
  remark?: string;
  source?: string;
  createdAt: string;
  expectedContactTime: string;
}
