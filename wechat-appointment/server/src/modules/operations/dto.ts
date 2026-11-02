import { ContentStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class PromotionAccountDto {
  @IsString() @MaxLength(120) name!: string;
  @IsIn(['重庆', '绵阳']) project!: string;
  @IsString() @MaxLength(80) platform!: string;
  @IsOptional() @IsString() @MaxLength(120) accountNo?: string;
  @IsOptional() @IsIn(Object.values(ContentStatus)) status?: ContentStatus;
  @IsOptional() @IsString() @MaxLength(500) remark?: string;
}

export class PromotionAccountCredentialDto {
  @IsOptional() @IsString() @MaxLength(4000) accessToken?: string;
  @IsOptional() @IsString() @MaxLength(255) clientId?: string;
  @IsOptional() @IsString() @MaxLength(4000) clientSecret?: string;
  @IsOptional() @IsString() @MaxLength(4000) refreshToken?: string;
  @IsOptional() @IsString() @MaxLength(4000) userToken?: string;
  @IsOptional() @IsDateString() userTokenExpiresAt?: string;
  @IsOptional() @IsBoolean() clearAccessToken?: boolean;
  @IsOptional() @IsBoolean() clearClientSecret?: boolean;
  @IsOptional() @IsBoolean() clearRefreshToken?: boolean;
  @IsOptional() @IsBoolean() clearUserToken?: boolean;
}

export class TencentUserTokenDto {
  @IsOptional() @IsString() @MaxLength(4000) userToken?: string;
  @IsOptional() @IsDateString() userTokenExpiresAt?: string;
  @IsOptional() @IsBoolean() clearUserToken?: boolean;
}

export class PromotionAccountGrantItemDto {
  @IsString() @MaxLength(32) adminUserId!: string;
  @IsBoolean() canViewData!: boolean;
  @IsBoolean() canViewMaterials!: boolean;
  @IsBoolean() canViewCreatives!: boolean;
  @IsBoolean() canCreateCreatives!: boolean;
}

export class PromotionAccountGrantsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => PromotionAccountGrantItemDto) grants!: PromotionAccountGrantItemDto[];
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
  @IsOptional() @IsString() @MaxLength(120) accountName?: string;
  @IsOptional() @IsString() @MaxLength(40) project?: string;
  @IsOptional() @IsString() @MaxLength(80) platform?: string;
}

export class PromotionSalaryQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month!: string;
}

export class PromotionSalaryRegionRuleDto {
  @Type(() => Number) @IsNumber() @Min(0) minDailyLeads!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(1) minValidRate!: number;
  @Type(() => Number) @IsNumber() @Min(0) maxAverageCost!: number;
}

export class PromotionSalaryTierDto {
  @Type(() => Number) @IsInt() @Min(0) salary!: number;
  @ValidateNested() @Type(() => PromotionSalaryRegionRuleDto) chongqing!: PromotionSalaryRegionRuleDto;
  @ValidateNested() @Type(() => PromotionSalaryRegionRuleDto) mianyang!: PromotionSalaryRegionRuleDto;
}

export class PromotionSalaryConfigDto {
  @Type(() => Number) @IsInt() @Min(0) baseSalary!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(31) recentDays!: number;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PromotionSalaryTierDto) tiers!: PromotionSalaryTierDto[];
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

export class PromotionDataSyncConfigDto {
  @IsIn(['TENCENT_ADS', 'OCEANENGINE']) provider!: 'TENCENT_ADS' | 'OCEANENGINE';
  enabled!: boolean;
  @IsString() @MaxLength(500) reportUrl!: string;
  @IsOptional() @IsString() @MaxLength(4000) accessToken?: string;
  @IsOptional() @IsString() @MaxLength(64) clientId?: string;
  @IsOptional() @IsString() @MaxLength(4000) clientSecret?: string;
  @IsOptional() @IsString() @MaxLength(4000) refreshToken?: string;
  @IsOptional() @IsString() @MaxLength(4000) userToken?: string;
  @IsOptional() @IsDateString() userTokenExpiresAt?: string;
}

