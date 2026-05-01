# @reaatech/multi-tenant-mcp-config-isolation

[![npm version](https://img.shields.io/npm/v/@reaatech/multi-tenant-mcp-config-isolation.svg)](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-config-isolation)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/multi-tenant-mcp/ci.yml?branch=main&label=CI)](https://github.com/reaatech/multi-tenant-mcp/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Per-tenant configuration with Zod schema validation, base-config merging, and versioned migration
support.

## Installation

```bash
npm install @reaatech/multi-tenant-mcp-config-isolation
# or
pnpm add @reaatech/multi-tenant-mcp-config-isolation
```

## Feature Overview

- **Schema validation** — Zod-powered: missing or malformed configs are rejected with
  human-readable errors.
- **Base-config inheritance** — Set shared defaults in a base config; tenant configs override
  individual fields.
- **Pluggable storage** — In-memory store ships out of the box; implement `TenantConfigStore` for
  any backend.
- **Versioned migrations** — `ConfigMigrationRunner` runs ordered migrations when your config
  schema evolves.

## Quick Start

```typescript
import { z } from 'zod';
import {
  InMemoryConfigStore,
  ZodConfigValidator,
  TenantConfigManager,
} from '@reaatech/multi-tenant-mcp-config-isolation';

const schema = z.object({
  theme: z.string().default('light'),
  model: z.string().optional(),
  maxTools: z.number().min(1).default(5),
});

const validator = new ZodConfigValidator({ schema });
const store = new InMemoryConfigStore({ defaults: { theme: 'light', maxTools: 5 } });
const manager = new TenantConfigManager({ store, validator });

// Set tenant-specific overrides
await manager.set('tenant-a', { theme: 'dark', maxTools: 20 });

// Get merged config (tenant overrides + base defaults)
const config = await manager.get('tenant-a');
// { theme: 'dark', maxTools: 20 }

// Invalid configs are rejected
await manager.set('tenant-b', { maxTools: -1 }); // throws ValidationError
```

### Config Migrations

```typescript
import { ConfigMigrationRunner } from '@reaatech/multi-tenant-mcp-config-isolation';

const runner = new ConfigMigrationRunner();
runner.register({
  version: 1,
  migrate: async (store) => {
    // Add "model" field to all existing tenant configs
    for (const tenantId of await store.listTenants()) {
      const config = await store.get(tenantId);
      if (config && !config.model) {
        await store.set(tenantId, { ...config, model: 'gpt-4-turbo' });
      }
    }
  },
});

await runner.run(store);
```

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `TenantConfig` | Type | `Record<string, unknown>` |
| `ConfigValidator` | Interface | `validate(config) → TenantConfig` |
| `TenantConfigStore` | Interface | `get`, `set`, `delete` per tenant |
| `InMemoryConfigStore` | Class | In-memory store with base defaults |
| `ZodConfigValidator` | Class | Validate tenant configs against a Zod schema |
| `TenantConfigManager` | Class | High-level facade: get/set with validation and base merge |
| `ConfigMigrationRunner` | Class | Run ordered versioned migrations |
| `ConfigMigration` | Interface | `{ version, migrate: (store) => Promise<void> }` |

## Related Packages

- [@reaatech/multi-tenant-mcp-types](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-types)
- [@reaatech/multi-tenant-mcp-middleware](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-middleware)

## License

[MIT](https://github.com/reaatech/multi-tenant-mcp/blob/main/LICENSE)
