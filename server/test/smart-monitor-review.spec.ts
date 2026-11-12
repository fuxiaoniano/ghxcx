import { reviewResultStatus } from '../src/modules/operations/smart-monitor.service';

describe('Tencent creative review result fallback', () => {
  it('maps complete platform review counts without treating partial approval as full approval', () => {
    expect(reviewResultStatus({ total_component_compose_count: 3, pass_component_compose_count: 3, reject_component_compose_count: 0 })).toBe('CREATIVE_SET_APPROVAL_STATUS_NORMAL');
    expect(reviewResultStatus({ total_component_compose_count: 3, pass_component_compose_count: 1, reject_component_compose_count: 2 })).toBe('CREATIVE_SET_APPROVAL_STATUS_PARTIAL_NORMAL');
    expect(reviewResultStatus({ total_component_compose_count: 3, pass_component_compose_count: 0, reject_component_compose_count: 3 })).toBe('CREATIVE_SET_APPROVAL_STATUS_DENIED');
  });

  it('keeps unknown results unknown', () => {
    expect(reviewResultStatus({ is_all_component_compose_pending: true })).toBe('CREATIVE_SET_APPROVAL_STATUS_PENDING');
    expect(reviewResultStatus({ total_component_compose_count: 0 })).toBeNull();
  });
});
