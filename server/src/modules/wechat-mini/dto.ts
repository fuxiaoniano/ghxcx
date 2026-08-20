import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class MiniLoginDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsOptional()
  bindToken?: string;
}

export class MiniPhoneDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class MiniManualPhoneDto {
  @IsString()
  @Matches(/^1\d{10}$/, { message: '请输入 11 位大陆手机号' })
  phone!: string;
}

export class BindOfficialAccountDto {
  @IsString()
  @IsNotEmpty()
  bindToken!: string;
}
