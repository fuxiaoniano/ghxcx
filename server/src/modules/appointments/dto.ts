import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const AGE_RANGES = ['40岁以下', '40-50岁', '50-60岁', '60岁以上'];
export const MISSING_TEETH_TYPES = ['单颗缺失', '多颗缺失', '半口缺失', '全口缺失', '不确定'];

export class CreateAppointmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name!: string;

  @IsIn(AGE_RANGES)
  ageRange!: string;

  @IsIn(MISSING_TEETH_TYPES)
  missingTeethType!: string;

  @IsString()
  @IsOptional()
  clinicId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  remark?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  source?: string;

  @IsBoolean()
  privacyAccepted!: boolean;
}
