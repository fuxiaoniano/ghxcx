import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { BusinessException } from '../utils/business-exception';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject('REDIS') private readonly redis: Redis,
    private readonly config: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ ip?: string; method: string; path: string }>();
    const ttl = Number(this.config.get('RATE_LIMIT_TTL') || 60);
    const max = Number(this.config.get('RATE_LIMIT_MAX') || 120);
    const key = `rate:${request.ip || 'unknown'}:${request.method}:${request.path}`;
    const count = Number(await this.redis.eval(
      "local count = redis.call('incr', KEYS[1]); if count == 1 or redis.call('ttl', KEYS[1]) < 0 then redis.call('expire', KEYS[1], ARGV[1]); end; return count",
      1, key, String(ttl)
    ));
    if (count > max) {
      throw new BusinessException(429001, '请求过于频繁，请稍后再试', 429);
    }
    return true;
  }
}
