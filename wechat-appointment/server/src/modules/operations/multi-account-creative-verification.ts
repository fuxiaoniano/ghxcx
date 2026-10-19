type PlatformRecord = Record<string, any>;

export function matchesTencentCreativeRecord(
  expected: {
    creativeId: string;
    creativeName: string;
    adgroupId: string;
    templateId: string;
    deliveryMode: string;
    creativeType: string;
    components: PlatformRecord;
  },
  actual: PlatformRecord | undefined,
  componentsMatch: (expectedComponents: PlatformRecord, actualComponents: PlatformRecord) => boolean,
) {
  if (!actual) return false;
  return String(actual.dynamic_creative_id || '') === expected.creativeId
    && String(actual.adgroup_id || '') === expected.adgroupId
    && String(actual.creative_template_id || '') === expected.templateId
    && String(actual.dynamic_creative_name || '') === expected.creativeName
    && String(actual.delivery_mode || '') === expected.deliveryMode
    && String(actual.dynamic_creative_type || '') === expected.creativeType
    && componentsMatch(expected.components || {}, actual.creative_components || {});
}
