import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';

@Injectable()
export class CryptoService {
  constructor(private readonly config: ConfigService) {}

  encryptPhone(phone: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getAesKey(), iv);
    const encrypted = Buffer.concat([cipher.update(phone, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
  }

  decryptPhone(payload: string): string {
    const [ivBase64, tagBase64, encryptedBase64] = payload.split(':');
    const decipher = createDecipheriv('aes-256-gcm', this.getAesKey(), Buffer.from(ivBase64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedBase64, 'base64')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  }

  hashPhone(phone: string): string {
    const salt = this.getRequiredConfig('PHONE_HASH_SALT');
    return createHmac('sha256', salt).update(phone).digest('hex');
  }

  maskPhone(phone: string): string {
    if (phone.length < 7) {
      return phone;
    }
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  }

  encryptText(text: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getAesKey(), iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
  }

  private getAesKey(): Buffer {
    const raw = this.getRequiredConfig('PHONE_ENCRYPTION_KEY');
    return createHash('sha256').update(raw).digest();
  }

  private getRequiredConfig(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new InternalServerErrorException(`${key} is not configured`);
    }
    return value;
  }
}
