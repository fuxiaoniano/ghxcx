import {
  IsArray,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsBoolean,
  Max,
  Matches,
  MinLength,
  Min,
  MaxLength
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdminRole, AdminStatus, AppointmentStatus, ClinicStatus, ContentStatus } from '@prisma/client';

export const ADMIN_PERMISSIONS = [
  'VIEW_FULL_PHONE',
  'EXPORT_FULL_PHONE',
  'MANAGE_APPOINTMENTS',
  'PROMOTION_MANAGE',
  'WECHAT_MANAGE',
  'SYSTEM_MANAGE',
  'MANAGE_ADMINS',
  // 企业官网升级权限继续复用原管理员 permissionsJson 字段。
  'HOME_MANAGE',
  'WEBSITE_MANAGE',
  'DOCTOR_MANAGE',
  'PACKAGE_MANAGE',
  'APPOINTMENT_MANAGE'
  ,'BUSINESS_LEADS', 'BUSINESS_APPOINTMENTS', 'BUSINESS_USERS', 'BUSINESS_NOTIFICATIONS'
  ,'PROMOTION_HOME', 'PROMOTION_DAILY', 'PROMOTION_WEEKLY', 'PROMOTION_MONTHLY', 'PROMOTION_FILTER', 'PROMOTION_DAILY_REPORT', 'PROMOTION_WEEKLY_REPORT', 'PROMOTION_MONTHLY_REPORT', 'PROMOTION_ACCOUNTS', 'PROMOTION_SYNC', 'PROMOTION_FIELDS', 'PROMOTION_SALARY'
  ,'CONTENT_HOME', 'CONTENT_DEPARTMENTS', 'CONTENT_DOCTORS', 'CONTENT_PACKAGES', 'CONTENT_MEDIA', 'CONTENT_LINKS'
  ,'WEBSITE_SETTINGS', 'WEBSITE_PAGES', 'WEBSITE_CATEGORIES', 'WEBSITE_ARTICLES'
  ,'WECHAT_MENU', 'WECHAT_AUTO_REPLY'
  ,'SYSTEM_MEMBERS', 'SYSTEM_OFFICIAL_BINDING', 'SYSTEM_CONFIGS', 'SYSTEM_FOLLOWUP', 'SYSTEM_WEBSITE_ANALYTICS', 'SYSTEM_AUDIT'
  ,'SYSTEM_ROLES'
  ,'CONSULTATION_VIEW', 'CONSULTATION_CREATE', 'CONSULTATION_EDIT', 'CONSULTATION_FOLLOW_UP', 'CONSULTATION_IMPORT', 'CONSULTATION_EXPORT', 'CONSULTATION_EXPORT_FULL_PHONE', 'CONSULTATION_ASSIGN', 'CONSULTATION_SETTINGS'
] as const;

export const ADMIN_DATA_SCOPES = ['SELF', 'ASSIGNED_MEMBERS', 'TEAM', 'ALL'] as const;

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class UpdateAppointmentStatusDto {
  @IsIn(Object.values(AppointmentStatus))
  status!: AppointmentStatus;
}

export class UpdateAppointmentRemarkDto {
  @IsString()
  @MaxLength(2000)
  adminRemark!: string;
}

export class AssignAppointmentDto {
  @IsString()
  @IsOptional()
  adminUserId?: string;
}

export class UpdateConfigsDto {
  @IsArray()
  configs!: Array<{
    key: string;
    valueJson: Record<string, unknown>;
    description?: string;
  }>;
}

export class CreateLandingPageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(32)
  @IsOptional()
  cloneFromId?: string;
}

export class UpdateLandingPageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @IsOptional()
  name?: string;

  @IsIn(Object.values(ContentStatus))
  @IsOptional()
  status?: ContentStatus;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}

export class AnyObjectDto {
  @IsObject()
  value!: Record<string, unknown>;
}

export class OfficialAccountMenuDto {
  @IsObject()
  menu!: Record<string, unknown>;
}

export class OfficialAutoReplyDto {
  @IsObject()
  autoReply!: Record<string, unknown>;
}

export class UpdateOfficialAccountBindingDto {
  @IsIn([true, false]) enabled!: boolean;
  @IsString() @MaxLength(64) appId!: string;
  @IsOptional() @IsString() @MaxLength(255) appSecret?: string;
  @IsOptional() @IsString() @MaxLength(255) token?: string;
  @IsOptional() @IsString() @MaxLength(64) encodingAesKey?: string;
}

