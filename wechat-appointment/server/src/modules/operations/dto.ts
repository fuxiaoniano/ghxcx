import { ContentStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class PromotionAccountDto {
  @IsString() @MaxLength(120) name!: string;
  @IsIn(['重庆', '绵阳']) project!: string;
  @IsString() @MaxLength(80) platform!: string;
  @IsOptional() @IsString() @MaxLength(120) accountNo?: string;
  @IsOptional() @IsIn(Object.values(ContentStatus)) status?: ContentStatus;
  @IsOptional() @IsString() @MaxLength(500) remark?: string;
}

export class PromotionDailyMetricDto {
  @IsString() @MaxLength(32) accountId!: string;
  @IsDateString() statDate!: string;
  @Type(() => Number) @IsNumber() @Min(0) spend!: number;
  @Type(() => Number) @IsInt() @Min(0) impressions!: number;
  @Type(() => Number) @IsInt() @Min(0) clicks!: number;
  @Type(() => Number) @IsInt() @Min(0) leads!: number;
  @Type(() => Number) @IsInt() @Min(0) validLeads!: number;
  @Type(() => Number) @IsInt() @Min(0) appointments!: number;
  @Type(() => Number) @IsInt() @Min(0) transactions!: number;
  @Type(() => Number) @IsNumber() @Min(0) revenue!: number;
  @IsOptional() @IsObject() customMetrics?: Record<string, number | string>;
  @IsOptional() @IsString() @MaxLength(500) remark?: string;
}

export class DateRangeQueryDto {
  @Transform(({ value }) => value || undefined)
  @IsOptional() @IsDateString() dateFrom?: string;
  @Transform(({ value }) => value || undefined)
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsString() @MaxLength(32) accountId?: string;
}

export class PromotionSalaryQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month!: string;
}

export class PromotionSalaryRegionRuleDto {
  @Type(() => Number) @IsNumber() @Min(0) minDailyLeads!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(1) minValidRate!: number;
  @Type(() => Number) @IsNumber() @Min(0) maxAverageCost!: number;
}

export class PromotionSalaryTierDto {
  @Type(() => Number) @IsInt() @Min(0) salary!: number;
  @ValidateNested() @Type(() => PromotionSalaryRegionRuleDto) chongqing!: PromotionSalaryRegionRuleDto;
  @ValidateNested() @Type(() => PromotionSalaryRegionRuleDto) mianyang!: PromotionSalaryRegionRuleDto;
}

export class PromotionSalaryConfigDto {
  @Type(() => Number) @IsInt() @Min(0) baseSalary!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(31) recentDays!: number;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PromotionSalaryTierDto) tiers!: PromotionSalaryTierDto[];
}

export class PromotionMetricFieldDto {
  @IsString() @MaxLength(80) label!: string;
  @IsOptional() @IsIn(['NUMBER', 'TEXT']) dataType?: 'NUMBER' | 'TEXT';
  @IsOptional() isVisible?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort?: number;
}

export class PromotionDailyReportNoteDto {
  @IsDateString() statDate!: string;
  @IsOptional() @IsIn(['day', 'week', 'month']) periodType?: 'day' | 'week' | 'month';
  @IsString() @MaxLength(120) project!: string;
  @IsString() @MaxLength(80) channel!: string;
  @IsString() @MaxLength(500) problem!: string;
  @IsString() @MaxLength(500) adjustment!: string;
}

export class PromotionDataSyncConfigDto {
  @IsIn(['TENCENT_ADS', 'OCEANENGINE']) provider!: 'TENCENT_ADS' | 'OCEANENGINE';
  enabled!: boolean;
  @IsString() @MaxLength(500) reportUrl!: string;
  @IsOptional() @IsString() @MaxLength(4000) accessToken?: string;
  @IsOptional() @IsString() @MaxLength(64) clientId?: string;
  @IsOptional() @IsString() @MaxLength(4000) clientSecret?: string;
  @IsOptional() @IsString() @MaxLength(4000) refreshToken?: string;
}

export class SyncPromotionDailyMetricsDto {
  @IsDateString() statDate!: string;
  @IsOptional() @IsIn(['TENCENT_ADS', 'OCEANENGINE']) provider?: 'TENCENT_ADS' | 'OCEANENGINE';
  @IsOptional() @IsString({ each: true }) @MaxLength(32, { each: true }) accountIds?: string[];
}

export class ArchivePromotionDailyMetricDto {
  @IsBoolean()
  isArchived!: boolean;
}
