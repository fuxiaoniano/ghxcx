import { normalizeUploadFilename } from '../src/common/utils/upload-filename';

describe('normalizeUploadFilename', () => {
  it('restores an UTF-8 Chinese multipart filename decoded as Latin-1', () => {
    const original = '深度洁牙.jpg';
    const mojibake = Buffer.from(original, 'utf8').toString('latin1');

    expect(normalizeUploadFilename(mojibake)).toBe(original);
  });

  it('preserves filenames that are already valid', () => {
    expect(normalizeUploadFilename('医生头像.png')).toBe('医生头像.png');
    expect(normalizeUploadFilename('doctor-avatar.png')).toBe('doctor-avatar.png');
  });
});
