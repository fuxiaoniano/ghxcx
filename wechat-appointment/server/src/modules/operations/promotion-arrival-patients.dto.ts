import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class PromotionArrivalPatientQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(120) keyword?: string;
  @IsOptional() @IsString() @MaxLength(32) accountId?: string;
  @IsOptional() @IsString() @MaxLength(40) project?: string;
  @IsOptional() @IsString() @MaxLength(80) channelSource?: string;
  @Transform(({ value }) => value || undefined) @IsOptional() @IsDateString() dateFrom?: string;
  @Transform(({ value }) => value || undefined) @IsOptional() @IsDateString() dateTo?: string;
}

export class PromotionArrivalPatientDto {
  @IsString() @MaxLength(32) accountId!: string;
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsOptional() @IsString() @Matches(/^1\d{10}$/) phone?: string;
  @IsDateString() arrivalDate!: string;
  @IsIn(['初诊', '复诊']) visitType!: '初诊' | '复诊';
  @Type(() => Number) @IsNumber() @Min(0) transactionAmount!: number;
  @Type(() => Number) @IsNumber() @Min(0) receivedAmount!: number;
  @IsOptional() @IsString() @MaxLength(80) onlineConsultant?: string;
  @IsOptional() @IsString() @MaxLength(80) consultant?: string;
  @IsOptional() @IsObject() customData?: Record<string, unknown>;
}

export class PromotionArrivalFieldDto {
  @IsString() @IsNotEmpty() @MaxLength(80) label!: string;
  @IsIn(['TEXT', 'NUMBER', 'DATE']) dataType!: 'TEXT' | 'NUMBER' | 'DATE';
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort?: number;
}
