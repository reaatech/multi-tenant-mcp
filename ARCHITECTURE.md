# Architecture: multi-tenant-mcp

## System Overview

`multi-tenant-mcp` is designed as a composable middleware package that integrates with any MCP server implementation. It follows a layered architecture where each multi-tenancy concern is handled by a separate, independently testable module.

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP Server                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           multi-tenant-mcp Middleware Layer           │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐  │  │
│  │  │   Tenant    │ │    Rate     │ │      Tool       │  │  │
│  │  │  Resolver   │ │   Limiter   │ │   Visibility    │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────┘  │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐  │  │
│  │  │     Cost    │ │   Artifact  │ │     Config      │  │  │
│  │  │  Accounting │ │    Store    │ │   Isolation     │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                              │
│                              ▼                              │
│                    MCP Protocol Handler                     │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │    Redis    │ │   S3/Blob   │ │    Database/Storage     ││
│  │  (optional) │ │   Storage   │ │    (tenant configs)     ││
│  └─────────────┘ └─────────────┘ └─────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Core Modules

### 1. Tenant Resolver

**Purpose:** Extract and validate tenant identity from incoming requests.

**Interfaces:**
- `TenantResolver` — Strategy interface for tenant extraction
- `TenantContext` — Represents the resolved tenant with metadata

**Implementations:**
- `JWTTenantResolver` — Extracts tenant from JWT claims (e.g., `tenant_id`, `org_id`)
- `APIKeyTenantResolver` — Maps API keys to tenants
- `HeaderTenantResolver` — Extracts tenant from custom headers

**Flow:**
```
Request → Auth Context → Tenant Resolver → TenantContext → Middleware Chain
```

### 2. Rate Limiter

**Purpose:** Enforce per-tenant rate limits to prevent resource abuse.

**Interfaces:**
- `RateLimitStore` — Storage backend for rate limit counters
- `RateLimiter` — Core rate limiting engine

**Implementations:**
- `MemoryRateLimitStore` — In-memory storage (development/testing)
- `RedisRateLimitStore` — Redis-backed storage (production, distributed)

**Algorithm:**
- Fixed-window counter, one window per minute. Simple and
  memory-efficient; suitable for typical per-tenant quotas.

**Configuration:**
```typescript
interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
}
```

### 3. Tool Visibility Engine

**Purpose:** Control which MCP tools each tenant can access.

**Interfaces:**
- `ToolVisibilityPolicy` — Defines tool access rules
- `ToolFilter` — Applies visibility rules to tool lists

**Policy Types:**
- **Allow-list** — Tenant sees only explicitly listed tools
- **Deny-list** — Tenant sees all tools except explicitly denied ones
- **Dynamic** — Tool visibility evaluated at runtime based on tenant state

**Example:**
```typescript
// Tenant A: sees tools 1-5
// Tenant B: sees tools 3-8
const policies: Record<string, ToolVisibilityPolicy> = {
  "tenant-a": { type: "allow", tools: ["tool-1", "tool-2", "tool-3", "tool-4", "tool-5"] },
  "tenant-b": { type: "allow", tools: ["tool-3", "tool-4", "tool-5", "tool-6", "tool-7", "tool-8"] }
};
```

### 3b. Resource & Prompt Visibility

MCP servers also expose `resources`, `resourceTemplates`, and `prompts`. These must be tenant-scoped for parity:

- **`resources/list`** and **`resources/read`** — filtered by `ResourceVisibilityPolicy`
- **`prompts/list`** and **`prompts/get`** — filtered by `PromptVisibilityPolicy`

The same allow-list / deny-list / dynamic patterns apply. Resource URIs and prompt names are namespaced per tenant where applicable.

### 4. Cost Accounting

**Purpose:** Track tenant usage for billing and analytics.

**Interfaces:**
- `CostAccount` — Tracks costs for a tenant
- `UsageEvent` — Represents a billable event
- `PricingModel` — Defines pricing rules

**Pricing Models:**
- **Per-call** — Fixed cost per tool invocation
- **Per-token** — Cost based on input/output tokens
- **Tiered** — Volume-based pricing with discounts

**Event Flow:**
```
Tool Call → Usage Event → Cost Calculator → Cost Account → Storage/Export
```

**Example Pricing:**
```typescript
const pricing: PricingModel = {
  toolCalls: { "tool-premium": 0.01, "tool-standard": 0.001 },
  tokens: { input: 0.0005, output: 0.001 },
  tiers: [
    { upTo: 10000, discount: 0 },
    { upTo: 100000, discount: 0.1 },
    { upTo: Infinity, discount: 0.2 }
  ]
};
```

### 5. Artifact Store

**Purpose:** Provide tenant-scoped storage for files and artifacts.

**Interfaces:**
- `ArtifactStore` — Storage backend interface
- `Artifact` — Represents a stored artifact with metadata

**Implementations:**
- `FileSystemArtifactStore` — Local filesystem (development)
- `S3ArtifactStore` — AWS S3 (production)
- `DatabaseArtifactStore` — Database-backed (optional)

