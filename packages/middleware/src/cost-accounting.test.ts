import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { DefaultCostCalculator } from '@reaatech/multi-tenant-mcp-cost-accounting';
import { InMemoryCostTracker } from '@reaatech/multi-tenant-mcp-cost-accounting';
import { CallbackUsageEmitter } from '@reaatech/multi-tenant-mcp-cost-accounting';
import { TenantContextStore } from '@reaatech/multi-tenant-mcp-tenant-resolver';
import type { TenantContext } from '@reaatech/multi-tenant-mcp-types';
import { describe, expect, it, vi } from 'vitest';
import { createMultiTenantMiddleware } from './composer.js';

type TestHandler = (req: unknown) => unknown;

function createMockServer() {
  const handlers = new Map<string, TestHandler>();
  return {
    setRequestHandler: vi.fn((method: string, handler: TestHandler) => {
      handlers.set(method, handler);
    }),
    handlers,
  };
}

function ctx(tenantId: string): TenantContext {
  return { tenantId, metadata: {}, resolvedAt: new Date() };
}

function getHandler(handlers: Map<string, TestHandler>, method: string): TestHandler {
  const handler = handlers.get(method);
  if (!handler) {
    throw new Error(`Handler not found: ${method}`);
  }
  return handler;
}

describe('Cost accounting middleware integration', () => {
  it('should track per-call costs', async () => {
    const store = new TenantContextStore();
    const mockServer = createMockServer();
    const tracker = new InMemoryCostTracker();
    const calculator = new DefaultCostCalculator({
      perCall: { 'tool-a': 0.05 },
    });

    const middleware = createMultiTenantMiddleware({
      tenantContextStore: store,
      costCalculator: calculator,
      costTracker: tracker,
    });

    middleware.handle(mockServer as unknown as Server, 'tools/call', () => ({
      content: [{ type: 'text', text: 'ok' }],
    }));

    const handler = getHandler(mockServer.handlers, 'tools/call');
    await store.run(ctx('t1'), () => handler({ params: { name: 'tool-a' } }));

    const account = tracker.getAccount('t1');
    expect(account.totalCost).toBe(0.05);
    expect(account.totalCalls).toBe(1);
  });

  it('should extract tokens from result and apply per-token pricing', async () => {
    const store = new TenantContextStore();
    const mockServer = createMockServer();
    const tracker = new InMemoryCostTracker();
    const calculator = new DefaultCostCalculator({
      perToken: { input: 0.001, output: 0.002 },
    });

    const middleware = createMultiTenantMiddleware({
      tenantContextStore: store,
      costCalculator: calculator,
      costTracker: tracker,
      tokenExtractor: (result: unknown) => {
        const r = result as { usage?: { inputTokens: number; outputTokens: number } };
        return r.usage;
      },
    });

    middleware.handle(mockServer as unknown as Server, 'tools/call', () => ({
      content: [{ type: 'text', text: 'ok' }],
      usage: { inputTokens: 100, outputTokens: 50 },
    }));

    const handler = getHandler(mockServer.handlers, 'tools/call');
    await store.run(ctx('t1'), () => handler({ params: { name: 'tool-a' } }));

    const account = tracker.getAccount('t1');
    expect(account.totalCost).toBe(100 * 0.001 + 50 * 0.002);
    expect(account.totalInputTokens).toBe(100);
    expect(account.totalOutputTokens).toBe(50);
  });

  it('should emit usage events asynchronously', async () => {
    const store = new TenantContextStore();
    const mockServer = createMockServer();
    const events: Array<{ tenantId: string; itemName: string }> = [];
    const emitter = new CallbackUsageEmitter((event) => {
      events.push({ tenantId: event.tenantId, itemName: event.itemName });
    });

    const middleware = createMultiTenantMiddleware({
      tenantContextStore: store,
      usageEmitter: emitter,
    });

    middleware.handle(mockServer as unknown as Server, 'tools/call', () => ({
      content: [{ type: 'text', text: 'ok' }],
    }));

    const handler = getHandler(mockServer.handlers, 'tools/call');
    await store.run(ctx('t1'), () => handler({ params: { name: 'tool-a' } }));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ tenantId: 't1', itemName: 'tool-a' });
  });

  it('should not track costs for list operations', async () => {
    const store = new TenantContextStore();
    const mockServer = createMockServer();
    const tracker = new InMemoryCostTracker();
    const calculator = new DefaultCostCalculator({
      perCall: { 'tool-a': 0.05 },
    });

    const middleware = createMultiTenantMiddleware({
      tenantContextStore: store,
      costCalculator: calculator,
      costTracker: tracker,
    });

    middleware.handle(mockServer as unknown as Server, 'tools/list', () => ({
      tools: [{ name: 'tool-a' }],
    }));

    const handler = getHandler(mockServer.handlers, 'tools/list');
    await store.run(ctx('t1'), () => handler({}));

    const account = tracker.getAccount('t1');
    expect(account.totalCalls).toBe(0);
    expect(account.totalCost).toBe(0);
  });

  it('should track resource and prompt costs', async () => {
    const store = new TenantContextStore();
    const mockServer = createMockServer();
    const tracker = new InMemoryCostTracker();
    const calculator = new DefaultCostCalculator({
      perCall: { 'resource-a': 0.1, 'prompt-a': 0.2 },
    });

    const middleware = createMultiTenantMiddleware({
      tenantContextStore: store,
      costCalculator: calculator,
      costTracker: tracker,
    });

    middleware.handle(mockServer as unknown as Server, 'resources/read', () => ({
      contents: [{ uri: 'resource-a', text: 'data' }],
    }));
    middleware.handle(mockServer as unknown as Server, 'prompts/get', () => ({
      messages: [{ role: 'user', content: { type: 'text', text: 'hello' } }],
    }));

    await store.run(ctx('t1'), () =>
      getHandler(mockServer.handlers, 'resources/read')({ params: { uri: 'resource-a' } }),
    );
    await store.run(ctx('t1'), () =>
      getHandler(mockServer.handlers, 'prompts/get')({ params: { name: 'prompt-a' } }),
    );

    const account = tracker.getAccount('t1');
    expect(account.totalCalls).toBe(2);
    expect(account.totalCost).toBeCloseTo(0.3, 10);
  });
});
