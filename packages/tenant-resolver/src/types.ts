import type { TenantContext } from '@reaatech/multi-tenant-mcp-types';

/**
 * Input to a tenant resolver. Carries the raw auth context from the
 * MCP transport layer (headers for SSE, env vars for stdio, etc.).
 */
export interface ResolveRequest {
  /** Transport-specific headers (SSE) or empty (stdio) */
  readonly headers: Record<string, string | string[] | undefined>;
  /** Transport-specific query parameters (SSE) or empty (stdio) */
  readonly query?: Record<string, string | string[] | undefined>;
}

/**
 * Strategy interface for extracting tenant identity from incoming requests.
 */
export interface TenantResolver {
  /**
   * Attempt to resolve a tenant from the given request context.
   *
   * @returns Resolved tenant context, or `null` if resolution fails.
   */
  resolve(request: ResolveRequest): TenantContext | null | Promise<TenantContext | null>;
}

/**
 * Configuration for JWT-based tenant resolution.
 */
export interface JWTTenantResolverConfig {
  /** JWT claim containing the tenant identifier (default: `"tenant_id"`) */
  readonly claim: string;
  /** Expected JWT audience (optional validation) */
  readonly audience?: string;
  /** Expected JWT issuer (optional validation) */
  readonly issuer?: string;
  /** Secret or public key for verifying the JWT signature */
  readonly secret: string;
  /**
   * Claim names to copy from the verified JWT onto
   * `TenantContext.metadata`. Anything not listed is dropped so
   * sensitive claims (roles, PII, etc.) don't leak into logs or
   * downstream middleware by default.
   *
   * If omitted, no claims are exposed; the tenant id is always set
   * from the configured `claim`.
   */
  readonly claimsToExpose?: readonly string[];
  /** Optional error handler for debugging authentication failures */
  readonly onError?: (error: Error) => void;
}

/**
 * Configuration for API-key-based tenant resolution.
 */
export interface APIKeyTenantResolverConfig {
  /** Header name carrying the API key (default: `"x-api-key"`) */
  readonly headerName: string;
  /** Lookup function: API key → tenant context (or null) */
  readonly lookup: (apiKey: string) => TenantContext | null | Promise<TenantContext | null>;
}

/**
 * Configuration for header-based tenant resolution.
 */
export interface HeaderTenantResolverConfig {
  /** Header name containing the raw tenant identifier */
  readonly header: string;
  /** Optional validation / enrichment function */
  readonly enrich?: (tenantId: string) => TenantContext | null;
}
