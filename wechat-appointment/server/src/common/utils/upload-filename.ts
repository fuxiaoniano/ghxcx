/**
 * Multipart headers are byte-oriented. Busboy/Multer may expose an UTF-8 file
 * name as Latin-1 text, so restore it only when the conversion is lossless.
 */
export function normalizeUploadFilename(value: string) {
  if (!value) return value;

  const decoded = Buffer.from(value, 'latin1').toString('utf8');
  if (decoded.includes('\uFFFD')) return value;

  const roundTrip = Buffer.from(decoded, 'utf8').toString('latin1');
  return roundTrip === value ? decoded : value;
}
