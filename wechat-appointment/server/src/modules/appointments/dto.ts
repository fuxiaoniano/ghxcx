import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  ageRange!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  missingTeethType!: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
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

  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9_-]{1,64}$/)
  landingPageKey?: string;
}

export class CreatePublicAppointmentDto extends CreateAppointmentDto {
  @IsString()
  @Matches(/^1\d{10}$/, { message: '请输入正确的 11 位手机号' })
  phone!: string;
}
