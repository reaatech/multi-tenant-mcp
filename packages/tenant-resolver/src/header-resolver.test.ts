import { describe, expect, it } from 'vitest';
import { HeaderTenantResolver } from './header-resolver.js';

describe('HeaderTenantResolver', () => {
  it('should resolve tenant from header', () => {
    const resolver = new HeaderTenantResolver({ header: 'x-tenant-id' });
    const result = resolver.resolve({ headers: { 'x-tenant-id': 'tenant-a' } });

    if (!result) throw new Error('Expected result');
    expect(result.tenantId).toBe('tenant-a');
    expect(result.metadata).toEqual({});
  });

  it('should return null when header is missing', () => {
    const resolver = new HeaderTenantResolver({ header: 'x-tenant-id' });
    const result = resolver.resolve({ headers: {} });

    expect(result).toBeNull();
  });

  it('should use enrich function when provided', () => {
    const resolver = new HeaderTenantResolver({
      header: 'x-tenant-id',
      enrich: (id) => ({
        tenantId: id,
        metadata: { plan: 'pro' },
        resolvedAt: new Date('2024-01-01'),
      }),
    });

    const result = resolver.resolve({ headers: { 'x-tenant-id': 'tenant-b' } });
    if (!result) throw new Error('Expected result');
    expect(result.metadata).toEqual({ plan: 'pro' });
  });

  it('should be case-insensitive for header lookup', () => {
    const resolver = new HeaderTenantResolver({ header: 'X-Tenant-ID' });
    const result = resolver.resolve({ headers: { 'x-tenant-id': 'tenant-c' } });

    if (!result) throw new Error('Expected result');
    expect(result.tenantId).toBe('tenant-c');
  });
});
