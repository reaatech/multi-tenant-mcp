import type { TenantContext } from '@reaatech/multi-tenant-mcp-types';
import { describe, expect, it } from 'vitest';
import { APIKeyTenantResolver } from './api-key-resolver.js';

describe('APIKeyTenantResolver', () => {
  it('should resolve tenant via lookup function', async () => {
    const lookup = async (key: string): Promise<TenantContext | null> => {
      if (key === 'secret-123') {
        return { tenantId: 'tenant-a', metadata: { plan: 'pro' }, resolvedAt: new Date() };
      }
      return null;
    };

    const resolver = new APIKeyTenantResolver({ headerName: 'x-api-key', lookup });
    const result = await resolver.resolve({
      headers: { 'x-api-key': 'secret-123' },
    });

    if (!result) throw new Error('Expected result');
    expect(result.tenantId).toBe('tenant-a');
  });

  it('should return null when header is missing', async () => {
    const resolver = new APIKeyTenantResolver({
      headerName: 'x-api-key',
      lookup: async () => null,
    });

    const result = await resolver.resolve({ headers: {} });
    expect(result).toBeNull();
  });

  it('should return null when lookup returns null', async () => {
    const resolver = new APIKeyTenantResolver({
      headerName: 'x-api-key',
      lookup: async () => null,
    });

    const result = await resolver.resolve({
      headers: { 'x-api-key': 'unknown-key' },
    });
    expect(result).toBeNull();
  });

  it('should be case-insensitive for header name', async () => {
    const lookup = async (key: string): Promise<TenantContext | null> => {
      return key === 'k1' ? { tenantId: 't1', metadata: {}, resolvedAt: new Date() } : null;
    };

    const resolver = new APIKeyTenantResolver({ headerName: 'X-API-Key', lookup });
    const result = await resolver.resolve({
      headers: { 'x-api-key': 'k1' },
    });

    if (!result) throw new Error('Expected result');
    expect(result.tenantId).toBe('t1');
  });
});
