import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';
import { ContentStatus, DoctorScheduleStatus } from '@prisma/client';

export class CreateDoctorAppointmentDto {
  @IsString()
  @IsNotEmpty()
  doctorId!: string;

  @IsString()
  @IsNotEmpty()
  dentalCategoryId!: string;

  @IsString()
  @IsNotEmpty()
  dentalProjectId!: string;

  @IsDateString()
  appointmentDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  appointmentTime!: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(16)
  gender?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  symptomDescription!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  source?: string;

  @IsBoolean()
  privacyAccepted!: boolean;
}

export class CreatePackageApplicationDto {
  @IsString()
  @IsNotEmpty()
  packageId!: string;

  @IsDateString()
  appointmentDate!: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  source?: string;

  @IsBoolean()
  privacyAccepted!: boolean;
}

export class SortStatusDto {
  @IsInt()
  @IsOptional()
  sort?: number;

  @IsEnum(ContentStatus)
  @IsOptional()
  status?: ContentStatus;
}

export class BannerDto extends SortStatusDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  imageUrl!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  linkType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  linkValue?: string;
}

export class AdDto extends SortStatusDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  imageUrl!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  title?: string;
}

export class CategoryDto extends SortStatusDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  icon?: string;
}

export class DentalProjectDto extends SortStatusDto {
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

export class DoctorDto extends SortStatusDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  avatar!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  displayText?: string;

  @IsString()
  @IsNotEmpty()
  departmentId!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  departmentIds?: string[];

  @IsString()
  @IsOptional()
  clinicId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  specialty!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  description!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsBoolean()
  @IsOptional()
  recommend?: boolean;
}

export class DoctorScheduleDto {
  @IsString()
  @IsNotEmpty()
  doctorId!: string;

  @IsString()
  @IsOptional()
  clinicId?: string;

  @IsDateString()
  date!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @IsIn(['上午', '下午'])
  timeSlot!: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  capacity?: number;

  @IsInt()
  @IsOptional()
  sort?: number;

  @IsEnum(DoctorScheduleStatus)
  @IsOptional()
  status?: DoctorScheduleStatus;
}

export class PackageDto extends SortStatusDto {
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  cover!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  originalPrice!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salePrice!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  salesCount?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  description!: string;
}

export class PackageImageItemDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  imageUrl!: string;

  @IsInt()
  @IsOptional()
  sort?: number;
}

export class PackageImagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackageImageItemDto)
  images!: PackageImageItemDto[];
}

export class EnterpriseHomeConfigDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  hospitalName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  slogan?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  logo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  customerServicePath?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  officialAccountName?: string;
}
