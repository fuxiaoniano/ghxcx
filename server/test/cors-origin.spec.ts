import { isCorsOriginAllowed } from '../src/common/utils/cors-origin';

describe('CORS origin policy', () => {
  it('rejects browser origins when the production allowlist is empty', () => {
    expect(isCorsOriginAllowed('https://untrusted.example', '', 'production')).toBe(false);
    expect(isCorsOriginAllowed(undefined, '', 'production')).toBe(true);
  });
  it('requires an exact configured origin and preserves local development defaults', () => {
    expect(isCorsOriginAllowed('https://admin.example', 'https://admin.example, https://other.example', 'production')).toBe(true);
    expect(isCorsOriginAllowed('https://admin.example.evil', 'https://admin.example', 'production')).toBe(false);
    expect(isCorsOriginAllowed('http://localhost:5173', '', 'development')).toBe(true);
  });
});
