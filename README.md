# multi-tenant-mcp

[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/multi-tenant-mcp/ci.yml?branch=main&label=CI)](https://github.com/reaatech/multi-tenant-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> Primitives for serving multiple tenants from a single MCP server — tenant resolution, rate
> limiting, tool visibility, cost accounting, artifact isolation, and observability composed as
> **composable middleware**.

## Overview

`multi-tenant-mcp` is a pnpm monorepo of composable TypeScript packages that layer multi-tenancy
onto the [Model Context Protocol](https://modelcontextprotocol.io). Each package handles one
concern (authentication, rate limiting, visibility, cost tracking, etc.). Compose them together
with a single middleware function and drop them around any MCP server's request handlers.

## Features

- **Tenant resolution** — Extract tenant identity from JWTs, API keys, or custom HTTP headers.
- **Per-tenant rate limiting** — Request and token quotas with in-memory or Redis backends.
- **Tool / resource / prompt visibility** — Allow-list, deny-list, and dynamic policy evaluation.
- **Cost accounting** — Per-call, per-token, and tiered pricing with pluggable usage emitters.
- **Tenant-isolated artifact storage** — Filesystem and S3 backends with automatic namespace isolation.
- **Config isolation** — Per-tenant configuration with Zod validation and base-config inheritance.
- **Built-in observability** — Structured console logger and LRU-bounded metrics with automatic tenant context.

## Installation

### Using the packages

Install individual packages as needed:

```bash
pnpm add @reaatech/multi-tenant-mcp-middleware @reaatech/multi-tenant-mcp-tenant-resolver
pnpm add @reaatech/multi-tenant-mcp-rate-limiter
pnpm add @reaatech/multi-tenant-mcp-cost-accounting
# ... and so on
```

### Contributing

```bash
git clone https://github.com/reaatech/multi-tenant-mcp.git
cd multi-tenant-mcp
pnpm install
pnpm build
pnpm test
pnpm lint
```

## Quick Start

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createMultiTenantMiddleware } from '@reaatech/multi-tenant-mcp-middleware';
import { HeaderTenantResolver, TenantContextStore } from '@reaatech/multi-tenant-mcp-tenant-resolver';
import { DefaultRateLimiter, MemoryRateLimitStore } from '@reaatech/multi-tenant-mcp-rate-limiter';

const store = new TenantContextStore();

const middleware = createMultiTenantMiddleware({
  tenantContextStore: store,
  tenantResolver: new HeaderTenantResolver({ header: 'x-tenant-id' }),
  rateLimiter: new DefaultRateLimiter(
    new MemoryRateLimitStore({ requestsPerMinute: 100, tokensPerMinute: 10_000 }),
  ),
  toolVisibility: {
    'acme-corp': { type: 'allow', items: ['echo', 'status'] },
  },
});

const server = new Server({ name: 'my-mcp', version: '1.0.0' }, { capabilities: {} });

middleware.handle(server, 'tools/list', () => ({
  tools: [
    { name: 'echo', description: 'Echo back input' },
    { name: 'status', description: 'Server status' },
  ],
}));

middleware.handle(server, 'tools/call', (request) => {
  return { content: [{ type: 'text', text: 'ok' }] };
});
```

## Packages

| Package | Description |
|---------|-------------|
| [@reaatech/multi-tenant-mcp-types](./packages/types) | Shared types, error codes, and LRU-bounded map |
| [@reaatech/multi-tenant-mcp-tenant-resolver](./packages/tenant-resolver) | Resolve tenant identity from headers, JWTs, or API keys |
| [@reaatech/multi-tenant-mcp-rate-limiter](./packages/rate-limiter) | Per-tenant rate limiting with in-memory and Redis stores |
| [@reaatech/multi-tenant-mcp-tool-visibility](./packages/tool-visibility) | Allow/deny/dynamic visibility policies for tools, resources, and prompts |
| [@reaatech/multi-tenant-mcp-cost-accounting](./packages/cost-accounting) | Per-call, per-token, and tiered cost tracking |
| [@reaatech/multi-tenant-mcp-artifact-store](./packages/artifact-store) | Tenant-isolated artifact storage (filesystem + S3) |
| [@reaatech/multi-tenant-mcp-config-isolation](./packages/config-isolation) | Per-tenant config with Zod validation and migration support |
| [@reaatech/multi-tenant-mcp-observability](./packages/observability) | Structured logging and per-tenant metrics |
| [@reaatech/multi-tenant-mcp-middleware](./packages/middleware) | Compose all layers into a single middleware handler |

## Documentation

- [**ARCHITECTURE**](./ARCHITECTURE.md) — System design, module details, data flows, and deployment patterns.
- [**CONTRIBUTING**](./CONTRIBUTING.md) — Development setup, coding standards, and PR process.
- [**AGENTS**](./AGENTS.md) — AI agent skills and automation for this repo.
- [**API Reference**](./docs/api) — Generated TypeDoc reference (requires `pnpm docs:generate`).

## License

[MIT](LICENSE)
