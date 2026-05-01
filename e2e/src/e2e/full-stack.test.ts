import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallbackUsageEmitter,
  DefaultCostCalculator,
  InMemoryCostTracker,
} from '@reaatech/multi-tenant-mcp-cost-accounting';
import { createMultiTenantMiddleware } from '@reaatech/multi-tenant-mcp-middleware';
import { ConsoleTenantLogger, MetricsCollector } from '@reaatech/multi-tenant-mcp-observability';
import { DefaultRateLimiter, MemoryRateLimitStore } from '@reaatech/multi-tenant-mcp-rate-limiter';
import {
  HeaderTenantResolver,
  TenantContextStore,
} from '@reaatech/multi-tenant-mcp-tenant-resolver';
import { MiddlewareErrorCode } from '@reaatech/multi-tenant-mcp-types';
import { describe, expect, it } from 'vitest';

type TestHandler = (req: unknown) => unknown;

function createMockServer() {
  const handlers = new Map<string, TestHandler>();
  return {
    setRequestHandler: (_method: string, handler: TestHandler) => {
      handlers.set(_method, handler);
    },
    handlers,
  };
}

function getHandler(handlers: Map<string, TestHandler>, method: string): TestHandler {
  const handler = handlers.get(method);
  if (!handler) {
    throw new Error(`Handler not found: ${method}`);
  }
  return handler;
}

describe('Full-stack middleware integration', () => {
  it('should enforce tenant resolution, rate limits, visibility, and cost tracking together', async () => {
    const store = new TenantContextStore();
    const tracker = new InMemoryCostTracker();
    const metrics = new MetricsCollector();
    const events: Array<{ tenantId: string; itemName: string }> = [];

    const middleware = createMultiTenantMiddleware({
      tenantResolver: new HeaderTenantResolver({ header: 'x-tenant-id' }),
      tenantContextStore: store,
      rateLimiter: new DefaultRateLimiter(
        new MemoryRateLimitStore({ requestsPerMinute: 4, tokensPerMinute: 1000 }),
      ),
      toolVisibility: {
        'tenant-a': { type: 'allow', items: ['tool-1'] },
      },
      costCalculator: new DefaultCostCalculator({
        perCall: { 'tool-1': 0.05 },
      }),
      costTracker: tracker,
      usageEmitter: new CallbackUsageEmitter((event) => {
        events.push({ tenantId: event.tenantId, itemName: event.itemName });
      }),
      logger: new ConsoleTenantLogger(),
      metrics,
    });

    const mockServer = createMockServer();

    middleware.handle(mockServer as unknown as Server, 'tools/list', () => ({
      tools: [{ name: 'tool-1' }, { name: 'tool-2' }],
    }));

    middleware.handle(mockServer as unknown as Server, 'tools/call', () => ({
      content: [{ type: 'text', text: 'ok' }],
    }));

    const tenantA = { tenantId: 'tenant-a', metadata: {}, resolvedAt: new Date() };
    const callHandler = getHandler(mockServer.handlers, 'tools/call');
    const listHandler = getHandler(mockServer.handlers, 'tools/list');

    const listResult = (await store.run(tenantA, () => listHandler({}))) as {
      tools: Array<{ name: string }>;
    };

    expect(listResult.tools).toHaveLength(1);
    expect(listResult.tools[0].name).toBe('tool-1');

    const callResult1 = (await store.run(tenantA, () =>
      callHandler({ params: { name: 'tool-1' } }),
    )) as { content: Array<{ text: string }> };

    expect(callResult1.content[0].text).toBe('ok');
    expect(tracker.getAccount('tenant-a').totalCost).toBe(0.05);
    expect(tracker.getAccount('tenant-a').totalCalls).toBe(1);

    await expect(
      store.run(tenantA, () => callHandler({ params: { name: 'tool-2' } })),
    ).rejects.toMatchObject({
      code: MiddlewareErrorCode.ToolForbidden,
    });

    await store.run(tenantA, () => callHandler({ params: { name: 'tool-1' } }));

    await expect(
      store.run(tenantA, () => callHandler({ params: { name: 'tool-1' } })),
    ).rejects.toMatchObject({
      code: MiddlewareErrorCode.RateLimitExceeded,
    });

    expect(
      metrics.requests.getValue({ method: 'tools/call', tenantId: 'tenant-a' }),
    ).toBeGreaterThan(0);
    expect(
      metrics.rateLimitHits.getValue({ method: 'tools/call', tenantId: 'tenant-a' }),
    ).toBeGreaterThan(0);
    expect(Object.values(metrics.errors.entries()).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(events.filter((e) => e.tenantId === 'tenant-a' && e.itemName === 'tool-1')).toHaveLength(
      2,
    );
  });
});
