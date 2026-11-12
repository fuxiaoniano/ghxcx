type PlatformRecord = Record<string, any>;

/** 腾讯可能把等价的组件值归并为新的 component_id；有完整 value 时按内容核验。 */
export function normalizeTencentCreativeComponentsForVerification(value: unknown): any {
  if (Array.isArray(value)) return value.map(normalizeTencentCreativeComponentsForVerification);
  if (!value || typeof value !== 'object') return value;
  const record = value as PlatformRecord;
  return Object.fromEntries(Object.entries(record)
    .filter(([key]) => {
      if (key === 'component_id' && record.value && typeof record.value === 'object') return false;
      // 腾讯回查保留 image_id，但会省略提交时附带的 image_url。
      if (key === 'image_url' && record.image_id) return false;
      return true;
    })
    .map(([key, entry]) => [key, normalizeTencentCreativeComponentsForVerification(entry)]));
}

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
