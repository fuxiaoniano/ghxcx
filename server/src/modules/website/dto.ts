import { IsDateString, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ContentStatus } from '@prisma/client';

export class UpdateWebsiteSettingsDto {
  @IsObject() settings!: Record<string, unknown>;
}

export class CreateWebsiteArticleCategoryDto {
  @IsString() @IsNotEmpty() @MaxLength(40) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(60)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: '分类路径只能包含小写字母、数字和连字符' })
  slug!: string;
  @IsString() @IsOptional() @MaxLength(300) description?: string;
  @Type(() => Number) @IsInt() @IsOptional() sort?: number;
  @IsIn(Object.values(ContentStatus)) @IsOptional() status?: ContentStatus;
}

export class UpdateWebsiteArticleCategoryDto {
  @IsString() @IsNotEmpty() @MaxLength(40) @IsOptional() name?: string;
  @IsString() @IsNotEmpty() @MaxLength(60) @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: '分类路径只能包含小写字母、数字和连字符' })
  slug?: string;
  @IsString() @MaxLength(300) @IsOptional() description?: string;
  @Type(() => Number) @IsInt() @IsOptional() sort?: number;
  @IsIn(Object.values(ContentStatus)) @IsOptional() status?: ContentStatus;
}

export class CreateWebsiteArticleDto {
  @IsString() @IsNotEmpty() @MaxLength(255) title!: string;
  @IsString() @IsNotEmpty() @MaxLength(32) categoryId!: string;
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
  @IsString() @IsNotEmpty() @MaxLength(32) @IsOptional() categoryId?: string;
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
  @IsString() @IsOptional() categoryId?: string;
  @IsIn(Object.values(ContentStatus)) @IsOptional() status?: ContentStatus;
}
