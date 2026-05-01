import { describe, expect, it } from 'vitest';
import { MemoryRateLimitStore } from './memory-store.js';
import { DefaultRateLimiter } from './rate-limiter.js';

describe('DefaultRateLimiter', () => {
  it('should allow requests within limit', async () => {
    const store = new MemoryRateLimitStore({ requestsPerMinute: 5, tokensPerMinute: 100 });
    const limiter = new DefaultRateLimiter(store);

    const result = await limiter.check('t1', 10);
    expect(result.allowed).toBe(true);
  });

  it('should deny requests that exceed limit', async () => {
    const store = new MemoryRateLimitStore({ requestsPerMinute: 1, tokensPerMinute: 100 });
    const limiter = new DefaultRateLimiter(store);

    await limiter.check('t1', 0);
    const result = await limiter.check('t1', 0);
    expect(result.allowed).toBe(false);
  });

  it('should pass through tokens parameter', async () => {
    const store = new MemoryRateLimitStore({ requestsPerMinute: 100, tokensPerMinute: 50 });
    const limiter = new DefaultRateLimiter(store);

    const result = await limiter.check('t1', 60);
    expect(result.allowed).toBe(false);
  });
});