export class TencentBusinessUnitCredentialDto {
  @IsString() @MaxLength(255) clientId!: string;
  @IsString() @MaxLength(4000) clientSecret!: string;
  @IsString() @MaxLength(4000) accessToken!: string;
  @IsString() @MaxLength(4000) refreshToken!: string;
}

export class SyncPromotionDailyMetricsDto {
  @IsDateString() statDate!: string;
  @IsOptional() @IsIn(['TENCENT_ADS', 'OCEANENGINE']) provider?: 'TENCENT_ADS' | 'OCEANENGINE';
  @IsOptional() @IsString({ each: true }) @MaxLength(32, { each: true }) accountIds?: string[];
}

export class PromotionHealthAnalyzeDto {
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) @MaxLength(32, { each: true }) accountIds!: string[];
  @IsDateString() dateFrom!: string;
  @IsDateString() dateTo!: string;
  @IsOptional() @IsBoolean() syncEndDate?: boolean;
}

export class PromotionMaterialAnalyzeDto {
  @IsOptional() @IsString() @MaxLength(32) accountId?: string;
  @IsOptional() @IsIn(['TENCENT_ADS', 'OCEANENGINE']) provider?: 'TENCENT_ADS' | 'OCEANENGINE';
  @IsDateString() dateFrom!: string;
  @IsDateString() dateTo!: string;
}

export class ArchivePromotionDailyMetricDto {
  @IsBoolean()
  isArchived!: boolean;
}

export class PromotionCreativePagedQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
}

export class PromotionCreativeAdgroupQueryDto extends PromotionCreativePagedQueryDto {
  @IsString() @MaxLength(32) accountId!: string;
}

export class PromotionCreativeTemplateQueryDto extends PromotionCreativePagedQueryDto {
  @IsString() @MaxLength(32) accountId!: string;
  @IsString() @MaxLength(80) adgroupId!: string;
  @IsIn(['DELIVERY_MODE_COMPONENT', 'DELIVERY_MODE_CUSTOMIZE']) deliveryMode!: 'DELIVERY_MODE_COMPONENT' | 'DELIVERY_MODE_CUSTOMIZE';
  @IsIn(['DYNAMIC_CREATIVE_TYPE_COMMON', 'DYNAMIC_CREATIVE_TYPE_PROGRAM']) dynamicCreativeType!: 'DYNAMIC_CREATIVE_TYPE_COMMON' | 'DYNAMIC_CREATIVE_TYPE_PROGRAM';
}

export class PromotionCreativeAssetQueryDto extends PromotionCreativePagedQueryDto {
  @IsString() @MaxLength(32) accountId!: string;
  @IsIn(['ACCOUNT', 'BUSINESS_UNIT']) source!: 'ACCOUNT' | 'BUSINESS_UNIT';
  @IsOptional() @IsString() @MaxLength(120) businessUnitKey?: string;
  @IsOptional() @IsIn(['MEDIA', 'IMAGE', 'VIDEO', 'NINE_IMAGE', 'COPY', 'LANDING_PAGE', 'BRAND', 'WECHAT_CHANNELS', 'CONVERSION', 'ACTION_BUTTON', 'MINI_CARD_LINK', 'TEXT_LINK', 'FLOATING_ZONE', 'LABEL', 'SOCIAL_SKILL', 'OTHER']) assetType?: string;
  @IsOptional() @IsString() @Matches(/^\d{1,5}[x×]\d{1,5}$/) dimensions?: string;
  @IsOptional() @IsString() @Matches(/^\d+$/) @MaxLength(80) adgroupId?: string;
  @IsOptional() @IsString() @Matches(/^\d+$/) @MaxLength(80) templateId?: string;
  @IsOptional() @IsIn(['DELIVERY_MODE_COMPONENT', 'DELIVERY_MODE_CUSTOMIZE']) deliveryMode?: 'DELIVERY_MODE_COMPONENT' | 'DELIVERY_MODE_CUSTOMIZE';
  @IsOptional() @IsIn(['DYNAMIC_CREATIVE_TYPE_COMMON', 'DYNAMIC_CREATIVE_TYPE_PROGRAM']) dynamicCreativeType?: 'DYNAMIC_CREATIVE_TYPE_COMMON' | 'DYNAMIC_CREATIVE_TYPE_PROGRAM';
  @IsOptional() @IsIn(['CREATED_TIME', 'NAME', 'SPEND_7_DAYS', 'SPEND_15_DAYS', 'ACTUAL_CPA', 'TARGET_CONVERSION_COST', 'STATUS']) sortBy?: 'CREATED_TIME' | 'NAME' | 'SPEND_7_DAYS' | 'SPEND_15_DAYS' | 'ACTUAL_CPA' | 'TARGET_CONVERSION_COST' | 'STATUS';
  @IsOptional() @IsIn(['ASC', 'DESC']) sortOrder?: 'ASC' | 'DESC';
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() refresh?: boolean;
}

