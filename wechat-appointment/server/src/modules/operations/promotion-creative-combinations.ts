export type CreativeMaterialSelection = {
  titles: string[];
  videos: string[];
  landingPages: string[];
  conversionComponents: string[];
  images: string[];
  otherComponents: string[];
};

export type CreativeMaterialRules = {
  titleCount: number;
  videoCount: number;
  landingPageCount: number;
  conversionCount: number;
  imageCount: number;
};

export type CreativeCombination = {
  titleIds: string[];
  videoIds: string[];
  landingPageIds: string[];
  conversionIds: string[];
  imageIds: string[];
  otherComponentIds: string[];
};

type ManualGroup = Omit<CreativeCombination, 'otherComponentIds'> & { otherComponentIds?: string[] };

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

function choose(values: string[], count: number): string[][] {
  if (count === 0) return [[]];
  if (values.length < count) return [];
  const result: string[][] = [];
  const walk = (start: number, current: string[]) => {
    if (current.length === count) { result.push([...current]); return; }
    for (let index = start; index <= values.length - (count - current.length); index += 1) {
      current.push(values[index]); walk(index + 1, current); current.pop();
    }
  };
  walk(0, []);
  return result;
}

function rotate(values: string[], count: number, offset: number) {
  if (!count) return [];
  return Array.from({ length: count }, (_, index) => values[(offset * count + index) % values.length]);
}

function key(item: CreativeCombination) {
  return JSON.stringify([
    [...item.titleIds].sort(), [...item.videoIds].sort(), [...item.landingPageIds].sort(),
    [...item.conversionIds].sort(), [...item.imageIds].sort(), [...item.otherComponentIds].sort(),
  ]);
}

export function estimateCartesianCount(materials: CreativeMaterialSelection, rules: CreativeMaterialRules) {
  const combinationCount = (length: number, count: number) => {
    if (count === 0) return 1;
    if (length < count) return 0;
    let result = 1;
    for (let index = 1; index <= count; index += 1) result = result * (length - index + 1) / index;
    return Math.round(result);
  };
  return combinationCount(unique(materials.titles).length, rules.titleCount)
    * combinationCount(unique(materials.videos).length, rules.videoCount)
    * combinationCount(unique(materials.landingPages).length, rules.landingPageCount)
    * combinationCount(unique(materials.conversionComponents).length, rules.conversionCount)
    * combinationCount(unique(materials.images).length, rules.imageCount);
}

export function generateCreativeCombinations(
  mode: 'BALANCED' | 'CARTESIAN' | 'MANUAL',
  input: CreativeMaterialSelection,
  rules: CreativeMaterialRules,
  manualGroups: ManualGroup[] = [],
  limit = 50,
): CreativeCombination[] {
  const materials: CreativeMaterialSelection = {
    titles: unique(input.titles), videos: unique(input.videos), landingPages: unique(input.landingPages),
    conversionComponents: unique(input.conversionComponents), images: unique(input.images), otherComponents: unique(input.otherComponents),
  };
  const validateCount = (values: string[], count: number, label: string) => {
    if (count > values.length) throw new Error(`${label}已选 ${values.length} 项，少于每条创意需要的 ${count} 项`);
  };
  validateCount(materials.titles, rules.titleCount, '标题');
  validateCount(materials.videos, rules.videoCount, '视频');
  validateCount(materials.landingPages, rules.landingPageCount, '落地页');
  validateCount(materials.conversionComponents, rules.conversionCount, '转化组件');
  validateCount(materials.images, rules.imageCount, '图片');

  let generated: CreativeCombination[] = [];
  if (mode === 'MANUAL') {
    generated = manualGroups.map((item) => ({
      titleIds: unique(item.titleIds), videoIds: unique(item.videoIds), landingPageIds: unique(item.landingPageIds),
      conversionIds: unique(item.conversionIds), imageIds: unique(item.imageIds), otherComponentIds: unique(item.otherComponentIds || []),
    }));
    const selected = new Set([
      ...materials.titles, ...materials.videos, ...materials.landingPages,
      ...materials.conversionComponents, ...materials.images, ...materials.otherComponents,
    ]);
    generated.forEach((item, index) => {
      const counts: Array<[string, number, number]> = [
        ['标题', item.titleIds.length, rules.titleCount], ['视频', item.videoIds.length, rules.videoCount],
        ['落地页', item.landingPageIds.length, rules.landingPageCount], ['转化组件', item.conversionIds.length, rules.conversionCount],
        ['图片', item.imageIds.length, rules.imageCount],
      ];
      const mismatch = counts.find(([, actual, expected]) => actual !== expected);
      if (mismatch) throw new Error(`手工分组第 ${index + 1} 条的${mismatch[0]}数量为 ${mismatch[1]}，必须为 ${mismatch[2]}`);
      const foreign = [...item.titleIds, ...item.videoIds, ...item.landingPageIds, ...item.conversionIds, ...item.imageIds, ...item.otherComponentIds].find((id) => !selected.has(id));
      if (foreign) throw new Error(`手工分组第 ${index + 1} 条包含未选择的素材`);
    });
  } else if (mode === 'CARTESIAN') {
    const estimate = estimateCartesianCount(materials, rules);
    if (estimate > limit) throw new Error(`笛卡尔组合预计生成 ${estimate} 条，超过服务端上限 ${limit} 条`);
    const groups = [
      choose(materials.titles, rules.titleCount), choose(materials.videos, rules.videoCount),
      choose(materials.landingPages, rules.landingPageCount), choose(materials.conversionComponents, rules.conversionCount),
      choose(materials.images, rules.imageCount),
    ];
    for (const titles of groups[0]) for (const videos of groups[1]) for (const pages of groups[2])
      for (const conversions of groups[3]) for (const images of groups[4]) generated.push({
        titleIds: titles, videoIds: videos, landingPageIds: pages, conversionIds: conversions,
        imageIds: images, otherComponentIds: materials.otherComponents,
      });
  } else {
    const sizes = [
      rules.titleCount ? Math.ceil(materials.titles.length / rules.titleCount) : 0,
      rules.videoCount ? Math.ceil(materials.videos.length / rules.videoCount) : 0,
      rules.landingPageCount ? Math.ceil(materials.landingPages.length / rules.landingPageCount) : 0,
      rules.conversionCount ? Math.ceil(materials.conversionComponents.length / rules.conversionCount) : 0,
      rules.imageCount ? Math.ceil(materials.images.length / rules.imageCount) : 0,
    ];
    const total = Math.max(1, ...sizes);
    generated = Array.from({ length: Math.min(total, limit) }, (_, index) => ({
      titleIds: rotate(materials.titles, rules.titleCount, index), videoIds: rotate(materials.videos, rules.videoCount, index),
      landingPageIds: rotate(materials.landingPages, rules.landingPageCount, index),
      conversionIds: rotate(materials.conversionComponents, rules.conversionCount, index), imageIds: rotate(materials.images, rules.imageCount, index),
      otherComponentIds: materials.otherComponents,
    }));
  }
  if (!generated.length) throw new Error('没有生成任何创意组合');
  if (generated.length > limit) throw new Error(`预计生成 ${generated.length} 条，超过服务端上限 ${limit} 条`);
  const seen = new Set<string>();
  const result = generated.filter((item) => { const fingerprint = key(item); if (seen.has(fingerprint)) return false; seen.add(fingerprint); return true; });
  if (!result.length) throw new Error('没有可提交的唯一创意组合');
  return result;
}
