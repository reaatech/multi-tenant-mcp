import type { TenantContext } from '@reaatech/multi-tenant-mcp-types';
import { describe, expect, it } from 'vitest';
import { TenantContextStore } from './context-store.js';

describe('TenantContextStore', () => {
  const mockContext: TenantContext = {
    tenantId: 't1',
    metadata: { plan: 'pro' },
    resolvedAt: new Date(),
  };

  it('should store and retrieve context within a run', () => {
    const store = new TenantContextStore();

    store.run(mockContext, () => {
      const ctx = store.get();
      expect(ctx).toEqual(mockContext);
    });
  });

  it('should return undefined outside a run', () => {
    const store = new TenantContextStore();
    expect(store.get()).toBeUndefined();
  });

  it('should isolate contexts between concurrent runs', async () => {
    const store = new TenantContextStore();

    const ctx1: TenantContext = { tenantId: 't1', metadata: {}, resolvedAt: new Date() };
    const ctx2: TenantContext = { tenantId: 't2', metadata: {}, resolvedAt: new Date() };

    const [result1, result2] = await Promise.all([
      new Promise<TenantContext | undefined>((resolve) => {
        store.run(ctx1, () => {
          setTimeout(() => {
            resolve(store.get());
          }, 10);
        });
      }),
      new Promise<TenantContext | undefined>((resolve) => {
        store.run(ctx2, () => {
          setTimeout(() => {
            resolve(store.get());
          }, 5);
        });
      }),
    ]);

    if (!result1) throw new Error('Expected result1');
    expect(result1.tenantId).toBe('t1');
    if (!result2) throw new Error('Expected result2');
    expect(result2.tenantId).toBe('t2');
  });

  it('should propagate through async calls', async () => {
    const store = new TenantContextStore();

    const inner = (): string | undefined => {
      return store.get()?.tenantId;
    };

    const result = await new Promise<string | undefined>((resolve) => {
      store.run(mockContext, () => {
        resolve(inner());
      });
    });

    expect(result).toBe('t1');
  });
});