export class PromotionCreativeMaterialSelectionDto {
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(32, { each: true }) titles!: string[];
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(32, { each: true }) videos!: string[];
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(32, { each: true }) landingPages!: string[];
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(32, { each: true }) conversionComponents!: string[];
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(32, { each: true }) images!: string[];
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(32, { each: true }) otherComponents!: string[];
}

export class PromotionCreativeMaterialRulesDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(20) titleCount!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(20) videoCount!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(20) landingPageCount!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(20) conversionCount!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(20) imageCount!: number;
}

export class PromotionCreativeManualGroupDto {
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) titleIds!: string[];
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) videoIds!: string[];
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) landingPageIds!: string[];
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) conversionIds!: string[];
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) imageIds!: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) otherComponentIds?: string[];
}

export class PromotionCreativeOptionsDto {
  @IsOptional() @IsIn(['AD_STATUS_NORMAL', 'AD_STATUS_SUSPEND']) configuredStatus?: 'AD_STATUS_NORMAL' | 'AD_STATUS_SUSPEND';
  @IsOptional() @IsString() @MaxLength(1000) @Matches(/^https?:\/\//i) impressionTrackingUrl?: string;
  @IsOptional() @IsString() @MaxLength(1000) @Matches(/^https?:\/\//i) clickTrackingUrl?: string;
  @IsOptional() @IsString() @MaxLength(1000) @Matches(/^https?:\/\//i) pageTrackUrl?: string;
}

export class PromotionCreativeBatchRequestDto {
  @IsString() @MaxLength(32) accountId!: string;
  @IsString() @MaxLength(120) businessUnitKey!: string;
  @IsString() @Matches(/^\d+$/) @MaxLength(80) adgroupId!: string;
  @IsString() @Matches(/^\d+$/) @MaxLength(80) templateId!: string;
  @IsIn(['DELIVERY_MODE_COMPONENT', 'DELIVERY_MODE_CUSTOMIZE']) deliveryMode!: 'DELIVERY_MODE_COMPONENT' | 'DELIVERY_MODE_CUSTOMIZE';
  @IsIn(['DYNAMIC_CREATIVE_TYPE_COMMON', 'DYNAMIC_CREATIVE_TYPE_PROGRAM']) dynamicCreativeType!: 'DYNAMIC_CREATIVE_TYPE_COMMON' | 'DYNAMIC_CREATIVE_TYPE_PROGRAM';
  @IsIn(['BALANCED', 'CARTESIAN', 'MANUAL']) combinationMode!: 'BALANCED' | 'CARTESIAN' | 'MANUAL';
  @IsString() @MaxLength(120) namePattern!: string;
  @ValidateNested() @Type(() => PromotionCreativeMaterialSelectionDto) materials!: PromotionCreativeMaterialSelectionDto;
  @ValidateNested() @Type(() => PromotionCreativeMaterialRulesDto) rules!: PromotionCreativeMaterialRulesDto;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => PromotionCreativeManualGroupDto) manualGroups?: PromotionCreativeManualGroupDto[];
  @IsOptional() @ValidateNested() @Type(() => PromotionCreativeOptionsDto) options?: PromotionCreativeOptionsDto;
}

export class PromotionCreativeTaskQueryDto extends PromotionCreativePagedQueryDto {
  @IsOptional() @IsString() @MaxLength(32) accountId?: string;
  @IsOptional() @IsIn(['PENDING', 'PROCESSING', 'PARTIAL_SUCCESS', 'SUCCEEDED', 'FAILED', 'UNKNOWN', 'CANCELLED']) status?: string;
}

export class MultiAccountCreativeComponentOverrideDto {
  @IsString() @Matches(/\S/) @MaxLength(80) componentType!: string;
  @IsString() @MaxLength(32) configId!: string;
}

export class MultiAccountCreativeTargetDto {
  @IsString() @MaxLength(32) accountId!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @IsString({ each: true }) @Matches(/^\d+$/, { each: true }) adgroupIds!: string[];
  @IsOptional() @IsString() @Matches(/^\d+$/) @MaxLength(80) templateId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => MultiAccountCreativeComponentOverrideDto) componentOverrides?: MultiAccountCreativeComponentOverrideDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(80, { each: true }) disabledDefaultComponentTypes?: string[];
  @IsOptional() @IsString() @MaxLength(500) overrideReason?: string;
}

export class MultiAccountCreativeRulesDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(20) titleCount!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(20) videoCount!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(20) imageCount!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) maxPerAdgroup!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(200) maxPerAccount!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(500) maxTotal!: number;
  @IsOptional() @IsBoolean() allowMaterialReuse?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) randomLimit?: number;
}

export class MultiAccountCreativeBatchRequestDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsString({ each: true }) @MaxLength(32, { each: true }) assetSnapshotIds!: string[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => MultiAccountCreativeTargetDto) targets!: MultiAccountCreativeTargetDto[];
  @IsIn(['DELIVERY_MODE_COMPONENT', 'DELIVERY_MODE_CUSTOMIZE']) deliveryMode!: 'DELIVERY_MODE_COMPONENT' | 'DELIVERY_MODE_CUSTOMIZE';
  @IsIn(['DYNAMIC_CREATIVE_TYPE_COMMON', 'DYNAMIC_CREATIVE_TYPE_PROGRAM']) creativeType!: 'DYNAMIC_CREATIVE_TYPE_COMMON' | 'DYNAMIC_CREATIVE_TYPE_PROGRAM';
  @IsIn(['CARTESIAN', 'RANDOM_LIMITED', 'SEQUENTIAL']) combinationMode!: 'CARTESIAN' | 'RANDOM_LIMITED' | 'SEQUENTIAL';
  @IsString() @MaxLength(120) namePattern!: string;
  @ValidateNested() @Type(() => MultiAccountCreativeRulesDto) rules!: MultiAccountCreativeRulesDto;
  @IsOptional() @IsBoolean() allowSkipInvalid?: boolean;
  @IsOptional() @IsIn(['AD_STATUS_NORMAL', 'AD_STATUS_SUSPEND']) configuredStatus?: 'AD_STATUS_NORMAL' | 'AD_STATUS_SUSPEND';
}

export class MultiAccountCreativeTaskQueryDto extends PromotionCreativePagedQueryDto {
  @IsOptional() @IsString() @MaxLength(32) accountId?: string;
  @IsOptional() @IsString() @MaxLength(80) adgroupId?: string;
  @IsOptional() @IsString() @MaxLength(32) createdByAdminId?: string;
  @IsOptional() @IsString() @MaxLength(40) status?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
}

export class CreativeDefaultComponentDto {
  @IsString() @MaxLength(32) accountId!: string;
  @IsString() @Matches(/\S/) @MaxLength(80) componentType!: string;
  @IsString() @Matches(/^\d+$/) @MaxLength(160) platformComponentId!: string;
  @IsString() @MaxLength(255) componentName!: string;
  @IsOptional() @IsString() @MaxLength(80) creativeType?: string;
  @IsOptional() @IsString() @MaxLength(100) marketingGoal?: string;
  @IsOptional() @IsString() @Matches(/^\d+$/) @MaxLength(80) templateId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000) priority?: number;
}
