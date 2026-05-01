# @reaatech/multi-tenant-mcp-rate-limiter

[![npm version](https://img.shields.io/npm/v/@reaatech/multi-tenant-mcp-rate-limiter.svg)](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-rate-limiter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/multi-tenant-mcp/ci.yml?branch=main&label=CI)](https://github.com/reaatech/multi-tenant-mcp/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Per-tenant rate limiting with pluggable backends. Ships with in-memory (single-process) and Redis
(distributed) stores.

## Installation

```bash
npm install @reaatech/multi-tenant-mcp-rate-limiter
# or
pnpm add @reaatech/multi-tenant-mcp-rate-limiter
```

For the Redis store, install the optional peer:

```bash
pnpm add redis
```

## Feature Overview

- **Fixed-window counters** — Track requests per minute and tokens per minute independently.
- **LRU-bounded storage** — Both built-in stores use `BoundedMap` internally; caller-controlled
  tenant IDs cannot exhaust memory.
- **Pluggable backends** — Implement `RateLimitStore` for any storage (SQL, DynamoDB, etc.).

## Quick Start

```typescript
import {
  DefaultRateLimiter,
  MemoryRateLimitStore,
} from '@reaatech/multi-tenant-mcp-rate-limiter';

// In-memory (single-process)
const store = new MemoryRateLimitStore({
  requestsPerMinute: 100,
  tokensPerMinute: 10_000,
});

const limiter = new DefaultRateLimiter(store);

const result = await limiter.check('tenant-a', 42);
if (!result.allowed) {
  // throw MiddlewareError(MiddlewareErrorCode.RateLimitExceeded, ...)
}
```

### Redis (distributed)

```typescript
import { createClient } from 'redis';
import { DefaultRateLimiter, RedisRateLimitStore } from '@reaatech/multi-tenant-mcp-rate-limiter';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const store = new RedisRateLimitStore(redis, {
  requestsPerMinute: 200,
  tokensPerMinute: 50_000,
});

const limiter = new DefaultRateLimiter(store);
```

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `RateLimiter` | Interface | Contract: `check(tenantId, tokens?) → RateLimitResult` |
| `RateLimitStore` | Interface | Contract for storage backends |
| `RateLimitConfig` | Interface | Per-tenant quota: `requestsPerMinute`, `tokensPerMinute` |
| `RateLimitResult` | Interface | `allowed`, `remainingRequests`, `remainingTokens`, `resetAt` |
| `DefaultRateLimiter` | Class | Token-bucket engine; delegates counters to a `RateLimitStore` |
| `MemoryRateLimitStore` | Class | In-memory store with LRU eviction |
| `RedisRateLimitStore` | Class | Redis-backed store for horizontal scaling (requires `redis`) |

## Related Packages

- [@reaatech/multi-tenant-mcp-types](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-types)
- [@reaatech/multi-tenant-mcp-middleware](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-middleware)

## License

[MIT](https://github.com/reaatech/multi-tenant-mcp/blob/main/LICENSE)
