# multi-tenant-mcp

> Primitives for serving multiple tenants from a single MCP server

## Overview

`multi-tenant-mcp` is a middleware package that provides enterprise-grade multi-tenancy capabilities for MCP (Model Context Protocol) servers. Extract the multi-tenancy layer from your MCP server and compose it with this battle-tested solution.

Born from production experience running metered billing with per-token and per-call pricing across tenants at REAA, this package solves the problems every MCP server encounters when moving from "my demo" to "shared infrastructure."

## Features

- **Tenant Identification** — Extract tenant from JWT claims, API keys, or custom headers
- **Per-Tenant Rate Limits** — Configurable limits (requests/minute, tokens/minute) with Redis or in-memory backends
- **Per-Tenant Tool Visibility** — Control which tools each tenant can access (allow-list, deny-list, dynamic)
- **Per-Tenant Resource & Prompt Visibility** — Same visibility controls for MCP resources and prompts
- **Per-Tenant Cost Accounting** — Track usage for billing with per-token, per-call, and tiered pricing
- **Tenant-Scoped Artifact Storage** — Isolated storage namespaces (filesystem, S3)
- **Tenant Config Isolation** — Ensure configurations never leak across tenant boundaries
- **Structured Logging & Metrics** — Tenant-aware observability built-in

## Installation

```bash
npm install multi-tenant-mcp
# or
pnpm add multi-tenant-mcp
# or
yarn add multi-tenant-mcp
```

### Peer Dependencies

- `@modelcontextprotocol/sdk` ^1.0.0

### Optional Dependencies

- `redis` — For distributed rate limiting
- `@aws-sdk/client-s3` — For S3-backed artifact storage

## Quick Start

Tenant identity is resolved at the transport boundary and propagated
through the request lifecycle with `AsyncLocalStorage`. Wire a
`TenantContextStore` into the middleware, then call `store.run(ctx, ...)`
around each incoming connection.

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
  // Explicitly whitelist claims you want on TenantContext.metadata.
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
// `store.run(ctx, ...)` so middleware can read the context via ALS.
async function onConnection(headers: Record<string, string>, dispatch: () => Promise<void>) {
  const context = await resolver.resolve({ headers });
  if (!context) throw new Error("Unauthorized");
  await store.run(context, dispatch);
}
```

See [`examples/sse.ts`](./examples/sse.ts) for a complete transport
example.

## Core Modules

### Tenant Resolver

Extract tenant identity from various auth contexts:

```typescript
// JWT-based
new JWTTenantResolver({ claim: "tenant_id", secret: "..." })

// API key-based
new APIKeyTenantResolver({
  headerName: "x-api-key",
  lookup: async (key) => {
    // Query your database
    return { tenantId: "t1", metadata: {}, resolvedAt: new Date() };
  },
})

// Header-based
new HeaderTenantResolver({ header: "x-tenant-id" })
```

### Rate Limiter

Enforce per-tenant rate limits:

```typescript
// In-memory (development)
new DefaultRateLimiter(
  new MemoryRateLimitStore({ requestsPerMinute: 100, tokensPerMinute: 10000 })
)

// Redis-backed (production)
new DefaultRateLimiter(
  new RedisRateLimitStore(redisClient, { requestsPerMinute: 100, tokensPerMinute: 10000 })
)
```

### Visibility Engine

Control tool, resource, and prompt access per tenant:

```typescript
// Allow-list: tenant sees only specified items
{ type: "allow", items: ["tool-1", "tool-2"] }

// Deny-list: tenant sees all except specified items
{ type: "deny", items: ["admin-tool"] }

// Dynamic: runtime evaluation
{
  type: "dynamic",
  evaluator: (itemName, tenantId) => itemName.startsWith(`${tenantId}:`),
}
```

### Cost Accounting

Track usage for billing:

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
```

### Artifact Store

Tenant-scoped storage:

```typescript
// Filesystem (development)
new FileSystemArtifactStore("./artifacts", { maxBytes: 1_000_000, maxCount: 100 })

// S3 (production)
new S3ArtifactStore(s3Client, "my-bucket", "artifacts")
```

### Config Isolation

Tenant-specific configuration with validation and inheritance:

```typescript
const manager = new TenantConfigManager(
  new InMemoryConfigStore(),
  new ZodConfigValidator(z.object({ theme: z.string() })),
  { theme: "light" } // base config
);

await manager.set("tenant-a", { theme: "dark" });
const config = await manager.get("tenant-a"); // { theme: "dark" }
```

## Examples

See the [`examples/`](./examples) directory for complete working examples:

- [`examples/stdio.ts`](./examples/stdio.ts) — stdio transport with env-based tenant resolution
- [`examples/sse.ts`](./examples/sse.ts) — SSE transport with JWT-based tenant resolution

## Documentation

- [API Documentation](./docs/api) — Generated TypeDoc reference
- [Development Plan](./DEV_PLAN.md) — Phased implementation roadmap
- [Architecture](./ARCHITECTURE.md) — System design and module details
- [Contributing Guide](./CONTRIBUTING.md) — How to contribute

## Requirements

- Node.js 18+
- TypeScript 5+
- MCP SDK 1.0+

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Test
pnpm test

# Test with coverage
pnpm test:coverage

# Lint
pnpm lint

# Format
pnpm format

# Generate API docs
pnpm docs:generate
```

## License

MIT — see [LICENSE](./LICENSE) for details.

## Support

- **Issues** — [GitHub Issues](https://github.com/reaatech/multi-tenant-mcp/issues)
- **Discussions** — [GitHub Discussions](https://github.com/reaatech/multi-tenant-mcp/discussions)
- **Security** — See [SECURITY.md](./SECURITY.md) for our vulnerability disclosure policy

## Acknowledgments

Built with lessons learned from production multi-tenant MCP deployments at REAA.
