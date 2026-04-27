# multi-tenant-mcp

<p align="center">
  <img alt="npm version" src="https://img.shields.io/npm/v/multi-tenant-mcp?style=flat-square&color=blue">
  <img alt="license" src="https://img.shields.io/npm/l/multi-tenant-mcp?style=flat-square">
  <img alt="node" src="https://img.shields.io/node/v/multi-tenant-mcp?style=flat-square">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square">
</p>

> Primitives for serving multiple tenants from a single MCP server

---

## Table of Contents

- [Why multi-tenant-mcp?](#why-multi-tenant-mcp)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Tenant Lifecycle](#tenant-lifecycle)
  - [Request Pipeline](#request-pipeline)
  - [Error Codes](#error-codes)
- [Modules](#modules)
  - [Tenant Resolution](#tenant-resolution)
  - [Rate Limiting](#rate-limiting)
  - [Visibility Engine](#visibility-engine)
  - [Cost Accounting](#cost-accounting)
  - [Artifact Storage](#artifact-storage)
  - [Config Isolation](#config-isolation)
  - [Observability](#observability)
- [Configuration Reference](#configuration-reference)
- [Examples](#examples)
- [Documentation](#documentation)
- [Requirements](#requirements)
- [Development](#development)
- [Support](#support)
- [License](#license)

---

## Why multi-tenant-mcp?

Building an MCP server is straightforward until you need to serve it to more than one customer. Suddenly you face the same hard problems across every deployment:

- **Authentication**: Who is making this request and what tenant do they belong to?
- **Access control**: Which tools, resources, and prompts should this tenant see?
- **Rate limiting**: How do you prevent one tenant from starving others?
- **Billing**: How do you track usage per tenant for metered pricing?
- **Isolation**: Can you guarantee configurations and artifacts never leak across tenant boundaries?

`multi-tenant-mcp` provides these primitives as a composable middleware layer. Drop it around your MCP server's request handlers, wire up tenant resolution at the transport boundary, and you have a battle-tested multi-tenant foundation without rebuilding it from scratch.

**When to use this package:**

| Scenario | Recommendation |
|---|---|
| Single MCP server, single customer | Not needed -- keep it simple |
| Single MCP server, multiple internal teams | Use for access control, rate limiting, and usage tracking |
| Single MCP server, multiple external customers | Full stack: resolvers, visibility, rate limits, cost accounting, artifact isolation |
| Per-tenant server instances (process-per-customer) | Use for config isolation and cost accounting; rate limiting is optional |

---

## Features

| Feature | Description |
|---|---|
| **Tenant Identification** | Extract tenant identity from JWT claims, API keys, or custom HTTP headers |
| **Per-Tenant Rate Limits** | Configurable limits (requests/minute, tokens/minute) with Redis or in-memory backends |
| **Tool Visibility** | Allow-list, deny-list, and dynamic policies to control which tools each tenant can access |
| **Resource & Prompt Visibility** | The same visibility controls applied to MCP resources and prompts |
| **Cost Accounting** | Track usage for metered billing with per-call, per-token, and tiered pricing models |
| **Artifact Storage** | Tenant-scoped storage with namespace isolation (filesystem or S3 backends) |
| **Config Isolation** | Per-tenant configuration with schema validation and base-config inheritance |
| **Built-in Observability** | Structured logging and bounded in-memory metrics with tenant context on every event |

---

## Installation

```bash
npm install multi-tenant-mcp
# or
pnpm add multi-tenant-mcp
# or
yarn add multi-tenant-mcp
```

### Peer Dependencies

| Package | Version | Required |
|---|---|---|
| `@modelcontextprotocol/sdk` | `^1.0.0` | Yes |

### Optional Dependencies

| Package | Version | Purpose |
|---|---|---|
| `jsonwebtoken` | `^9.0.0` | JWT-based tenant resolution |
| `redis` | `^4.7.0` | Distributed rate limiting |
| `@aws-sdk/client-s3` | `^3.700.0` | S3-backed artifact storage |

---

## Quick Start

Tenant identity is resolved at the transport boundary and propagated through the request lifecycle using `AsyncLocalStorage`. Wire a `TenantContextStore` into the middleware, then call `store.run(ctx, ...)` around each incoming connection.

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  createMultiTenantMiddleware,
  JWTTenantResolver,
  TenantContextStore,
  MemoryRateLimitStore,
  DefaultRateLimiter,
  DefaultCostCalculator,
  InMemoryCostTracker,
} from "multi-tenant-mcp";

const server = new Server({ name: "my-server", version: "1.0.0" });
const store = new TenantContextStore();

const resolver = new JWTTenantResolver({
  claim: "tenant_id",
  secret: process.env.JWT_SECRET!,
  claimsToExpose: ["email"],
});

const middleware = createMultiTenantMiddleware({
  tenantContextStore: store,
  rateLimiter: new DefaultRateLimiter(
    new MemoryRateLimitStore({ requestsPerMinute: 100, tokensPerMinute: 10000 })
  ),
  toolVisibility: {
    "tenant-a": { type: "allow", items: ["tool-1", "tool-2"] },
    "tenant-b": { type: "allow", items: ["tool-2", "tool-3"] },
  },
  costCalculator: new DefaultCostCalculator({
    perCall: { "tool-1": 0.01, "tool-2": 0.005 },
  }),
  costTracker: new InMemoryCostTracker(),
});

middleware.handle(server, "tools/list", () => ({
  tools: [
    { name: "tool-1", description: "..." },
    { name: "tool-2", description: "..." },
    { name: "tool-3", description: "..." },
  ],
}));

middleware.handle(server, "tools/call", async (request) => {
  return { content: [{ type: "text", text: "result" }] };
});

// At connection time (e.g. SSE upgrade, WebSocket handshake), resolve
// the tenant and wrap the transport's request-handling loop in
// store.run(ctx, ...) so middleware can read the context via ALS.
async function onConnection(
  headers: Record<string, string>,
  dispatch: () => Promise<void>
) {
  const context = await resolver.resolve({ headers });
  if (!context) throw new Error("Unauthorized");
  await store.run(context, dispatch);
}
```

See [`examples/sse.ts`](./examples/sse.ts) and [`examples/stdio.ts`](./examples/stdio.ts) for complete transport examples.

---

## Core Concepts

### Tenant Lifecycle

```
Client connects  →  Transport handshake  →  Resolver extracts tenant identity
                                                    ↓
                                           TenantContext stored in ALS
                                                    ↓
                                    All subsequent requests on that connection
                                   read tenant context via store.get()
                                                    ↓
                                    Connection closes  →  Context discarded
```

- **SSE transport**: One resolution per connection (at `initialize` handshake).
- **stdio transport**: One resolution per process lifetime.

### Request Pipeline

For every MCP request, the middleware enforces a fixed pipeline:

```
1. Tenant Context Retrieval    →  Read from TenantContextStore (ALS)
                                      ↓
2. Rate Limit Check            →  Verify against configured limiter
                                      ↓
3. Visibility Filter           →  list: filter results by policy
                                  call/read/get: validate access
                                      ↓
4. Handler Execution           →  Delegate to user-provided handler
                                      ↓
5. Cost Accounting             →  Record usage event (non-blocking)
```

Steps 2--3 return JSON-RPC errors when checks fail. Step 5 failures are logged but never fail the request.

### Error Codes

The middleware uses JSON-RPC 2.0 error codes in the `-32000` to `-32099` range:

| Code   | Name               | Condition                                    |
|--------|--------------------|----------------------------------------------|
| `-32001` | `Unauthorized`     | Tenant identity could not be resolved        |
| `-32002` | `Too Many Requests` | Rate limit exceeded for this tenant          |
| `-32003` | `Forbidden`         | Tool not accessible to this tenant           |
| `-32004` | `Forbidden`         | Resource not accessible to this tenant       |
| `-32005` | `Forbidden`         | Prompt not accessible to this tenant         |
| `-32603` | `Internal Error`    | Storage backend or configuration unavailable |

---

## Modules

### Tenant Resolution

Extract tenant identity from various authentication contexts by implementing (or reusing) a resolver:

```typescript
// JWT-based
new JWTTenantResolver({
  claim: "tenant_id",
  secret: process.env.JWT_SECRET!,
  audience: "api.example.com",     // optional
  claimsToExpose: ["email"],       // optional: forwarded to TenantContext.metadata
});

// API key-based
new APIKeyTenantResolver({
  headerName: "x-api-key",
  lookup: async (key) => {
    // Query your database
    return { tenantId: "t1", metadata: {}, resolvedAt: new Date() };
  },
});

// Header-based (development / internal use)
new HeaderTenantResolver({ header: "x-tenant-id" });
```

All resolvers implement the `TenantResolver` interface. You can provide your own for custom auth flows (mTLS, OAuth2 token introspection, etc.).

### Rate Limiting

Enforce per-tenant rate limits using a fixed-window counter:

```typescript
// In-memory (development, single-instance)
new DefaultRateLimiter(
  new MemoryRateLimitStore({ requestsPerMinute: 100, tokensPerMinute: 10000 })
);

// Redis-backed (production, distributed)
new DefaultRateLimiter(
  new RedisRateLimitStore(redisClient, {
    requestsPerMinute: 100,
    tokensPerMinute: 10000,
  })
);
```

The `RateLimitStore` interface lets you plug in any backend. Both built-in stores use LRU-bounded maps to prevent unbounded memory growth from caller-controlled tenant IDs.

### Visibility Engine

Control which tools, resources, and prompts each tenant can access:

```typescript
// Allow-list: tenant sees only specified items
{ type: "allow", items: ["tool-1", "tool-2"] }

// Deny-list: tenant sees all except specified items
{ type: "deny", items: ["admin-tool"] }

// Dynamic: evaluated at runtime
{
  type: "dynamic",
  evaluator: (itemName, tenantId) => itemName.startsWith(`${tenantId}:`),
}
```

Policies are applied identically across tools (`tools/list`, `tools/call`), resources (`resources/list`, `resources/read`), and prompts (`prompts/list`, `prompts/get`).

### Cost Accounting

Track usage for billing with composable pricing models:

```typescript
const calculator = new DefaultCostCalculator({
  perCall: { "tool-premium": 0.05, "tool-standard": 0.005 },
  perToken: { input: 0.001, output: 0.002 },
  tiers: [
    { upTo: 1000, discount: 0 },
    { upTo: 10000, discount: 0.1 },
    { upTo: Infinity, discount: 0.2 },
  ],
});

const emitter = new CallbackUsageEmitter(async (event) => {
  // Forward to your billing pipeline
  await billingService.record(event);
});

const middleware = createMultiTenantMiddleware({
  // ...
  costCalculator: calculator,
  costTracker: new InMemoryCostTracker(),
  usageEmitter: emitter,   // optional: forward events externally
});
```

Usage events are emitted asynchronously after handler completion. Emissions never block the response path, and errors are logged but do not fail the request.

Pricing models are evaluated in this order: per-call cost, per-token cost (if `inputTokens` / `outputTokens` are present on the event), then tiered discount applied to the subtotal.

### Artifact Storage

Tenant-scoped storage with namespace isolation:

```typescript
// Filesystem (development)
new FileSystemArtifactStore("./artifacts", {
  maxBytes: 1_000_000,
  maxCount: 100,
});

// S3 (production)
new S3ArtifactStore(s3Client, "my-bucket", "artifacts");
```

All artifact paths are automatically namespaced as `{tenantId}/{artifactId}`, preventing cross-tenant access. Path traversal is prevented by the `ArtifactLifecycleManager` and `path-safety` utilities.

### Config Isolation

Per-tenant configuration with schema validation and base-config inheritance:

```typescript
import { z } from "zod";

const manager = new TenantConfigManager(
  new InMemoryConfigStore(),
  new ZodConfigValidator(
    z.object({
      theme: z.string(),
      model: z.string().optional(),
    })
  ),
  { theme: "light", model: "gpt-4" }   // base config (shared defaults)
);

await manager.set("tenant-a", { theme: "dark" });
const config = await manager.get("tenant-a");  // { theme: "dark", model: "gpt-4" }
```

Tenant configs inherit from the base config and can override individual fields. The `ConfigMigrationRunner` supports versioned migrations when your config schema evolves.

### Observability

```typescript
const logger = new ConsoleTenantLogger({
  level: "info",
  includeStackTraces: process.env.NODE_ENV !== "production",
});

const metrics = new MetricsCollector();

const middleware = createMultiTenantMiddleware({
  // ...
  logger,
  metrics,
});
```

Every log entry and metric label includes the tenant ID automatically. Metrics use bounded-in-memory counters to prevent unbounded growth.

---

## Configuration Reference

Full `createMultiTenantMiddleware` options:

| Option | Type | Required | Description |
|---|---|---|---|
| `tenantContextStore` | `TenantContextStore` | Yes | ALS-backed store for tenant context propagation |
| `rateLimiter` | `RateLimiter` | No | Rate limiting engine (default: no-op) |
| `toolVisibility` | `Record<string, VisibilityPolicy>` | No | Per-tenant tool visibility policies |
| `resourceVisibility` | `Record<string, VisibilityPolicy>` | No | Per-tenant resource visibility policies |
| `promptVisibility` | `Record<string, VisibilityPolicy>` | No | Per-tenant prompt visibility policies |
| `costCalculator` | `CostCalculator` | No | Pricing model for usage-based billing |
| `costTracker` | `CostTracker` | No | In-memory accumulator for cost accounts |
| `usageEmitter` | `UsageEventEmitter` | No | Callback for forwarding usage events externally |
| `artifactStore` | `ArtifactStore` | No | Tenant-scoped storage backend |
| `logger` | `TenantLogger` | No | Structured logger (default: silent) |
| `metrics` | `MetricsCollector` | No | Metrics collector (default: no-op) |

### Minimum Configuration

Only `tenantContextStore` is required. All other modules are optional and disabled by default:

```typescript
const middleware = createMultiTenantMiddleware({
  tenantContextStore: store,
  // All other modules omitted — no rate limiting, no visibility checks, etc.
});
```

### Full Production Configuration

```typescript
const middleware = createMultiTenantMiddleware({
  tenantContextStore: store,
  rateLimiter: new DefaultRateLimiter(
    new RedisRateLimitStore(redis, { requestsPerMinute: 200, tokensPerMinute: 50000 })
  ),
  toolVisibility: toolPolicies,
  resourceVisibility: resourcePolicies,
  promptVisibility: promptPolicies,
  costCalculator: new DefaultCostCalculator({
    perCall: { "tool-premium": 0.05 },
    perToken: { input: 0.001, output: 0.002 },
    tiers: [
      { upTo: 10000, discount: 0 },
      { upTo: 100000, discount: 0.1 },
      { upTo: Infinity, discount: 0.2 },
    ],
  }),
  costTracker: new InMemoryCostTracker(),
  usageEmitter: new CallbackUsageEmitter(async (event) => {
    await billingPipeline.ingest(event);
  }),
  artifactStore: new S3ArtifactStore(s3Client, "tenant-artifacts", "artifacts"),
  logger: new ConsoleTenantLogger({ level: "info" }),
  metrics: new MetricsCollector(),
});
```

---

## Examples

Complete working examples are in the [`examples/`](./examples) directory:

| Example | Transport | Tenant Resolution | Highlights |
|---|---|---|---|
| [`examples/stdio.ts`](./examples/stdio.ts) | stdio | Environment variable (`MCP_TENANT_ID`) | Minimal setup for local development |
| [`examples/sse.ts`](./examples/sse.ts) | SSE (Express) | JWT from `Authorization` header | Full production-style middleware stack |

---

## Documentation

| Document | Description |
|---|---|
| [API Reference](./docs/api) | Generated TypeDoc reference for all public classes and interfaces |
| [Architecture](./ARCHITECTURE.md) | System design, module details, data flows, deployment patterns |
| [Development Plan](./DEV_PLAN.md) | Phased implementation roadmap and technical decisions |
| [Contributing Guide](./CONTRIBUTING.md) | Development setup, coding standards, PR process |
| [Migration Guide](./MIGRATION.md) | Migrating from custom multi-tenancy implementations |
| [Security Policy](./SECURITY.md) | Vulnerability disclosure, threat model, supported versions |

---

## Requirements

| Requirement | Version |
|---|---|
| Node.js | `>=18.0.0` |
| TypeScript | `>=5.7.0` (optional but recommended) |
| @modelcontextprotocol/sdk | `^1.0.0` |

The package provides both ESM and CJS entry points. TypeScript declarations are included for both module formats.

---

## Development

```bash
pnpm install          # Install dependencies
pnpm build            # Build ESM + CJS + type declarations
pnpm test             # Run unit and integration tests
pnpm test:coverage    # Run tests with coverage (target: >90%)
pnpm lint             # Run ESLint
pnpm format           # Run Prettier
pnpm typecheck        # Validate TypeScript without emitting
pnpm docs:generate    # Generate TypeDoc API reference
pnpm benchmark        # Run performance benchmarks
pnpm validate:package # Build + publint (pre-publish verification)
```

---

## Support

- **Issues**: [GitHub Issues](https://github.com/reaatech/multi-tenant-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/reaatech/multi-tenant-mcp/discussions)
- **Security**: See [SECURITY.md](./SECURITY.md). For vulnerabilities, email `security@reaatech.com`.

---

## License

MIT -- see [LICENSE](./LICENSE) for details.
