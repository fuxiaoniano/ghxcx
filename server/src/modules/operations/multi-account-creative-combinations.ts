export type MultiCreativeAssetGroups = { titles: string[]; videos: string[]; images: string[] };
export type MultiCreativeCombination = { titleIds: string[]; videoIds: string[]; imageIds: string[] };
export type MultiCreativeRules = {
  titleCount: number; videoCount: number; imageCount: number; maxPerAdgroup: number;
  maxPerAccount: number; maxTotal: number; allowMaterialReuse?: boolean; randomLimit?: number;
};

export class MultiCreativeCombinationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MultiCreativeCombinationValidationError';
  }
}

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

function choose(values: string[], size: number): string[][] {
  if (size === 0) return [[]];
  if (values.length < size) return [];
  const result: string[][] = [];
  const walk = (start: number, current: string[]) => {
    if (current.length === size) { result.push([...current]); return; }
    for (let index = start; index <= values.length - (size - current.length); index += 1) {
      current.push(values[index]); walk(index + 1, current); current.pop();
    }
  };
  walk(0, []);
  return result;
}

function combinationCount(total: number, size: number, cap: number) {
  if (size < 0 || size > total) return 0;
  const selected = Math.min(size, total - size);
  let result = 1;
  for (let index = 1; index <= selected; index += 1) {
    result = (result * (total - selected + index)) / index;
    if (result > cap) return cap + 1;
  }
  return Math.round(result);
}

const rotate = (values: string[], size: number, offset: number) => size === 0
  ? []
  : Array.from({ length: size }, (_, index) => values[(offset * size + index) % values.length]);

function stableScore(value: string) {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}

export function generateMultiCreativeCombinations(
  mode: 'CARTESIAN' | 'RANDOM_LIMITED' | 'SEQUENTIAL',
  input: MultiCreativeAssetGroups,
  rules: MultiCreativeRules,
): MultiCreativeCombination[] {
  const groups = { titles: unique(input.titles), videos: unique(input.videos), images: unique(input.images) };
  if (rules.videoCount === 0 && rules.imageCount === 0) throw new MultiCreativeCombinationValidationError('每条创意必须至少包含图片或视频');
  for (const [label, values, count] of [
    ['标题', groups.titles, rules.titleCount], ['视频', groups.videos, rules.videoCount], ['图片', groups.images, rules.imageCount],
  ] as Array<[string, string[], number]>) {
    if (values.length < count) throw new MultiCreativeCombinationValidationError(`${label}已选 ${values.length} 项，少于每条创意要求的 ${count} 项`);
  }
  const limit = rules.maxPerAdgroup;
  let result: MultiCreativeCombination[] = [];
  if (mode === 'CARTESIAN') {
    const estimated = combinationCount(groups.titles.length, rules.titleCount, limit)
      * combinationCount(groups.videos.length, rules.videoCount, limit)
      * combinationCount(groups.images.length, rules.imageCount, limit);
    if (estimated > limit) throw new MultiCreativeCombinationValidationError(`单个营销单元预计生成超过 ${limit} 条，已在展开组合前阻断`);
    for (const titleIds of choose(groups.titles, rules.titleCount))
      for (const videoIds of choose(groups.videos, rules.videoCount))
        for (const imageIds of choose(groups.images, rules.imageCount)) result.push({ titleIds, videoIds, imageIds });
  } else if (mode === 'RANDOM_LIMITED') {
    const wanted = Math.min(rules.randomLimit || limit, limit);
    const candidateCount = Math.min(10_000, Math.max(wanted * 8, groups.titles.length, groups.videos.length, groups.images.length));
    for (let index = 0; index < candidateCount; index += 1) result.push({
      titleIds: rotate(groups.titles, rules.titleCount, index * 17 + 3),
      videoIds: rotate(groups.videos, rules.videoCount, index * 31 + 7),
      imageIds: rotate(groups.images, rules.imageCount, index * 43 + 11),
    });
    result.sort((left, right) => stableScore(JSON.stringify(left)) - stableScore(JSON.stringify(right)));
    result = result.slice(0, wanted);
  } else {
    const sizes = [
      Math.ceil(groups.titles.length / rules.titleCount), rules.videoCount ? Math.ceil(groups.videos.length / rules.videoCount) : 1,
      rules.imageCount ? Math.ceil(groups.images.length / rules.imageCount) : 1,
    ];
    const total = rules.allowMaterialReuse ? Math.max(...sizes) : Math.min(...sizes);
    result = Array.from({ length: Math.min(total, limit) }, (_, index) => ({
      titleIds: rotate(groups.titles, rules.titleCount, index), videoIds: rotate(groups.videos, rules.videoCount, index),
      imageIds: rotate(groups.images, rules.imageCount, index),
    }));
  }
  const seen = new Set<string>();
  result = result.filter((item) => { const key = JSON.stringify(item); if (seen.has(key)) return false; seen.add(key); return true; });
  if (!result.length) throw new MultiCreativeCombinationValidationError('没有生成任何有效创意组合');
  if (result.length > limit) throw new MultiCreativeCombinationValidationError(`单个营销单元预计生成 ${result.length} 条，超过上限 ${limit} 条`);
  return result;
}
