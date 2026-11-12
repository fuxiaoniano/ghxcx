export type ConsultationValidityRule = { validTagIds: string[]; invalidTagIds: string[] };

export const defaultConsultationValidityRule = (): ConsultationValidityRule => ({ validTagIds: [], invalidTagIds: [] });

export function isConsultationValid(_statusInvalid: boolean, tagIds: string[], rule: ConsultationValidityRule): boolean {
  const selected = new Set(tagIds);
  if (rule.invalidTagIds.some((id) => selected.has(id))) return false;
  if (rule.validTagIds.some((id) => selected.has(id))) return true;
  return false;
}
