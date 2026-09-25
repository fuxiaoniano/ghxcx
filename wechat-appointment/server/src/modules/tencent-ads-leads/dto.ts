import { TencentAdLeadStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTencentAdLeadDto {
  @IsIn(Object.values(TencentAdLeadStatus))
  status!: TencentAdLeadStatus;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  ineffectiveReason?: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  adminRemark?: string;
}
