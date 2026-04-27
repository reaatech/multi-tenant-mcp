import { describe, expect, it } from "vitest";
import {
  createMultiTenantMiddleware,
  HeaderTenantResolver,
  TenantContextStore,
  MemoryRateLimitStore,
  DefaultRateLimiter,
  DefaultCostCalculator,
  InMemoryCostTracker,
  CallbackUsageEmitter,
  ConsoleTenantLogger,
  MetricsCollector,
  MiddlewareErrorCode,
} from "../../src/index.js";

function createMockServer() {
  const handlers = new Map<string, (req: unknown) => unknown>();
  return {
    setRequestHandler: (_method: string, handler: (req: unknown) => unknown) => {
      handlers.set(_method, handler);
    },
    handlers,
  };
}

describe("Full-stack middleware integration", () => {
  it("should enforce tenant resolution, rate limits, visibility, and cost tracking together", async () => {
    const store = new TenantContextStore();
    const tracker = new InMemoryCostTracker();
    const metrics = new MetricsCollector();
    const events: Array<{ tenantId: string; itemName: string }> = [];

    const middleware = createMultiTenantMiddleware({
      tenantResolver: new HeaderTenantResolver({ header: "x-tenant-id" }),
      tenantContextStore: store,
      rateLimiter: new DefaultRateLimiter(
        new MemoryRateLimitStore({ requestsPerMinute: 4, tokensPerMinute: 1000 })
      ),
      toolVisibility: {
        "tenant-a": { type: "allow", items: ["tool-1"] },
      },
      costCalculator: new DefaultCostCalculator({
        perCall: { "tool-1": 0.05 },
      }),
      costTracker: tracker,
      usageEmitter: new CallbackUsageEmitter((event) => {
        events.push({ tenantId: event.tenantId, itemName: event.itemName });
      }),
      logger: new ConsoleTenantLogger(),
      metrics,
    });

    const mockServer = createMockServer();

    middleware.handle(mockServer as never, "tools/list", () => ({
      tools: [{ name: "tool-1" }, { name: "tool-2" }],
    }));

    middleware.handle(mockServer as never, "tools/call", () => ({
      content: [{ type: "text", text: "ok" }],
    }));

    const tenantA = { tenantId: "tenant-a", metadata: {}, resolvedAt: new Date() };

    // 1. tools/list should filter to only tool-1
    const listResult = (await store.run(tenantA, () =>
      mockServer.handlers.get("tools/list")!({})
    )) as { tools: Array<{ name: string }> };

    expect(listResult.tools).toHaveLength(1);
    expect(listResult.tools[0].name).toBe("tool-1");

    // 2. tools/call for tool-1 should succeed, track cost, emit event
    const callResult1 = (await store.run(tenantA, () =>
      mockServer.handlers.get("tools/call")!({ params: { name: "tool-1" } })
    )) as { content: Array<{ text: string }> };

    expect(callResult1.content[0].text).toBe("ok");
    expect(tracker.getAccount("tenant-a").totalCost).toBe(0.05);
    expect(tracker.getAccount("tenant-a").totalCalls).toBe(1);

    // 3. tools/call for tool-2 should be forbidden
    await expect(
      store.run(tenantA, () =>
        mockServer.handlers.get("tools/call")!({ params: { name: "tool-2" } })
      )
    ).rejects.toMatchObject({
      code: MiddlewareErrorCode.ToolForbidden,
    });

    // 4. Second call should succeed; third should hit rate limit
    await store.run(tenantA, () =>
      mockServer.handlers.get("tools/call")!({ params: { name: "tool-1" } })
    );

    await expect(
      store.run(tenantA, () =>
        mockServer.handlers.get("tools/call")!({ params: { name: "tool-1" } })
      )
    ).rejects.toMatchObject({
      code: MiddlewareErrorCode.RateLimitExceeded,
    });

    // 5. Metrics should reflect activity
    expect(
      metrics.requests.getValue({ method: "tools/call", tenantId: "tenant-a" })
    ).toBeGreaterThan(0);
    expect(
      metrics.rateLimitHits.getValue({ method: "tools/call", tenantId: "tenant-a" })
    ).toBeGreaterThan(0);
    expect(Object.values(metrics.errors.entries()).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);

    // 6. Usage events should have been emitted
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(events.filter((e) => e.tenantId === "tenant-a" && e.itemName === "tool-1")).toHaveLength(
      2
    );
  });
});
