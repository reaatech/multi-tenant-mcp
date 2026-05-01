# @reaatech/multi-tenant-mcp-observability

[![npm version](https://img.shields.io/npm/v/@reaatech/multi-tenant-mcp-observability.svg)](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-observability)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/multi-tenant-mcp/ci.yml?branch=main&label=CI)](https://github.com/reaatech/multi-tenant-mcp/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Structured logging and per-tenant metrics for multi-tenant MCP servers. Logs and counters
automatically carry the current tenant ID from `TenantContextStore`.

## Installation

```bash
npm install @reaatech/multi-tenant-mcp-observability
# or
pnpm add @reaatech/multi-tenant-mcp-observability
```

## Feature Overview

- **Structured console logger** — `ConsoleTenantLogger` writes JSON-serialisable objects to stdout/
  stderr; debug/info to stdout, warn/error to stderr.
- **Tenant context auto-attached** — When a `TenantContextStore` is active, every log entry
  includes `tenantId` automatically.
- **LRU-bounded metrics** — `MetricsCollector` uses `BoundedMap` internally; high-cardinality
  tenant IDs won't exhaust memory.

## Quick Start

```typescript
import {
  ConsoleTenantLogger,
  MetricsCollector,
} from '@reaatech/multi-tenant-mcp-observability';

const logger = new ConsoleTenantLogger({ level: 'info' });
const metrics = new MetricsCollector();

logger.info('Server started', { port: 3000 });
// stdout: info Server started {"port":3000}

logger.error('Connection failed', { error: 'timeout', stack: '...' });
// stderr: error Connection failed {"error":"timeout","stack":"..."}

metrics.increment('tools/call', 'tenant-a');
metrics.increment('tools/call', 'tenant-b');
```

### With Tenant Context

When a `TenantContextStore` is running, the logger automatically reads the current tenant:

```typescript
import { TenantContextStore } from '@reaatech/multi-tenant-mcp-tenant-resolver';
import { ConsoleTenantLogger } from '@reaatech/multi-tenant-mcp-observability';

const store = new TenantContextStore();
const logger = new ConsoleTenantLogger({ level: 'debug', contextStore: store });

store.run({ tenantId: 'acme-corp', metadata: {}, resolvedAt: new Date() }, () => {
  logger.info('Request received');
  // stdout: info Request received {"tenantId":"acme-corp"}
});
```

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `TenantLogger` | Interface | `debug`, `info`, `warn`, `error` methods |
| `LogEntry` | Interface | `level`, `message`, `timestamp`, `tenantId?`, `metadata?` |
| `ConsoleTenantLogger` | Class | Structured logger writing to stdout/stderr; optionally reads tenant from `TenantContextStore` |
| `ConsoleTenantLoggerOptions` | Interface | `level` ('trace'..'error'), `contextStore?`, `includeStackTraces?` |
| `MetricsCollector` | Class | In-memory counter metrics with LRU-bounded tenant labels |
| `MetricsCollectorOptions` | Interface | `maxTenants` cap for the internal LRU map |
| `Counter` | Interface | `increment(n?)`, `value`, `reset` |

## Related Packages

- [@reaatech/multi-tenant-mcp-types](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-types)
- [@reaatech/multi-tenant-mcp-tenant-resolver](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-tenant-resolver)
- [@reaatech/multi-tenant-mcp-middleware](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-middleware)

## License

[MIT](https://github.com/reaatech/multi-tenant-mcp/blob/main/LICENSE)
