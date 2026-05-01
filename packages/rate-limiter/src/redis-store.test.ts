import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisRateLimitStore } from './redis-store.js';

describe('RedisRateLimitStore', () => {
  const createMockRedis = () => {
    const data = new Map<string, string>();
    return {
      mGet: vi.fn(async (keys: string[]) => keys.map((k) => data.get(k) ?? null)),
      multi: vi.fn(() => ({
        incr: vi.fn(function (this: { commands: unknown[] }, key: string) {
          this.commands.push(['incr', key]);
          return this;
        }),
        incrBy: vi.fn(function (this: { commands: unknown[] }, key: string, amount: number) {
          this.commands.push(['incrBy', key, amount]);
          return this;
        }),
        pExpire: vi.fn(function (this: { commands: unknown[] }, key: string, ms: number) {
          this.commands.push(['pExpire', key, ms]);
          return this;
        }),
        exec: vi.fn(async function (this: { commands: unknown[] }) {
          for (const cmd of this.commands) {
            if (cmd[0] === 'incr' || cmd[0] === 'incrBy') {
              const key = cmd[1] as string;
              const current = Number(data.get(key) ?? 0);
              const amount = cmd[0] === 'incrBy' ? (cmd[2] as number) : 1;
              data.set(key, String(current + amount));
            }
          }
          this.commands = [];
          return [];
        }),
        commands: [] as unknown[],
      })),
      _data: data,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow requests within limit', async () => {
    const redis = createMockRedis();
    const store = new RedisRateLimitStore(redis as never, {
      requestsPerMinute: 5,
      tokensPerMinute: 100,
    });

    const result = await store.check('t1', 10, true);
    expect(result.allowed).toBe(true);
    expect(result.remainingRequests).toBe(4);
    expect(result.remainingTokens).toBe(90);
  });

  it('should deny requests that exceed request limit', async () => {
    const redis = createMockRedis();
    const store = new RedisRateLimitStore(redis as never, {
      requestsPerMinute: 2,
      tokensPerMinute: 100,
    });

    await store.check('t1', 0, true);
    await store.check('t1', 0, true);
    const result = await store.check('t1', 0, true);

    expect(result.allowed).toBe(false);
    expect(result.remainingRequests).toBe(0);
  });

  it('should deny requests that exceed token limit', async () => {
    const redis = createMockRedis();
    const store = new RedisRateLimitStore(redis as never, {
      requestsPerMinute: 100,
      tokensPerMinute: 50,
    });

    await store.check('t1', 30, true);
    const result = await store.check('t1', 30, true);

    expect(result.allowed).toBe(false);
  });

  it('should not increment when increment is false (peek)', async () => {
    const redis = createMockRedis();
    const store = new RedisRateLimitStore(redis as never, {
      requestsPerMinute: 1,
      tokensPerMinute: 100,
    });

    const peek = await store.check('t1', 0, false);
    expect(peek.allowed).toBe(true);
    expect(peek.remainingRequests).toBe(1);

    const after = await store.check('t1', 0, true);
    expect(after.remainingRequests).toBe(0);
  });

  it('should track tenants independently', async () => {
    const redis = createMockRedis();
    const store = new RedisRateLimitStore(redis as never, {
      requestsPerMinute: 1,
      tokensPerMinute: 100,
    });

    await store.check('t1', 0, true);
    const t2Result = await store.check('t2', 0, true);
    expect(t2Result.allowed).toBe(true);

    const t1Result = await store.check('t1', 0, true);
    expect(t1Result.allowed).toBe(false);
  });
});
