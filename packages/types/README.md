# @reaatech/multi-tenant-mcp-types

[![npm version](https://img.shields.io/npm/v/@reaatech/multi-tenant-mcp-types.svg)](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-types)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/multi-tenant-mcp/ci.yml?branch=main&label=CI)](https://github.com/reaatech/multi-tenant-mcp/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Foundation of the `multi-tenant-mcp` ecosystem: shared TypeScript types, error classes, and data
structures consumed by every other package in the monorepo.

## Installation

```bash
npm install @reaatech/multi-tenant-mcp-types
# or
pnpm add @reaatech/multi-tenant-mcp-types
```

## Feature Overview

- **`TenantContext`** — Immutable tenant identity, metadata, and resolution timestamp propagated
  through `AsyncLocalStorage`.
- **`MiddlewareError`** — Typed error class carrying a JSON-RPC 2.0 error code and optional
  diagnostic data.
- **`MiddlewareErrorCode`** — Exhaustive enum of error codes (`-32001`–`-32603`) used by every
  middleware layer.
- **`BoundedMap<K,V>`** — LRU-evicting map with a hard size cap — used internally by
  in-memory stores (rate limiter, cost tracker, metrics) to prevent unbounded growth from
  caller-controlled keys.

## Quick Start

```typescript
import {
  TenantContext,
  MiddlewareError,
  MiddlewareErrorCode,
  BoundedMap,
} from '@reaatech/multi-tenant-mcp-types';

const ctx: TenantContext = {
  tenantId: 'acme-corp',
  metadata: { tier: 'enterprise' },
  resolvedAt: new Date(),
};

throw new MiddlewareError(MiddlewareErrorCode.RateLimitExceeded, 'Too many requests', {
  retryAfter: 30,
});
```

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `TenantContext` | Interface | Resolved tenant identity within the MCP request lifecycle |
| `MiddlewareErrorCode` | Enum | JSON-RPC 2.0 error codes (Unauthorized, RateLimitExceeded, ToolForbidden, ResourceForbidden, PromptForbidden, InternalError) |
| `MiddlewareError` | Class | Typed error with code, message, and optional diagnostic data |
| `BoundedMap<K, V>` | Class | LRU-evicting map; oldest entry dropped when capacity is exceeded |

## Related Packages

- [@reaatech/multi-tenant-mcp-tenant-resolver](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-tenant-resolver)
- [@reaatech/multi-tenant-mcp-rate-limiter](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-rate-limiter)
- [@reaatech/multi-tenant-mcp-middleware](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-middleware)

## License

[MIT](https://github.com/reaatech/multi-tenant-mcp/blob/main/LICENSE)
