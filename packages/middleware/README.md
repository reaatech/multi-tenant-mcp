# @reaatech/multi-tenant-mcp-middleware

[![npm version](https://img.shields.io/npm/v/@reaatech/multi-tenant-mcp-middleware.svg)](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-middleware)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/multi-tenant-mcp/ci.yml?branch=main&label=CI)](https://github.com/reaatech/multi-tenant-mcp/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Compose a full multi-tenant middleware stack for MCP servers. Wraps MCP request handlers with a
pipeline that enforces tenant resolution, rate limiting, tool/resource/prompt visibility, cost
accounting, logging, and metrics in a single call.

## Installation

```bash
npm install @reaatech/multi-tenant-mcp-middleware @modelcontextprotocol/sdk
# or
pnpm add @reaatech/multi-tenant-mcp-middleware @modelcontextprotocol/sdk
```

`@modelcontextprotocol/sdk` is a peer dependency (bring your own version).

## Feature Overview

- **Single API call** — `createMultiTenantMiddleware(config)` returns a middleware object with one
  method: `handle(server, method, handler)`.
- **Composable pipeline** — Every middleware layer (rate limit, visibility, cost accounting, etc.)
  is optional; only `tenantContextStore` is required.
- **MCP method-aware** — The middleware automatically filters `tools/list` / `resources/list` /
  `prompts/list` results by tenant policy, and validates `*/call` / `*/read` / `*/get` access.
- **Non-blocking side-effects** — Usage emissions and cost tracking run after handler completion;
  failures are logged but never fail the request.

## Quick Start

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createMultiTenantMiddleware } from '@reaatech/multi-tenant-mcp-middleware';
import { HeaderTenantResolver, TenantContextStore } from '@reaatech/multi-tenant-mcp-tenant-resolver';
import { DefaultRateLimiter, MemoryRateLimitStore } from '@reaatech/multi-tenant-mcp-rate-limiter';
import { DefaultCostCalculator, InMemoryCostTracker, CallbackUsageEmitter } from '@reaatech/multi-tenant-mcp-cost-accounting';
import { ConsoleTenantLogger, MetricsCollector } from '@reaatech/multi-tenant-mcp-observability';

const store = new TenantContextStore();
const logger = new ConsoleTenantLogger({ level: 'info' });
const metrics = new MetricsCollector();

const middleware = createMultiTenantMiddleware({
  tenantContextStore: store,
  tenantResolver: new HeaderTenantResolver({ header: 'x-tenant-id' }),
  rateLimiter: new DefaultRateLimiter(
    new MemoryRateLimitStore({ requestsPerMinute: 100, tokensPerMinute: 10_000 }),
  ),
  toolVisibility: {
    'acme-corp': { type: 'allow', items: ['echo', 'status'] },
  },
  costCalculator: new DefaultCostCalculator({
    perCall: { echo: 0.01 },
  }),
  costTracker: new InMemoryCostTracker(),
  usageEmitter: new CallbackUsageEmitter(async (event) => {
    await billingPipeline.record(event);
  }),
  logger,
  metrics,
});

const server = new Server({ name: 'my-mcp', version: '1.0.0' }, { capabilities: {} });

// Wire up tools/list — results are filtered by tenant visibility policy
middleware.handle(server, 'tools/list', () => ({
  tools: [
    { name: 'echo', description: 'Echo back input' },
    { name: 'status', description: 'Server status' },
    { name: 'admin', description: 'Admin operations' },
  ],
}));

// Wire up tools/call — tenant identity, rate limits, and visibility are enforced
middleware.handle(server, 'tools/call', (request) => {
  const req = request as { params: { name: string; arguments?: Record<string, unknown> } };
  switch (req.params.name) {
    case 'echo':
      return { content: [{ type: 'text', text: String(req.params.arguments?.message ?? '') }] };
    case 'status':
      return { content: [{ type: 'text', text: 'ok' }] };
    default:
      return { content: [{ type: 'text', text: 'Unknown tool' }] };
  }
});
```

## Request Pipeline

For every MCP request, the middleware enforces:

```
1. Tenant Context Retrieval — read from TenantContextStore (ALS)
2. Rate Limit Check         — verify against configured RateLimiter
3. Visibility Filter        — list: filter results; call/read: validate access
4. Handler Execution        — delegate to user-provided handler
5. Cost Accounting          — record usage event (non-blocking)
```

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `createMultiTenantMiddleware` | Function | Compose the full middleware stack from config |
| `MultiTenantMiddlewareConfig` | Interface | Configuration object — all fields optional except `tenantContextStore` |
| `MultiTenantMiddleware` | Interface | Returned object with `handle(server, method, handler)` |
| `RequestHandler<T>` | Type | `(request: T) => T \| Promise<T>` |

### Configuration Options

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `tenantContextStore` | `TenantContextStore` | **Yes** | ALS-backed store for tenant context propagation |
| `tenantResolver` | `TenantResolver` | No | Resolver called on each request to identify the tenant |
| `rateLimiter` | `RateLimiter` | No | Rate limiting engine (default: no-op) |
| `toolVisibility` | `Record<string, VisibilityPolicy>` | No | Per-tenant tool visibility policies |
| `resourceVisibility` | `Record<string, VisibilityPolicy>` | No | Per-tenant resource visibility policies |
| `promptVisibility` | `Record<string, VisibilityPolicy>` | No | Per-tenant prompt visibility policies |
| `costCalculator` | `CostCalculator` | No | Pricing model for usage-based billing |
| `costTracker` | `CostTracker` | No | In-memory cost accumulator |
| `usageEmitter` | `UsageEventEmitter` | No | Callback for forwarding usage events externally |
| `artifactStore` | `ArtifactStore` | No | Tenant-scoped storage backend |
| `configStore` | `TenantConfigStore` | No | Per-tenant configuration store |
| `logger` | `TenantLogger` | No | Structured logger (default: silent) |
| `metrics` | `MetricsCollector` | No | Metrics collector (default: no-op) |

## Related Packages

- [@reaatech/multi-tenant-mcp-types](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-types)
- [@reaatech/multi-tenant-mcp-tenant-resolver](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-tenant-resolver)
- [@reaatech/multi-tenant-mcp-rate-limiter](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-rate-limiter)
- [@reaatech/multi-tenant-mcp-tool-visibility](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-tool-visibility)
- [@reaatech/multi-tenant-mcp-cost-accounting](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-cost-accounting)
- [@reaatech/multi-tenant-mcp-artifact-store](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-artifact-store)
- [@reaatech/multi-tenant-mcp-config-isolation](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-config-isolation)
- [@reaatech/multi-tenant-mcp-observability](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-observability)

## License

[MIT](https://github.com/reaatech/multi-tenant-mcp/blob/main/LICENSE)
