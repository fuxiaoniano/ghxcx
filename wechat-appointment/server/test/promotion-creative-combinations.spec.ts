import { estimateCartesianCount, generateCreativeCombinations } from '../src/modules/operations/promotion-creative-combinations';

const materials = {
  titles: ['t1', 't2', 't3'],
  videos: ['v1', 'v2'],
  landingPages: ['p1', 'p2'],
  conversionComponents: ['c1'],
  images: [],
  otherComponents: ['brand1'],
};

const rules = {
  titleCount: 2,
  videoCount: 1,
  landingPageCount: 1,
  conversionCount: 1,
  imageCount: 0,
};

describe('promotion creative combinations', () => {
  it('builds balanced combinations without identical duplicates and keeps exact per-item counts', () => {
    const result = generateCreativeCombinations('BALANCED', materials, rules);

    expect(result).toHaveLength(2);
    expect(new Set(result.map((item) => JSON.stringify(item))).size).toBe(result.length);
    for (const item of result) {
      expect(item.titleIds).toHaveLength(2);
      expect(item.videoIds).toHaveLength(1);
      expect(item.landingPageIds).toHaveLength(1);
      expect(item.conversionIds).toHaveLength(1);
      expect(item.otherComponentIds).toEqual(['brand1']);
    }
  });

  it('calculates and builds the exact cartesian product', () => {
    expect(estimateCartesianCount(materials, rules)).toBe(12);
    expect(generateCreativeCombinations('CARTESIAN', materials, rules, [], 12)).toHaveLength(12);
  });

  it('rejects a cartesian product beyond the server-side limit', () => {
    expect(() => generateCreativeCombinations('CARTESIAN', materials, rules, [], 11))
      .toThrow('超过服务端上限 11 条');
  });

  it('rejects manual groups whose actual material count differs from the rule', () => {
    expect(() => generateCreativeCombinations('MANUAL', materials, rules, [{
      titleIds: ['t1'], videoIds: ['v1'], landingPageIds: ['p1'], conversionIds: ['c1'], imageIds: [], otherComponentIds: ['brand1'],
    }])).toThrow('标题数量为 1，必须为 2');
  });

  it('rejects forged material identifiers in manual groups', () => {
    expect(() => generateCreativeCombinations('MANUAL', materials, rules, [{
      titleIds: ['t1', 'forged'], videoIds: ['v1'], landingPageIds: ['p1'], conversionIds: ['c1'], imageIds: [], otherComponentIds: ['brand1'],
    }])).toThrow('包含未选择的素材');
  });
});
