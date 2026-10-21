import { generateMultiCreativeCombinations } from '../src/modules/operations/multi-account-creative-combinations';

const rules = {
  titleCount: 1,
  videoCount: 1,
  imageCount: 0,
  maxPerAdgroup: 20,
  maxPerAccount: 100,
  maxTotal: 200,
  allowMaterialReuse: true,
  randomLimit: 5,
};

describe('multi-account creative combinations', () => {
  it('creates deterministic sequential combinations with exact material counts', () => {
    const first = generateMultiCreativeCombinations('SEQUENTIAL', { titles: ['t1', 't2'], videos: ['v1', 'v2'], images: [] }, rules);
    const second = generateMultiCreativeCombinations('SEQUENTIAL', { titles: ['t1', 't2'], videos: ['v1', 'v2'], images: [] }, rules);
    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
    expect(new Set(first.map((item) => JSON.stringify(item))).size).toBe(first.length);
    expect(first.every((item) => item.titleIds.length === 1 && item.videoIds.length === 1 && item.imageIds.length === 0)).toBe(true);
  });

  it('limits random combinations without expanding a large cartesian product', () => {
    const result = generateMultiCreativeCombinations('RANDOM_LIMITED', {
      titles: Array.from({ length: 100 }, (_, index) => `t${index}`),
      videos: Array.from({ length: 100 }, (_, index) => `v${index}`),
      images: [],
    }, rules);
    expect(result).toHaveLength(5);
    expect(new Set(result.map((item) => JSON.stringify(item))).size).toBe(5);
  });

  it('rejects an oversized cartesian request before materializing it', () => {
    expect(() => generateMultiCreativeCombinations('CARTESIAN', {
      titles: Array.from({ length: 100 }, (_, index) => `t${index}`),
      videos: Array.from({ length: 100 }, (_, index) => `v${index}`),
      images: [],
    }, rules)).toThrow('已在展开组合前阻断');
  });

  it('rejects insufficient required assets', () => {
    expect(() => generateMultiCreativeCombinations('SEQUENTIAL', { titles: [], videos: ['v1'], images: [] }, rules))
      .toThrow('标题已选 0 项');
  });

  it('creates image-only creatives without dividing by zero in sequential mode', () => {
    const imageRules = { ...rules, videoCount: 0, imageCount: 1 };
    const result = generateMultiCreativeCombinations('SEQUENTIAL', { titles: ['t1', 't2'], videos: [], images: ['i1', 'i2'] }, imageRules);
    expect(result).toEqual([
      { titleIds: ['t1'], videoIds: [], imageIds: ['i1'] },
      { titleIds: ['t2'], videoIds: [], imageIds: ['i2'] },
    ]);
  });

  it('blocks a creative with neither image nor video', () => {
    expect(() => generateMultiCreativeCombinations('SEQUENTIAL', { titles: ['t1'], videos: [], images: [] }, { ...rules, videoCount: 0, imageCount: 0 }))
      .toThrow('图片或视频');
  });
});
