export type WebsiteSiteKey = 'main' | 'afterbeat';

export function normalizeCategorySlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[\/\\]+|[\/\\]+$/g, '')
    .replace(/[\s_—–－]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function stableNameCode(value: string) {
  let hash = 2166136261;
  for (const character of value.trim()) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function generateCategorySlug(name: string, site: WebsiteSiteKey) {
  const readableSlug = normalizeCategorySlug(name);
  if (readableSlug) return readableSlug;
  if (!name.trim()) return '';
  return `${site === 'afterbeat' ? 'hot-news' : 'articles'}-${stableNameCode(name)}`;
}

export function isValidCategorySlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
