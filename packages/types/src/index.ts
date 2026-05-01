/**
 * Shared base types used across all multi-tenant-mcp modules.
 */

/**
 * Represents a resolved tenant within the MCP request lifecycle.
 */
export interface TenantContext {
  /** Unique tenant identifier */
  readonly tenantId: string;
  /** Optional metadata attached during resolution (claims, plan tier, etc.) */
  readonly metadata: Record<string, unknown>;
  /** Timestamp when the tenant was resolved */
  readonly resolvedAt: Date;
}

/**
 * JSON-RPC error codes used by the middleware.
 *
 * @see https://www.jsonrpc.org/specification#error_object
 */
export enum MiddlewareErrorCode {
  /** Tenant could not be resolved from auth context */
  Unauthorized = -32001,
  /** Rate limit exceeded */
  RateLimitExceeded = -32002,
  /** Tool not accessible to tenant */
  ToolForbidden = -32003,
  /** Resource not accessible to tenant */
  ResourceForbidden = -32004,
  /** Prompt not accessible to tenant */
  PromptForbidden = -32005,
  /** Internal server error */
  InternalError = -32603,
}

/**
 * Standard error thrown by middleware layers.
 */
export class MiddlewareError extends Error {
  constructor(
    public readonly code: MiddlewareErrorCode,
    message: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'MiddlewareError';
  }
}

export { BoundedMap } from './bounded-map.js';
