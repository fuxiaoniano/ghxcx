import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';

export interface MiniTokenPayload {
  userId: string;
  miniOpenId?: string;
}

export interface AdminTokenPayload {
  adminUserId: string;
  username: string;
  nickname?: string;
  role: string;
  roleName?: string;
  permissions: string[];
  dataScope?: 'SELF' | 'ASSIGNED_MEMBERS' | 'TEAM' | 'ALL';
  dataScopeMemberIds?: string[];
  teamId?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  signMini(payload: MiniTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.jwtSecret('JWT_SECRET', 'dev-mini-secret'),
      expiresIn: (this.config.get<string>('JWT_EXPIRES_IN') || '7d') as JwtSignOptions['expiresIn']
    });
  }

  signAdmin(payload: AdminTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.jwtSecret('ADMIN_JWT_SECRET', 'dev-admin-secret'),
      expiresIn: (this.config.get<string>('ADMIN_JWT_EXPIRES_IN') || '8h') as JwtSignOptions['expiresIn']
    });
  }

  private jwtSecret(key: string, developmentFallback: string): string {
    const value = this.config.get<string>(key);
    if (value) return value;
    if (this.config.get<string>('NODE_ENV') !== 'production') return developmentFallback;
    throw new InternalServerErrorException(`${key} is not configured`);
  }
}
