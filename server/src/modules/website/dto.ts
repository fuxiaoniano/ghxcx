import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
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

export class UpdateWebsiteArticleDto {
  @IsIn(Object.values(ContentStatus)) status!: ContentStatus;
}

export class WebsiteArticleQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page?: number;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() pageSize?: number;
  @IsString() @IsOptional() keyword?: string;
}
