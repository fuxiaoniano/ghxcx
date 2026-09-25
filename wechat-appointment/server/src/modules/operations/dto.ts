import { ContentStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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
