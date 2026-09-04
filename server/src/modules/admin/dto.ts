import {
  IsArray,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
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
  'MANAGE_CONFIGS',
  'MANAGE_ADMINS',
  // 企业官网升级权限继续复用原管理员 permissionsJson 字段。
  'HOME_MANAGE',
  'DOCTOR_MANAGE',
  'PACKAGE_MANAGE',
  'APPOINTMENT_MANAGE'
] as const;

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

export class UpdateAdminUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @IsOptional()
  nickname?: string;

  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;

  @IsIn(Object.values(AdminRole))
  @IsOptional()
  role?: AdminRole;

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
