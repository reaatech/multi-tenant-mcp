import type { RateLimitResult, RateLimiter, RateLimitStore } from "./types.js";

/**
 * Default rate limiter that wraps a {@link RateLimitStore} and a
 * {@link RateLimitConfig}.
 */
export class DefaultRateLimiter implements RateLimiter {
  constructor(private readonly store: RateLimitStore) {}

  async check(tenantId: string, tokens = 0): Promise<RateLimitResult> {
    return this.store.check(tenantId, tokens, true);
  }
}
