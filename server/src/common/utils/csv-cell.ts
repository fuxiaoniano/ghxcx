/** Escape a CSV cell and prevent spreadsheet applications from evaluating user data as a formula. */
export function csvCell(value: unknown): string {
  const text = String(value ?? '');
  const escaped = typeof value === 'number' || !/^[\u0000-\u0020\uFEFF]*[=+\-@]/u.test(text)
    ? text
    : `'${text}`;
  return `"${escaped.replace(/"/g, '""')}"`;
}
