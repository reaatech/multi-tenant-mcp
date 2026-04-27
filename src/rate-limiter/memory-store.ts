import { BoundedMap } from "../types/bounded-map.js";
import type { RateLimitConfig, RateLimitResult, RateLimitStore } from "./types.js";

interface TenantBucket {
  requests: number;
  tokens: number;
  windowStart: number;
}

/**
 * Options controlling the in-memory store itself (capacity, etc.),
 * separate from the per-tenant rate limits.
 */
export interface MemoryRateLimitStoreOptions {
  /**
   * Maximum distinct tenants tracked simultaneously. When exceeded,
   * the least-recently-used bucket is evicted. Defaults to 10_000.
   */
  readonly maxTenants?: number;
}

/**
 * In-memory rate limit store using a fixed-window counter.
 *
 * Suitable for development and single-instance deployments. For
 * multi-instance deployments use `RedisRateLimitStore`.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets: BoundedMap<string, TenantBucket>;
  private readonly windowMs: number;

  constructor(
    private readonly config: RateLimitConfig,
    options: MemoryRateLimitStoreOptions = {}
  ) {
    this.windowMs = 60_000;
    this.buckets = new BoundedMap(options.maxTenants ?? 10_000);
  }

  check(tenantId: string, tokens: number, increment: boolean): RateLimitResult {
    const now = Date.now();
    const bucket = this.getBucket(tenantId, now);

    const allowed =
      bucket.requests < this.config.requestsPerMinute &&
      bucket.tokens + tokens <= this.config.tokensPerMinute;

    if (increment && allowed) {
      bucket.requests += 1;
      bucket.tokens += tokens;
    }

    const resetAt = bucket.windowStart + this.windowMs;

    return {
      allowed,
      remainingRequests: Math.max(0, this.config.requestsPerMinute - bucket.requests),
      remainingTokens: Math.max(0, this.config.tokensPerMinute - bucket.tokens),
      resetAt,
    };
  }

  private getBucket(tenantId: string, now: number): TenantBucket {
    const existing = this.buckets.get(tenantId);
    if (existing && now - existing.windowStart < this.windowMs) {
      return existing;
    }

    const fresh: TenantBucket = { requests: 0, tokens: 0, windowStart: now };
    this.buckets.set(tenantId, fresh);
    return fresh;
  }
}
