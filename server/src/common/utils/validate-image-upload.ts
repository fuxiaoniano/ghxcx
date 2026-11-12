import { BadRequestException } from '@nestjs/common';
import { readFileSync, unlinkSync } from 'fs';
import { extname } from 'path';

const signatures: Record<string, (header: Buffer) => boolean> = {
  '.jpg': (header) => header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff,
  '.jpeg': (header) => header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff,
  '.png': (header) => header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  '.gif': (header) => ['GIF87a', 'GIF89a'].includes(header.subarray(0, 6).toString('ascii')),
  '.webp': (header) => header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP'
};

/** Multer 已落盘后按文件头复核，避免仅伪造扩展名和 Content-Type 上传任意文件。 */
export function validateStoredImageUpload(file: { path: string; originalname?: string }) {
  const extension = extname(file.originalname || '').toLowerCase();
  let valid = false;
  try {
    const header = readFileSync(file.path).subarray(0, 12);
    valid = Boolean(signatures[extension]?.(header));
  } catch {
    valid = false;
  }
  if (valid) return;
  try { unlinkSync(file.path); } catch { /* 文件可能已被系统清理。 */ }
  throw new BadRequestException('图片文件内容与格式不一致');
}
