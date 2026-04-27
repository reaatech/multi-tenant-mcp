/* eslint-disable @typescript-eslint/no-deprecated */
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { TenantContextStore } from "../tenant-resolver/context-store.js";
import type { TenantResolver } from "../tenant-resolver/types.js";
import type { RateLimiter } from "../rate-limiter/types.js";
import type {
  ToolVisibilityPolicy,
  ResourceVisibilityPolicy,
  PromptVisibilityPolicy,
} from "../tool-visibility/types.js";
import type { CostCalculator, CostTracker, UsageEventEmitter } from "../cost-accounting/types.js";
import type { ArtifactStore } from "../artifact-store/types.js";
import type { TenantConfigStore } from "../config-isolation/types.js";
import type { TenantLogger, MetricsCollector } from "../observability/index.js";

/**
 * Configuration for the multi-tenant middleware composer.
 */
export interface MultiTenantMiddlewareConfig {
  /**
   * AsyncLocalStorage-based tenant context store (required). Resolve
   * the tenant at the transport boundary and call
   * `tenantContextStore.run(ctx, cb)` around the MCP server setup so
   * request handlers inherit the context through async hooks.
   */
  readonly tenantContextStore: TenantContextStore;
  /**
   * Tenant identity resolver used at the transport boundary. The
   * composer itself does not call this — it's carried in the config
   * for convenience so a single resolver instance can be shared
   * between the connection handler and downstream code.
   */
  readonly tenantResolver?: TenantResolver;
  /** Rate limiter (optional) */
  readonly rateLimiter?: RateLimiter;
  /** Tool visibility policies keyed by tenant ID */
  readonly toolVisibility?: Readonly<Record<string, ToolVisibilityPolicy>>;
  /** Resource visibility policies keyed by tenant ID */
  readonly resourceVisibility?: Readonly<Record<string, ResourceVisibilityPolicy>>;
  /** Prompt visibility policies keyed by tenant ID */
  readonly promptVisibility?: Readonly<Record<string, PromptVisibilityPolicy>>;
  /** Cost calculator for usage tracking (optional) */
  readonly costCalculator?: CostCalculator;
  /** Usage event emitter for billing/analytics (optional) */
  readonly usageEmitter?: UsageEventEmitter;
  /** Cost tracker for accumulated costs (optional) */
  readonly costTracker?: CostTracker;
  /**
   * Extract token counts from handler results for per-token pricing.
   * Return `{ inputTokens, outputTokens }` or `undefined` if not applicable.
   */
  readonly tokenExtractor?: (
    result: unknown
  ) => { inputTokens?: number; outputTokens?: number } | undefined;
  /** Artifact store for tenant-scoped storage (optional) */
  readonly artifactStore?: ArtifactStore;
  /** Tenant configuration store (optional) */
  readonly configStore?: TenantConfigStore;
  /** Structured logger for tenant-aware logging (optional) */
  readonly logger?: TenantLogger;
  /** Metrics collector for operational counters (optional) */
  readonly metrics?: MetricsCollector;
}

/**
 * Request handler shape matching the MCP SDK.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RequestHandler<T = any> = (request: T) => T | Promise<T>;

/**
 * Composed multi-tenant middleware.
 */
export interface MultiTenantMiddleware {
  /**
   * Register a request handler on the MCP server through the middleware.
   *
   * @param server - MCP Server instance
   * @param method - MCP method name (e.g., "tools/list", "tools/call")
   * @param handler - User-provided handler
   */
  handle(server: Server, method: string, handler: RequestHandler): void;
}

/**
 * Factory function to create the middleware composer.
 */
export type CreateMultiTenantMiddleware = (
  config: MultiTenantMiddlewareConfig
) => MultiTenantMiddleware;
