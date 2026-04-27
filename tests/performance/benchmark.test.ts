import { describe, expect, it } from "vitest";
import {
  createMultiTenantMiddleware,
  HeaderTenantResolver,
  TenantContextStore,
  MemoryRateLimitStore,
  DefaultRateLimiter,
  DefaultCostCalculator,
  InMemoryCostTracker,
  VisibilityEngineImpl,
} from "../../src/index.js";

describe("Performance: Middleware overhead", () => {
  it("should process a simple request in under 5ms", async () => {
    const store = new TenantContextStore();
    const middleware = createMultiTenantMiddleware({
      tenantResolver: new HeaderTenantResolver({ header: "x-tenant-id" }),
      tenantContextStore: store,
      rateLimiter: new DefaultRateLimiter(
        new MemoryRateLimitStore({ requestsPerMinute: 10000, tokensPerMinute: 1000000 })
      ),
      toolVisibility: {
        "tenant-a": { type: "allow", items: ["tool-1"] },
      },
      costCalculator: new DefaultCostCalculator({ perCall: { "tool-1": 0.01 } }),
      costTracker: new InMemoryCostTracker(),
    });

    const mockServer = {
      setRequestHandler: (_method: string, handler: (req: unknown) => unknown) => {
        (mockServer as unknown as Record<string, unknown>).handlers =
          (mockServer as unknown as Record<string, unknown>).handlers || {};
        ((mockServer as unknown as Record<string, unknown>).handlers as Record<string, unknown>)[
          _method
        ] = handler;
      },
    };

    middleware.handle(mockServer as never, "tools/call", () => ({
      content: [{ type: "text", text: "ok" }],
    }));

    const handler = (
      mockServer as unknown as { handlers: Record<string, (req: unknown) => unknown> }
    ).handlers["tools/call"];

    const tenantA = { tenantId: "tenant-a", metadata: {}, resolvedAt: new Date() };

    // Warmup
    for (let i = 0; i < 100; i++) {
      await store.run(tenantA, () => handler({ params: { name: "tool-1" } }));
    }

    // Benchmark
    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      await store.run(tenantA, () => handler({ params: { name: "tool-1" } }));
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    expect(avgMs).toBeLessThan(5);
  });
});

describe("Performance: Load simulation", () => {
  it("should handle 1,000 concurrent tenants", async () => {
    const store = new MemoryRateLimitStore({ requestsPerMinute: 10000, tokensPerMinute: 1000000 });
    const limiter = new DefaultRateLimiter(store);
    const engine = new VisibilityEngineImpl(
      Object.fromEntries(
        Array.from({ length: 1000 }, (_, i) => [
          `tenant-${String(i)}`,
          { type: "allow", items: ["tool-1"] },
        ])
      )
    );

    const tenants = Array.from({ length: 1000 }, (_, i) => `tenant-${String(i)}`);

    const start = performance.now();
    await Promise.all(
      tenants.map(async (tenantId) => {
        for (let r = 0; r < 10; r++) {
          await limiter.check(tenantId, 0);
          await engine.isVisible("tool-1", tenantId);
        }
      })
    );
    const elapsed = performance.now() - start;

    // 10,000 operations should complete in under 2 seconds
    expect(elapsed).toBeLessThan(2000);
  });
});
