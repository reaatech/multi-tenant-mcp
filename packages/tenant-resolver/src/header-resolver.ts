import type { TenantContext } from '@reaatech/multi-tenant-mcp-types';
import type { HeaderTenantResolverConfig, ResolveRequest, TenantResolver } from './types.js';

/**
 * Resolves tenant identity from a custom HTTP header.
 */
export class HeaderTenantResolver implements TenantResolver {
  constructor(private readonly config: HeaderTenantResolverConfig) {}

  resolve(request: ResolveRequest): TenantContext | null {
    const raw = request.headers[this.config.header.toLowerCase()];
    const tenantId = Array.isArray(raw) ? raw[0] : raw;

    if (!tenantId || typeof tenantId !== 'string') {
      return null;
    }

    if (this.config.enrich) {
      return this.config.enrich(tenantId);
    }

    return {
      tenantId,
      metadata: {},
      resolvedAt: new Date(),
    };
  }
}
