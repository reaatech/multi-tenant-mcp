/**
 * Per-tenant rate limit configuration.
 */
export interface RateLimitConfig {
  /** Maximum requests per minute */
  readonly requestsPerMinute: number;
  /** Maximum tokens per minute */
  readonly tokensPerMinute: number;
}

/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  readonly allowed: boolean;
  /** Remaining requests in current window */
  readonly remainingRequests: number;
  /** Remaining tokens in current window */
  readonly remainingTokens: number;
  /** Unix timestamp (ms) when the limit resets */
  readonly resetAt: number;
}

/**
 * Storage backend for rate limit counters.
 */
export interface RateLimitStore {
  /**
   * Check and optionally increment the rate limit counter for a tenant.
   *
   * @param tenantId - Tenant identifier
   * @param tokens - Number of tokens consumed by this request
   * @param increment - If `true`, actually consume the quota; if `false`, peek only
   */
  check(
    tenantId: string,
    tokens: number,
    increment: boolean
  ): Promise<RateLimitResult> | RateLimitResult;
}

/**
 * Core rate limiting engine.
 */
export interface RateLimiter {
  /**
   * Check whether a tenant request is within rate limits.
   *
   * @param tenantId - Tenant identifier
   * @param tokens - Tokens consumed by this request (default: 0)
   */
  check(tenantId: string, tokens?: number): Promise<RateLimitResult>;
}
