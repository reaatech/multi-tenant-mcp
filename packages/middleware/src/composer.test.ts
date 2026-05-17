import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { DefaultRateLimiter, MemoryRateLimitStore } from '@reaatech/multi-tenant-mcp-rate-limiter';
import { TenantContextStore } from '@reaatech/multi-tenant-mcp-tenant-resolver';
import type { TenantContext } from '@reaatech/multi-tenant-mcp-types';
import { MiddlewareErrorCode } from '@reaatech/multi-tenant-mcp-types';
import { describe, expect, it, vi } from 'vitest';
import { createMultiTenantMiddleware } from './composer.js';
import type { MultiTenantMiddlewareConfig } from './types.js';

type WrappedHandler = (req: unknown) => Promise<unknown>;

const mockServer = (): {
  server: Server;
  setRequestHandler: ReturnType<typeof vi.fn>;
} => {
  const setRequestHandler = vi.fn();
  return { server: { setRequestHandler } as unknown as Server, setRequestHandler };
};

const capturedHandler = (setRequestHandler: ReturnType<typeof vi.fn>): WrappedHandler => {
  const call = setRequestHandler.mock.calls[0] as [unknown, WrappedHandler];
  return call[1];
};

const ctx = (tenantId: string): TenantContext => ({
  tenantId,
  metadata: {},
  resolvedAt: new Date(),
});

describe('createMultiTenantMiddleware', () => {
  it('throws when tenantContextStore is missing', () => {
    expect(() => createMultiTenantMiddleware({} as MultiTenantMiddlewareConfig)).toThrow(
      /tenantContextStore/,
    );
  });

  it('returns a middleware with a handle method', () => {
    const middleware = createMultiTenantMiddleware({
      tenantContextStore: new TenantContextStore(),
    });
    expect(typeof middleware.handle).toBe('function');
  });

  it('registers a handler on the server', () => {
    const middleware = createMultiTenantMiddleware({
      tenantContextStore: new TenantContextStore(),
    });
    const { server, setRequestHandler } = mockServer();

    middleware.handle(server, 'tools/list', () => ({ tools: [] }));

    expect(setRequestHandler).toHaveBeenCalledOnce();
  });

  it('filters tools based on visibility policy', async () => {
    const store = new TenantContextStore();
    const middleware = createMultiTenantMiddleware({
      tenantContextStore: store,
      toolVisibility: { t1: { type: 'allow', items: ['tool-1'] } },
    });
    const { server, setRequestHandler } = mockServer();

    middleware.handle(server, 'tools/list', () => ({
      tools: [{ name: 'tool-1' }, { name: 'tool-2' }],
    }));

    const wrapped = capturedHandler(setRequestHandler);
    const result = (await store.run(ctx('t1'), () => wrapped({}))) as {
      tools: Array<{ name: string }>;
    };

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe('tool-1');
  });

  it('throws Unauthorized when no tenant context is in scope', async () => {
    const middleware = createMultiTenantMiddleware({
      tenantContextStore: new TenantContextStore(),
    });
    const { server, setRequestHandler } = mockServer();

    middleware.handle(server, 'tools/list', () => ({ tools: [] }));

    const wrapped = capturedHandler(setRequestHandler);
    await expect(wrapped({})).rejects.toMatchObject({
      code: MiddlewareErrorCode.Unauthorized,
    });
  });

  it('throws rate limit error when limit is exceeded', async () => {
    const store = new TenantContextStore();
    const rateLimiter = new DefaultRateLimiter(
      new MemoryRateLimitStore({ requestsPerMinute: 1, tokensPerMinute: 100 }),
    );

    const middleware = createMultiTenantMiddleware({
      tenantContextStore: store,
      rateLimiter,
    });
    const { server, setRequestHandler } = mockServer();

    middleware.handle(server, 'tools/list', () => ({ tools: [] }));

    const wrapped = capturedHandler(setRequestHandler);

    await store.run(ctx('t1'), () => wrapped({}));

    await store.run(ctx('t1'), async () => {
      await expect(wrapped({})).rejects.toMatchObject({
        code: MiddlewareErrorCode.RateLimitExceeded,
      });
    });
  });

  it('rejects resources/read for hidden resources', async () => {
    const store = new TenantContextStore();
    const middleware = createMultiTenantMiddleware({
      tenantContextStore: store,
      resourceVisibility: { t1: { type: 'allow', items: ['file:///a.txt'] } },
    });
    const { server, setRequestHandler } = mockServer();

    middleware.handle(server, 'resources/read', () => ({
      contents: [{ uri: 'file:///b.txt', text: 'secret' }],
    }));

    const wrapped = capturedHandler(setRequestHandler);

    await store.run(ctx('t1'), async () => {
      await expect(wrapped({ params: { uri: 'file:///b.txt' } })).rejects.toMatchObject({
        code: MiddlewareErrorCode.ResourceForbidden,
      });
    });
  });

  it('rejects prompts/get for hidden prompts', async () => {
    const store = new TenantContextStore();
    const middleware = createMultiTenantMiddleware({
      tenantContextStore: store,
      promptVisibility: { t1: { type: 'allow', items: ['prompt-1'] } },
    });
    const { server, setRequestHandler } = mockServer();

    middleware.handle(server, 'prompts/get', () => ({
      messages: [{ role: 'user', content: { type: 'text', text: 'hello' } }],
    }));

    const wrapped = capturedHandler(setRequestHandler);

    await store.run(ctx('t1'), async () => {
      await expect(wrapped({ params: { name: 'prompt-2' } })).rejects.toMatchObject({
        code: MiddlewareErrorCode.PromptForbidden,
      });
    });
  });

  it('uses connection-scoped tenant context from the store', async () => {
    const store = new TenantContextStore();
    const middleware = createMultiTenantMiddleware({
      tenantContextStore: store,
      toolVisibility: { 'scoped-tenant': { type: 'allow', items: ['tool-1'] } },
    });
    const { server, setRequestHandler } = mockServer();

    middleware.handle(server, 'tools/list', () => ({
      tools: [{ name: 'tool-1' }, { name: 'tool-2' }],
    }));

    const wrapped = capturedHandler(setRequestHandler);

    const result = (await store.run(ctx('scoped-tenant'), () => wrapped({}))) as {
      tools: Array<{ name: string }>;
    };

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe('tool-1');
  });
});
