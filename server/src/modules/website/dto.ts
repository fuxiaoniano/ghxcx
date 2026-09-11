import { IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ContentStatus } from '@prisma/client';

export class CreateWebsitePageDto {
  @IsString() @IsNotEmpty() @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: '页面路径只能包含小写字母、数字和连字符' })
  slug!: string;

  @IsString() @IsNotEmpty() @MaxLength(160) title!: string;
  @IsString() @IsNotEmpty() @MaxLength(40) menuTitle!: string;
  @IsString() @IsOptional() @MaxLength(500) summary?: string;
  @IsString() @IsOptional() @MaxLength(500) coverUrl?: string;
  @IsString() @IsOptional() contentHtml?: string;
  @IsString() @IsOptional() @MaxLength(160) seoTitle?: string;
  @IsString() @IsOptional() @MaxLength(300) seoDescription?: string;
  @IsBoolean() @IsOptional() showInNav?: boolean;
  @Type(() => Number) @IsInt() @IsOptional() sort?: number;
  @IsIn(Object.values(ContentStatus)) @IsOptional() status?: ContentStatus;
}

export class UpdateWebsitePageDto extends CreateWebsitePageDto {}

export class UpdateWebsiteSettingsDto {
  @IsObject() settings!: Record<string, unknown>;
}

export class CreateWebsiteArticleDto {
  @IsString() @IsNotEmpty() @MaxLength(255) title!: string;
  @IsString() @IsOptional() @MaxLength(100) author?: string;
  @IsString() @IsOptional() @MaxLength(2000) digest?: string;
  @IsString() @IsOptional() @MaxLength(160) seoTitle?: string;
  @IsString() @IsOptional() @MaxLength(300) seoKeywords?: string;
  @IsString() @IsOptional() @MaxLength(300) seoDescription?: string;
  @IsString() @IsOptional() @MaxLength(1000) coverUrl?: string;
  @IsString() @IsNotEmpty() contentHtml!: string;
  @IsString() @IsOptional() @MaxLength(1000) originalUrl?: string;
  @IsDateString() @IsOptional() publishedAt?: string;
  @IsIn(Object.values(ContentStatus)) @IsOptional() status?: ContentStatus;
}

export class UpdateWebsiteArticleDto {
  @IsString() @IsNotEmpty() @MaxLength(255) @IsOptional() title?: string;
  @IsString() @MaxLength(100) @IsOptional() author?: string;
  @IsString() @MaxLength(2000) @IsOptional() digest?: string;
  @IsString() @MaxLength(160) @IsOptional() seoTitle?: string;
  @IsString() @MaxLength(300) @IsOptional() seoKeywords?: string;
  @IsString() @MaxLength(300) @IsOptional() seoDescription?: string;
  @IsString() @MaxLength(1000) @IsOptional() coverUrl?: string;
  @IsString() @IsNotEmpty() @IsOptional() contentHtml?: string;
  @IsString() @MaxLength(1000) @IsOptional() originalUrl?: string;
  @IsDateString() @IsOptional() publishedAt?: string;
  @IsIn(Object.values(ContentStatus)) @IsOptional() status?: ContentStatus;
}

export class WebsiteArticleQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page?: number;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() pageSize?: number;
  @IsString() @IsOptional() keyword?: string;
}
