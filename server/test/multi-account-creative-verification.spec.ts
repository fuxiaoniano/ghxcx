import { matchesTencentCreativeRecord, normalizeTencentCreativeComponentsForVerification } from '../src/modules/operations/multi-account-creative-verification';

const expected = {
  creativeId: '13561460171',
  creativeName: '多账户创意-001',
  adgroupId: '147901202331',
  templateId: '40',
  deliveryMode: 'DELIVERY_MODE_COMPONENT',
  creativeType: 'DYNAMIC_CREATIVE_TYPE_COMMON',
  components: { video: [{ video_id: '5001' }], title: [{ title: '测试文案' }] },
};

describe('multi-account Tencent creative verification', () => {
  it('does not confirm merely because Tencent returned a creative id', () => {
    expect(matchesTencentCreativeRecord(expected, {
      dynamic_creative_id: expected.creativeId,
      adgroup_id: 'another-adgroup',
    }, () => true)).toBe(false);
  });

  it('confirms only when account context fields and key components match', () => {
    expect(matchesTencentCreativeRecord(expected, {
      dynamic_creative_id: expected.creativeId,
      dynamic_creative_name: expected.creativeName,
      adgroup_id: expected.adgroupId,
      creative_template_id: expected.templateId,
      delivery_mode: expected.deliveryMode,
      dynamic_creative_type: expected.creativeType,
      creative_components: expected.components,
    }, (left, right) => JSON.stringify(left) === JSON.stringify(right))).toBe(true);
  });

  it('keeps a returned id unconfirmed when components differ', () => {
    expect(matchesTencentCreativeRecord(expected, {
      dynamic_creative_id: expected.creativeId,
      dynamic_creative_name: expected.creativeName,
      adgroup_id: expected.adgroupId,
      creative_template_id: expected.templateId,
      delivery_mode: expected.deliveryMode,
      dynamic_creative_type: expected.creativeType,
      creative_components: { video: [{ video_id: 'forged' }] },
    }, (left, right) => JSON.stringify(left) === JSON.stringify(right))).toBe(false);
  });

  it('compares Tencent-deduplicated component content even when the returned component ID changes', () => {
    const submitted = { description: [{ component_id: 1951801530389, value: { content: '相同文案' } }] };
    const returned = { description: [{ component_id: 1961120535130, value: { content: '相同文案' }, is_deleted: false }] };
    const normalizedSubmitted = normalizeTencentCreativeComponentsForVerification(submitted);
    const normalizedReturned = normalizeTencentCreativeComponentsForVerification(returned);
    expect(normalizedSubmitted.description[0]).toEqual({ value: { content: '相同文案' } });
    expect(normalizedReturned.description[0].value).toEqual(normalizedSubmitted.description[0].value);
    expect(normalizeTencentCreativeComponentsForVerification({ description: [{ component_id: 1 }] })).toEqual({ description: [{ component_id: 1 }] });
  });

  it('uses image_id as the identity when Tencent omits image_url in its lookup result', () => {
    const sent = normalizeTencentCreativeComponentsForVerification({ image_list: [{ value: { list: [{ image_id: '50750754803', image_url: 'https://example.test/image' }] } }] });
    const returned = normalizeTencentCreativeComponentsForVerification({ image_list: [{ value: { list: [{ image_id: '50750754803' }] } }] });
    expect(sent).toEqual(returned);
    expect(normalizeTencentCreativeComponentsForVerification({ image_list: [{ value: { list: [{ image_id: 'another-image' }] } }] })).not.toEqual(returned);
  });
});
