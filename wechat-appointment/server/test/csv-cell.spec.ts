import { csvCell } from '../src/common/utils/csv-cell';

describe('CSV cell safety', () => {
  it.each(['=HYPERLINK("https://example.com")', '+SUM(1,2)', '-CMD', '@SUM(1,2)', '\t=1+1', '\r\n=1+1'])(
    'prevents spreadsheet formula evaluation for %j',
    (value) => expect(csvCell(value)).toBe(`"'${value.replace(/"/g, '""')}"`),
  );

  it('preserves normal values, numeric amounts, and CSV escaping', () => {
    expect(csvCell('正常,"名称"')).toBe('"正常,""名称"""');
    expect(csvCell(-42)).toBe('"-42"');
    expect(csvCell(null)).toBe('""');
  });
});
