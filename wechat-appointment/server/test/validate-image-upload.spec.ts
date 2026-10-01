import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { validateStoredImageUpload } from '../src/common/utils/validate-image-upload';

describe('validateStoredImageUpload', () => {
  it('accepts a file whose header matches its image extension', () => {
    const path = join(tmpdir(), `${randomUUID()}.png`);
    writeFileSync(path, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]));
    expect(() => validateStoredImageUpload({ path, originalname: 'cover.png' })).not.toThrow();
    unlinkSync(path);
  });

  it('rejects and removes a disguised non-image upload', () => {
    const path = join(tmpdir(), `${randomUUID()}.png`);
    writeFileSync(path, Buffer.from('not an image'));
    expect(() => validateStoredImageUpload({ path, originalname: 'payload.png' })).toThrow('内容与格式不一致');
    expect(existsSync(path)).toBe(false);
  });
});
