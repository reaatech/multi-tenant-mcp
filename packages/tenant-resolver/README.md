# @reaatech/multi-tenant-mcp-tenant-resolver

[![npm version](https://img.shields.io/npm/v/@reaatech/multi-tenant-mcp-tenant-resolver.svg)](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-tenant-resolver)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/multi-tenant-mcp/ci.yml?branch=main&label=CI)](https://github.com/reaatech/multi-tenant-mcp/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Resolve tenant identity from incoming MCP requests via headers, JWTs, or API keys, and propagate
it through `AsyncLocalStorage`.

## Installation

```bash
npm install @reaatech/multi-tenant-mcp-tenant-resolver
# or
pnpm add @reaatech/multi-tenant-mcp-tenant-resolver
```

For JWT support, install the optional `jsonwebtoken` peer:

```bash
pnpm add jsonwebtoken
```

## Feature Overview

- **Plug-&-play resolvers** — Header-based, JWT, and API-key resolvers ship out of the box;
  implement `TenantResolver` for custom auth flows.
- **ALS propagation** — `TenantContextStore` wraps `AsyncLocalStorage` so the tenant context is
  available to every downstream handler without explicit parameter threading.
- **Zero-copy metadata** — Resolvers can attach claims (`claimsToExpose`) or lookup results
  directly to `TenantContext.metadata`.

## Quick Start

```typescript
import {
  HeaderTenantResolver,
  JWTTenantResolver,
  APIKeyTenantResolver,
  TenantContextStore,
} from '@reaatech/multi-tenant-mcp-tenant-resolver';

// Simple header-based (development / internal use)
const headerResolver = new HeaderTenantResolver({ header: 'x-tenant-id' });

// JWT-based (production)
const jwtResolver = new JWTTenantResolver({
  claim: 'tenant_id',
  secret: process.env.JWT_SECRET!,
  claimsToExpose: ['email', 'role'],
});

// API-key based (database-backed)
const apiKeyResolver = new APIKeyTenantResolver({
  headerName: 'x-api-key',
  lookup: async (key) => {
    const tenant = await db.findByApiKey(key);
    if (!tenant) return null;
    return { tenantId: tenant.id, metadata: { plan: tenant.plan }, resolvedAt: new Date() };
  },
});

const store = new TenantContextStore();
const ctx = jwtResolver.resolve({ headers: { authorization: 'Bearer <token>' } });
if (ctx) {
  store.run(ctx, () => {
    // All downstream code sees the resolved tenant via store.get()
  });
}
```

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `TenantResolver` | Interface | Contract for resolving tenant identity from a request |
| `HeaderTenantResolver` | Class | Extract tenant ID from a named request header |
| `JWTTenantResolver` | Class | Verify and decode a JWT bearer token (requires `jsonwebtoken`) |
| `APIKeyTenantResolver` | Class | Look up a tenant by API key via a user-supplied async function |
| `TenantContextStore` | Class | `AsyncLocalStorage`-backed store for tenant context propagation |

## Related Packages

- [@reaatech/multi-tenant-mcp-types](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-types)
- [@reaatech/multi-tenant-mcp-middleware](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-middleware)

## License

[MIT](https://github.com/reaatech/multi-tenant-mcp/blob/main/LICENSE)
