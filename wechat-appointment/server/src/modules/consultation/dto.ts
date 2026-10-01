import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from 'class-validator';
import { AdminStatus, ConsultationFieldType, ConsultationStatusCategory } from '@prisma/client';

export class ConsultationListQueryDto {
  @IsOptional() @IsString() @MaxLength(80) keyword?: string;
  @IsOptional() @IsString() @MaxLength(32) projectId?: string;
  @IsOptional() @IsString() @MaxLength(120) channelSource?: string;
  @IsOptional() @Transform(({ value }) => Array.isArray(value) ? value : String(value).split(',').filter(Boolean)) @IsString({ each: true }) tagIds?: string[];
  @IsOptional() @Transform(({ value }) => Array.isArray(value) ? value : String(value).split(',').filter(Boolean)) @IsString({ each: true }) statusIds?: string[];
  @IsOptional() @IsString() @MaxLength(32) ownerAdminId?: string;
  @IsOptional() @IsDateString() recordedFrom?: string;
  @IsOptional() @IsDateString() recordedTo?: string;
  @IsOptional() @IsDateString() followedFrom?: string;
  @IsOptional() @IsDateString() followedTo?: string;
  @IsOptional() @IsDateString() callbackFrom?: string;
  @IsOptional() @IsDateString() callbackTo?: string;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() overdue?: boolean;
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  })
  @IsObject()
  customFilters?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number;
}

export class CreateConsultationDto {
  @IsString() @IsNotEmpty() @MaxLength(64) name!: string;
  @IsString() @Matches(/^1\d{10}$/, { message: '手机号格式不正确' }) phone!: string;
  @IsString() @IsNotEmpty() @MaxLength(40) projectId!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) channelSource!: string;
  @IsString() @IsNotEmpty() @MaxLength(32) promotionAccountId!: string;
  @IsOptional() @IsString() @MaxLength(32) statusId?: string;
  @IsOptional() @IsString() @MaxLength(32) ownerAdminId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) tagIds?: string[];
  @IsOptional() @IsDateString() recordedAt?: string;
  @IsOptional() @Transform(({ value }) => value === '' ? null : value) @IsDateString() nextFollowUpAt?: string | null;
  @IsOptional() @IsString() @MaxLength(500) invalidReason?: string;
  @IsOptional() @IsObject() customData?: Record<string, unknown>;
  @IsOptional() @IsBoolean() forceDuplicate?: boolean;
  @IsOptional() @IsString() @MaxLength(500) duplicateReason?: string;
  @IsOptional() @IsString() @MaxLength(5000) firstFollowUp?: string;
  @IsOptional() @IsDateString() firstFollowUpAt?: string;
}

export class UpdateConsultationDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(64) name?: string;
  @IsOptional() @IsString() @Matches(/^1\d{10}$/, { message: '手机号格式不正确' }) phone?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(40) projectId?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) channelSource?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(32) promotionAccountId?: string;
  @IsOptional() @IsString() @MaxLength(32) statusId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) tagIds?: string[];
  @IsOptional() @IsDateString() recordedAt?: string;
  @IsOptional() @Transform(({ value }) => value === '' ? null : value) @IsDateString() nextFollowUpAt?: string | null;
  @IsOptional() @IsString() @MaxLength(500) invalidReason?: string | null;
  @IsOptional() @IsObject() customData?: Record<string, unknown>;
}

export class ConsultationFollowUpDto {
  @IsString() @IsNotEmpty() @MaxLength(5000) content!: string;
  @IsOptional() @IsString() @MaxLength(32) resultStatusId?: string;
  @IsOptional() @Transform(({ value }) => value === '' ? null : value) @IsDateString() nextFollowUpAt?: string | null;
}

export class ConsultationAssignDto {
  @IsString() @IsNotEmpty() @MaxLength(32) ownerAdminId!: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ConsultationBulkAssignDto extends ConsultationAssignDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsString({ each: true }) ids!: string[];
}

export class ConsultationBulkTagsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsString({ each: true }) ids!: string[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsString({ each: true }) tagIds!: string[];
}

export class ConsultationStatusDto {
  @IsString() @IsNotEmpty() @MaxLength(60) name!: string;
  @IsString() @Matches(/^[A-Z][A-Z0-9_]*$/) @MaxLength(60) code!: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsIn(Object.values(ConsultationStatusCategory)) category!: ConsultationStatusCategory;
}

export class UpdateConsultationStatusDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(60) name?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsIn(Object.values(ConsultationStatusCategory)) category?: ConsultationStatusCategory;
}

export class ConsultationTagDto {
  @IsString() @IsNotEmpty() @MaxLength(60) name!: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpdateConsultationTagDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(60) name?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class ConsultationFieldDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsString() @Matches(/^[a-z][a-z0-9_]*$/) @MaxLength(80) code!: string;
  @IsIn(Object.values(ConsultationFieldType)) type!: ConsultationFieldType;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() showInForm?: boolean;
  @IsOptional() @IsBoolean() showInDetail?: boolean;
  @IsOptional() @IsBoolean() showInList?: boolean;
  @IsOptional() @IsBoolean() filterable?: boolean;
  @IsOptional() @IsBoolean() exportable?: boolean;
  @IsOptional() @IsBoolean() importable?: boolean;
  @IsOptional() @IsString() @MaxLength(80) listTitle?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) listOrder?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(60) @Max(600) listWidth?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];
}

export class UpdateConsultationFieldDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() showInForm?: boolean;
  @IsOptional() @IsBoolean() showInDetail?: boolean;
  @IsOptional() @IsBoolean() showInList?: boolean;
  @IsOptional() @IsBoolean() filterable?: boolean;
  @IsOptional() @IsBoolean() exportable?: boolean;
  @IsOptional() @IsBoolean() importable?: boolean;
  @IsOptional() @IsString() @MaxLength(80) listTitle?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) listOrder?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(60) @Max(600) listWidth?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];
}

export class ConsultationListPreferenceDto {
  @IsArray() columns!: Array<{ code: string; visible: boolean; order: number; width: number }>;
}

export class ConsultationTeamMemberEligibilityDto {
  @IsOptional() @IsIn(Object.values(AdminStatus)) status?: AdminStatus;
}

export class CommitConsultationImportDto {
  @IsIn(['SKIP', 'CREATE', 'FOLLOW_UP']) duplicateMode!: 'SKIP' | 'CREATE' | 'FOLLOW_UP';
}