**Isolation Strategy:**
- Namespace prefixing: `artifacts/{tenant-id}/{artifact-id}`
- Access control enforced at middleware layer

### 6. Config Isolation

**Purpose:** Ensure tenant configurations are isolated and validated.

**Interfaces:**
- `TenantConfigStore` — Storage for tenant configurations
- `ConfigValidator` — Validates config against schema

**Isolation Guarantees:**
- Configurations loaded per-request with tenant context
- No shared mutable state between tenants
- Validation prevents invalid configurations

## MCP Protocol Integration

The `@modelcontextprotocol/sdk` does not provide an Express-style `.use()` middleware pattern. Instead, `multi-tenant-mcp` integrates by **wrapping the `Server` request handlers** via a thin interceptor layer:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const server = new Server({ name: "my-server", version: "1.0.0" });
const store = new TenantContextStore();

const mt = createMultiTenantMiddleware({
  tenantContextStore: store,
  rateLimiter: new DefaultRateLimiter(new RedisRateLimitStore(redis, { /* ... */ })),
  toolVisibility: policies,
  costCalculator: new DefaultCostCalculator(pricing),
  costTracker: new InMemoryCostTracker(),
  artifactStore: new S3ArtifactStore(s3, bucket),
});

// All handlers are registered through the middleware wrapper
mt.handle(server, "tools/list", listToolsHandler);
mt.handle(server, "tools/call", callToolHandler);
mt.handle(server, "resources/list", listResourcesHandler);
mt.handle(server, "resources/read", readResourceHandler);
mt.handle(server, "prompts/list", listPromptsHandler);
mt.handle(server, "prompts/get", getPromptHandler);
```

Under the hood, the wrapper:
1. Intercepts every incoming request
2. Reads the connection-scoped tenant context from
   `TenantContextStore` (populated at the transport boundary)
3. Enforces rate limits
4. Filters visible tools/resources/prompts for `list` operations
5. Validates tool/resource/prompt access for `call/read/get` operations
6. Records usage events for cost accounting
7. Forwards to the user-provided handler

## Middleware Composition

The middleware is designed to be composed into any MCP server by wrapping request handlers as shown above. Each primitive can be used independently or combined:

```typescript
// Use only tenant resolution + rate limiting
const minimal = createMultiTenantMiddleware({
  tenantContextStore: store,
  rateLimiter: new DefaultRateLimiter(
    new MemoryRateLimitStore({ requestsPerMinute: 100, tokensPerMinute: 10000 })
  ),
});

// Use full stack
const full = createMultiTenantMiddleware({ /* all options */ });
```

## Connection & Request Lifecycle

### Connection Lifecycle (SSE Transport)

MCP over SSE maintains long-lived connections. Tenant identity is resolved once at connection time (during the `initialize` handshake) and cached for the duration of the connection:

```
Client connects → initialize request → Tenant Resolution → TenantContext cached
                                                       ↓
                              All subsequent requests reuse cached context
```

For stdio transport, tenant context is resolved per-session (one session per process lifetime).

### Request Lifecycle

For each request on an established connection:

1. **Request Received** — MCP server receives incoming request
2. **Tenant Context Retrieval** — Fetch cached tenant context (resolved at connection time)
3. **Rate Limit Check** — Verify tenant hasn't exceeded limits
4. **Visibility Filter** — Filter available tools/resources/prompts for tenant (list operations) or validate access (call/read/get operations)
5. **Config Load** — Load tenant-specific configuration
6. **Handler Execution** — Execute requested operation
7. **Cost Accounting** — Record usage event asynchronously (non-blocking)
8. **Response** — Return result

### Rate Limit & Cost Scope

- **Rate limits** are per-request (incremented on each tool call / resource read / prompt get)
- **Cost accounting** is per-call (recorded after handler completion)
- **Tenant identity** is connection-scoped (resolved once, cached)

## Data Flow

### Tenant Identification
```
HTTP Request
    ↓
Extract Auth Header (JWT/API Key)
    ↓
Validate & Decode
    ↓
Extract Tenant ID from Claims
    ↓
Load Tenant Metadata
    ↓
Create TenantContext
```

### Rate Limiting
```
Tool Call Request
    ↓
Get Tenant ID from Context
    ↓
Check Rate Limit Store
    ↓
If Exceeded → Return JSON-RPC error (-32002)
If OK → Increment Counter → Proceed
```

### Cost Tracking
```
Tool Execution Complete
    ↓
Create Usage Event (tenant, tool, tokens, timestamp)
    ↓
Calculate Cost (pricing model × usage)
    ↓
Update Cost Account
    ↓
