import { isConsultationValid } from '../src/modules/consultation/consultation-validity-rule';

describe('网咨报表有效无效标签规则', () => {
  const rule = { validTagIds: ['valid'], invalidTagIds: ['invalid'] };

  it('无匹配标签时默认无效', () => {
    expect(isConsultationValid(false, [], rule)).toBe(false);
    expect(isConsultationValid(true, [], rule)).toBe(false);
  });

  it('有效标签覆盖无效状态', () => {
    expect(isConsultationValid(true, ['valid'], rule)).toBe(true);
  });

  it('无效标签优先于有效标签', () => {
    expect(isConsultationValid(false, ['valid', 'invalid'], rule)).toBe(false);
  });
});
