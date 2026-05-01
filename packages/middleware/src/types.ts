import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { ArtifactStore } from '@reaatech/multi-tenant-mcp-artifact-store';
import type { TenantConfigStore } from '@reaatech/multi-tenant-mcp-config-isolation';
import type {
  CostCalculator,
  CostTracker,
  UsageEventEmitter,
} from '@reaatech/multi-tenant-mcp-cost-accounting';
import type { MetricsCollector, TenantLogger } from '@reaatech/multi-tenant-mcp-observability';
import type { RateLimiter } from '@reaatech/multi-tenant-mcp-rate-limiter';
import type { TenantContextStore } from '@reaatech/multi-tenant-mcp-tenant-resolver';
import type { TenantResolver } from '@reaatech/multi-tenant-mcp-tenant-resolver';
import type {
  PromptVisibilityPolicy,
  ResourceVisibilityPolicy,
  ToolVisibilityPolicy,
} from '@reaatech/multi-tenant-mcp-tool-visibility';

export interface MultiTenantMiddlewareConfig {
  readonly tenantContextStore: TenantContextStore;
  readonly tenantResolver?: TenantResolver;
  readonly rateLimiter?: RateLimiter;
  readonly toolVisibility?: Readonly<Record<string, ToolVisibilityPolicy>>;
  readonly resourceVisibility?: Readonly<Record<string, ResourceVisibilityPolicy>>;
  readonly promptVisibility?: Readonly<Record<string, PromptVisibilityPolicy>>;
  readonly costCalculator?: CostCalculator;
  readonly usageEmitter?: UsageEventEmitter;
  readonly costTracker?: CostTracker;
  readonly tokenExtractor?: (
    result: unknown,
  ) => { inputTokens?: number; outputTokens?: number } | undefined;
  readonly artifactStore?: ArtifactStore;
  readonly configStore?: TenantConfigStore;
  readonly logger?: TenantLogger;
  readonly metrics?: MetricsCollector;
}

export type RequestHandler = (request: unknown) => unknown | Promise<unknown>;

export interface MultiTenantMiddleware {
  handle(server: Server, method: string, handler: RequestHandler): void;
}

export type CreateMultiTenantMiddleware = (
  config: MultiTenantMiddlewareConfig,
) => MultiTenantMiddleware;