Emit Event (for billing/analytics)
```

## Security Considerations

### Tenant Isolation
- **Auth Boundary** — Tenant resolved from verified auth context
- **Data Boundary** — All data access scoped to tenant ID
- **Config Boundary** — Configurations loaded per-tenant
- **Storage Boundary** — Artifact paths namespaced by tenant

### Attack Mitigation
- **Tenant Hijacking** — Validate tenant ID against auth context
- **Rate Limit Bypass** — Use distributed rate limiting (Redis)
- **Tool Access Escalation** — Enforce visibility at middleware layer
- **Cost Manipulation** — Server-side cost calculation only

## Performance Considerations

### Latency
- Tenant resolution: <1ms (in-memory cache)
- Rate limit check: <2ms (Redis)
- Tool filtering: <1ms (in-memory)
- Total overhead: <5ms per request

### Scalability
- **Stateless Design** — Middleware state stored externally (Redis, DB)
- **Horizontal Scaling** — Any number of MCP server instances
- **Distributed Rate Limiting** — Redis cluster support
- **Connection Pooling** — Reuse database/storage connections

## Streaming & Async Events

MCP supports streaming responses for long-running operations. The middleware handles this as follows:

- **Rate limiting** is checked once at request entry, not on individual streamed chunks
- **Cost accounting** emits `UsageEvent` asynchronously after the stream completes so it never blocks the response path
- **Tenant context** remains stable for the duration of the stream (no mid-stream re-resolution)
- **Visibility checks** happen before stream initiation, not per-chunk

## Error Handling

MCP uses JSON-RPC 2.0 error responses, not HTTP status codes. The middleware maps failures to custom JSON-RPC error codes in the `-32000` to `-32099` range (server error reserved space):

### JSON-RPC Error Mapping

| Failure | JSON-RPC Code | Message | Meaning |
|---|---|---|---|
| Tenant resolution failure | `-32001` | `Unauthorized: tenant could not be resolved` | Invalid or missing auth |
| Rate limit exceeded | `-32002` | `Too Many Requests: rate limit exceeded` | Quota exhausted |
| Tool not visible | `-32003` | `Forbidden: tool not accessible to tenant` | Access denied |
| Resource not visible | `-32004` | `Forbidden: resource not accessible to tenant` | Access denied |
| Prompt not visible | `-32005` | `Forbidden: prompt not accessible to tenant` | Access denied |
| Storage error | `-32603` | `Internal Error: storage operation failed` | Backend failure |
| Config load failure | `-32603` | `Internal Error: configuration unavailable` | Backend failure |

### Recovery Strategies
- Graceful degradation when optional services unavailable
- Fallback to default rate limits if Redis unavailable
- Circuit breaker pattern for external service calls
- Cost accounting failures are logged but never fail the request

## Extensibility

### Plugin Architecture
The system is designed for extension:

- **Custom Tenant Resolvers** — Implement `TenantResolver` interface
- **Custom Rate Limit Stores** — Implement `RateLimitStore` interface
- **Custom Artifact Stores** — Implement `ArtifactStore` interface
- **Custom Pricing Models** — Implement `PricingModel` interface

### Event System
Emit events for external processing:
- `tenant.resolved` — Tenant identified
- `rate.limit.exceeded` — Rate limit hit
- `tool.called` — Tool invocation
- `cost.updated` — Cost account changed
- `artifact.stored` — Artifact saved

## Configuration

### Environment Variables
```
MTM_REDIS_URL=redis://localhost:6379
MTM_S3_BUCKET=tenant-artifacts
MTM_DB_CONNECTION=postgresql://...
MTM_DEFAULT_RATE_LIMIT=100
MTM_JWT_AUDIENCE=api.example.com
```

### Programmatic Configuration
```typescript
const store = new TenantContextStore();

const middleware = createMultiTenantMiddleware({
  tenantContextStore: store,
  rateLimiter: new DefaultRateLimiter(
    new RedisRateLimitStore(redis, { requestsPerMinute: 100, tokensPerMinute: 10000 })
  ),
  toolVisibility: policies,
  costCalculator: new DefaultCostCalculator(pricing),
  costTracker: new InMemoryCostTracker(),
  artifactStore: new S3ArtifactStore(s3Client, "tenant-artifacts"),
});
```

## Monitoring & Observability

### Metrics
- Requests per tenant
- Rate limit hits per tenant
- Tool usage distribution
- Cost accumulation
- Storage usage per tenant

### Logging
- Structured logs with tenant context
- Request tracing with tenant ID
- Error logging with full context

### Health Checks
- Redis connectivity
- Storage backend health
- Database connectivity
- Rate limiter status

## Deployment Patterns

### Single Region
```
Load Balancer → MCP Server Instances (with middleware) → Redis + S3 + DB
```

### Multi-Region
```
Regional Load Balancers → Regional MCP Servers → Regional Redis + Global S3 + Global DB
```

### Serverless
```
API Gateway → Lambda Functions (with middleware) → Redis + S3 + DB
```

## Testing Strategy

### Unit Tests
- Each module tested in isolation
- Mock external dependencies
- >90% code coverage target

### Integration Tests
- Middleware composition tests
- End-to-end request flow tests
- Multi-tenant isolation tests

### Performance Tests
- Rate limiting under load
- Cost calculation accuracy
- Storage operation latency

### Security Tests
- Tenant isolation verification
- Auth bypass attempts
- Rate limit bypass attempts
