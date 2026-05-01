import type { TenantContext } from '@reaatech/multi-tenant-mcp-types';
import { verify } from 'jsonwebtoken';
import type { JWTTenantResolverConfig, ResolveRequest, TenantResolver } from './types.js';

/**
 * Resolves tenant identity from a JWT claim.
 */
export class JWTTenantResolver implements TenantResolver {
  constructor(private readonly config: JWTTenantResolverConfig) {}

  resolve(request: ResolveRequest): TenantContext | null {
    const authHeader = request.headers.authorization;
    const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!headerValue || !headerValue.toLowerCase().startsWith('bearer ')) {
      return null;
    }

    const token = headerValue.slice(7).trim();
    if (!token) {
      return null;
    }

    try {
      const decoded = verify(token, this.config.secret, {
        audience: this.config.audience,
        issuer: this.config.issuer,
      }) as Record<string, unknown>;

      const tenantId = decoded[this.config.claim];
      if (typeof tenantId !== 'string') {
        return null;
      }

      const metadata: Record<string, unknown> = {};
      for (const name of this.config.claimsToExpose ?? []) {
        if (name in decoded) {
          metadata[name] = decoded[name];
        }
      }

      return {
        tenantId,
        metadata,
        resolvedAt: new Date(),
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.config.onError?.(error);
      return null;
    }
  }
}
