import { describe, expect, it } from "vitest";
import { MemoryRateLimitStore } from "./memory-store.js";

describe("MemoryRateLimitStore", () => {
  it("should allow requests within limit", () => {
    const store = new MemoryRateLimitStore({ requestsPerMinute: 5, tokensPerMinute: 100 });
    const result = store.check("t1", 10, true);

    expect(result.allowed).toBe(true);
    expect(result.remainingRequests).toBe(4);
    expect(result.remainingTokens).toBe(90);
  });

  it("should deny requests that exceed request limit", () => {
    const store = new MemoryRateLimitStore({ requestsPerMinute: 2, tokensPerMinute: 100 });
    store.check("t1", 0, true);
    store.check("t1", 0, true);
    const result = store.check("t1", 0, true);

    expect(result.allowed).toBe(false);
    expect(result.remainingRequests).toBe(0);
  });

  it("should deny requests that exceed token limit", () => {
    const store = new MemoryRateLimitStore({ requestsPerMinute: 100, tokensPerMinute: 50 });
    store.check("t1", 30, true);
    const result = store.check("t1", 30, true);

    expect(result.allowed).toBe(false);
  });

  it("should track tenants independently", () => {
    const store = new MemoryRateLimitStore({ requestsPerMinute: 1, tokensPerMinute: 100 });
    store.check("t1", 0, true);

    const t2Result = store.check("t2", 0, true);
    expect(t2Result.allowed).toBe(true);

    const t1Result = store.check("t1", 0, true);
    expect(t1Result.allowed).toBe(false);
  });

  it("should not increment when increment is false (peek)", () => {
    const store = new MemoryRateLimitStore({ requestsPerMinute: 1, tokensPerMinute: 100 });
    const peek = store.check("t1", 0, false);

    expect(peek.allowed).toBe(true);
    expect(peek.remainingRequests).toBe(1);

    const after = store.check("t1", 0, true);
    expect(after.remainingRequests).toBe(0);
  });
});