export class UpdateAdminUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[\p{L}\p{N}._-]+$/u, { message: '登录账号只能包含中文、字母、数字、点、下划线和短横线' })
  @IsOptional()
  username?: string;

  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;

  @IsIn(Object.values(AdminRole))
  @IsOptional()
  role?: AdminRole;

  @IsString()
  @IsOptional()
  customRoleId?: string | null;

  @IsArray()
  @IsIn(ADMIN_PERMISSIONS, { each: true })
  @IsOptional()
  permissions?: string[];

  @IsIn(Object.values(AdminStatus))
  @IsOptional()
  status?: AdminStatus;

  @IsIn([true, false])
  @IsOptional()
  notifyEnabled?: boolean;

  @IsIn(ADMIN_DATA_SCOPES)
  @IsOptional()
  dataScope?: typeof ADMIN_DATA_SCOPES[number];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dataScopeMemberIds?: string[];

  @IsString()
  @IsOptional()
  teamId?: string | null;

  @IsBoolean()
  @IsOptional()
  consultationReceivable?: boolean;
}

export class CreateAdminUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[\p{L}\p{N}._-]+$/u, { message: '登录账号只能包含中文、字母、数字、点、下划线和短横线' })
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsIn(Object.values(AdminRole))
  role!: AdminRole;

  @IsString()
  @IsOptional()
  customRoleId?: string;

  @IsArray()
  @IsIn(ADMIN_PERMISSIONS, { each: true })
  permissions!: string[];

  @IsIn([true, false])
  @IsOptional()
  notifyEnabled?: boolean;

  @IsIn(ADMIN_DATA_SCOPES)
  @IsOptional()
  dataScope?: typeof ADMIN_DATA_SCOPES[number];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dataScopeMemberIds?: string[];

  @IsString()
  @IsOptional()
  teamId?: string;

  @IsBoolean()
  @IsOptional()
  consultationReceivable?: boolean;
}

export class CreateAdminRoleDefinitionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(64)
  name!: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  description?: string;

  @IsArray()
  @IsIn(ADMIN_PERMISSIONS, { each: true })
  permissions!: string[];

  @IsIn(ADMIN_DATA_SCOPES)
  @IsOptional()
  dataScope?: typeof ADMIN_DATA_SCOPES[number];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dataScopeMemberIds?: string[];
}

export class UpdateAdminRoleDefinitionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(64)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  description?: string;

  @IsArray()
  @IsIn(ADMIN_PERMISSIONS, { each: true })
  @IsOptional()
  permissions?: string[];

  @IsIn(ADMIN_DATA_SCOPES)
  @IsOptional()
  dataScope?: typeof ADMIN_DATA_SCOPES[number];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dataScopeMemberIds?: string[];
}

export class DeleteAdminUserDto {
  @IsString()
  @IsNotEmpty()
  successorAdminId!: string;
}

export class CreateAdminTeamDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsString() leaderAdminId?: string | null;
  @IsOptional() @IsIn(Object.values(AdminStatus)) status?: AdminStatus;
}

export class UpdateAdminTeamDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsString() leaderAdminId?: string | null;
  @IsOptional() @IsIn(Object.values(AdminStatus)) status?: AdminStatus;
}

export class CreateAdminWechatInviteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  nickname!: string;

  @IsIn(Object.values(AdminRole))
  role!: AdminRole;

  @IsArray()
  @IsIn(ADMIN_PERMISSIONS, { each: true })
  permissions!: string[];

  @IsIn([true, false])
  @IsOptional()
  notifyEnabled?: boolean;
}

export class CreateClinicDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  address?: string;

  @IsString()
  @MaxLength(32)
  @IsOptional()
  phone?: string;

  @IsIn(Object.values(ClinicStatus))
  @IsOptional()
  status?: ClinicStatus;
}

export class UpdateClinicDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  address?: string;

  @IsString()
  @MaxLength(32)
  @IsOptional()
  phone?: string;

  @IsIn(Object.values(ClinicStatus))
  @IsOptional()
  status?: ClinicStatus;
}

export class UpdateAppointmentNotifyConfigDto {
  @IsIn([true, false])
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  templateId?: string;
}

export class UpdateFollowupForwardConfigDto {
  @IsIn([true, false])
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  url?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  authHeader?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  authScheme?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  authToken?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(60000)
  @IsOptional()
  timeoutMs?: number;

  @IsIn([true, false])
  @IsOptional()
  includeFullPhone?: boolean;

  @IsObject()
  @IsOptional()
  extraHeaders?: Record<string, string>;
}
