import type { RedisClientType } from 'redis';
import type { RateLimitConfig, RateLimitResult, RateLimitStore } from './types.js';

/**
 * Redis-backed rate limit store using fixed windows per minute.
 *
 * Keys are bucketed by minute (`YYYY-MM-DDTHH:MM`) and automatically
 * expire after the window passes.
 */
export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private readonly redis: RedisClientType,
    private readonly config: RateLimitConfig,
    private readonly keyPrefix = 'mtm:ratelimit',
  ) {}

  async check(tenantId: string, tokens: number, increment: boolean): Promise<RateLimitResult> {
    const bucket = this.currentBucket();
    const requestKey = `${this.keyPrefix}:${tenantId}:requests:${bucket}`;
    const tokenKey = `${this.keyPrefix}:${tenantId}:tokens:${bucket}`;

    const windowMs = 60_000;
    const resetAt = this.nextBucketTimestamp();

    // Peek current counters
    const [reqStr, tokStr] = await this.redis.mGet([requestKey, tokenKey]);
    const currentRequests = Number(reqStr ?? 0);
    const currentTokens = Number(tokStr ?? 0);

    const allowed =
      currentRequests < this.config.requestsPerMinute &&
      currentTokens + tokens <= this.config.tokensPerMinute;

    if (increment && allowed) {
      const pipeline = this.redis.multi();
      pipeline.incr(requestKey);
      if (tokens > 0) {
        pipeline.incrBy(tokenKey, tokens);
      }
      // Ensure expiry on both keys
      pipeline.pExpire(requestKey, windowMs);
      if (tokens > 0) {
        pipeline.pExpire(tokenKey, windowMs);
      }
      await pipeline.exec();
    }

    return {
      allowed,
      remainingRequests: Math.max(
        0,
        this.config.requestsPerMinute - currentRequests - (increment && allowed ? 1 : 0),
      ),
      remainingTokens: Math.max(
        0,
        this.config.tokensPerMinute - currentTokens - (increment && allowed ? tokens : 0),
      ),
      resetAt,
    };
  }

  private currentBucket(): string {
    const now = new Date();
    return `${String(now.getUTCFullYear())}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
  }

  private nextBucketTimestamp(): number {
    const now = new Date();
    const next = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes() + 1,
        0,
        0,
      ),
    );
    return next.getTime();
  }
}
