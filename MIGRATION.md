# Migration Guide

This guide is for teams moving from a custom multi-tenancy layer to
`multi-tenant-mcp`. Version 1.0.0 is the initial stable release, so
there is no prior version of this package to upgrade from — the
sections below all describe migrating off of ad-hoc implementations.

## From Custom Middleware

If you previously wrapped MCP request handlers with your own
per-request logic, replace it with `createMultiTenantMiddleware` and
resolve tenant identity at the transport boundary via
`TenantContextStore`.

**Before:**
```typescript
server.setRequestHandler("tools/list", async (request) => {
  const tenantId = extractTenant(request);
  // ... custom filtering, rate limiting, cost tracking
});
```

**After:**
```typescript
import {
  createMultiTenantMiddleware,
  JWTTenantResolver,
  TenantContextStore,
  MemoryRateLimitStore,
  DefaultRateLimiter,
  DefaultCostCalculator,
  InMemoryCostTracker,
} from "multi-tenant-mcp";

const store = new TenantContextStore();
const resolver = new JWTTenantResolver({ claim: "tenant_id", secret: "..." });

const middleware = createMultiTenantMiddleware({
  tenantContextStore: store,
  rateLimiter: new DefaultRateLimiter(
    new MemoryRateLimitStore({ requestsPerMinute: 100, tokensPerMinute: 10000 })
  ),
  toolVisibility: { "tenant-a": { type: "allow", items: ["tool-1"] } },
  costCalculator: new DefaultCostCalculator({ perCall: { "tool-1": 0.01 } }),
  costTracker: new InMemoryCostTracker(),
});

middleware.handle(server, "tools/list", async (request) => {
  return { tools: [/* ... */] };
});

// At each incoming connection, resolve the tenant and run the
// dispatch loop inside `store.run(ctx, ...)`.
const context = await resolver.resolve({ headers });
await store.run(context!, () => transport.handle(server));
```

## From Per-Tenant Server Instances

If you were spawning a separate MCP server process per tenant, switch
to a single server instance and isolate tenants at the context layer:

```typescript
import { TenantContextStore } from "multi-tenant-mcp";

const store = new TenantContextStore();

const context = await tenantResolver.resolve({ headers });
await store.run(context!, () => {
  // All request handlers registered via middleware.handle(...) can
  // now read the tenant context through the store.
});
```

## From Ad-Hoc Rate Limiting

Swap counter-based middleware for the purpose-built limiter:

```typescript
// In-memory (single instance)
new DefaultRateLimiter(
  new MemoryRateLimitStore({ requestsPerMinute: 100, tokensPerMinute: 10000 })
);

// Redis (multi-instance / production)
new DefaultRateLimiter(
  new RedisRateLimitStore(redisClient, {
    requestsPerMinute: 100,
    tokensPerMinute: 10000,
  })
);
```

## From File-Based Config

If you loaded tenant configs from JSON files, use
`TenantConfigManager` with schema validation:

```typescript
const manager = new TenantConfigManager(
  new InMemoryConfigStore(),
  new ZodConfigValidator(z.object({ model: z.string() })),
  { model: "gpt-4" } // base config
);

await manager.set("tenant-a", { model: "claude-3" });
```

## Breaking Changes in Future Versions

This section will document breaking changes when they occur. For
1.0.0 there are no prior versions to migrate from.
