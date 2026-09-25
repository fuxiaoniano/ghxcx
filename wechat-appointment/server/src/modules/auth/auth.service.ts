import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface MiniTokenPayload {
  userId: string;
  miniOpenId?: string;
}

export interface AdminTokenPayload {
  adminUserId: string;
  username: string;
  nickname?: string;
  role: string;
  permissions: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  signMini(payload: MiniTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET') || 'dev-mini-secret',
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') || '7d'
    });
  }

  signAdmin(payload: AdminTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.get<string>('ADMIN_JWT_SECRET') || 'dev-admin-secret',
      expiresIn: this.config.get<string>('ADMIN_JWT_EXPIRES_IN') || '8h'
    });
  }
}
