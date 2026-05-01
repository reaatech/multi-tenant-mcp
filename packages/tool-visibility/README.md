# @reaatech/multi-tenant-mcp-tool-visibility

[![npm version](https://img.shields.io/npm/v/@reaatech/multi-tenant-mcp-tool-visibility.svg)](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-tool-visibility)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/multi-tenant-mcp/ci.yml?branch=main&label=CI)](https://github.com/reaatech/multi-tenant-mcp/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Control which MCP tools, resources, and prompts each tenant can access. Supports allow-list,
deny-list, and dynamic policy evaluation.

## Installation

```bash
npm install @reaatech/multi-tenant-mcp-tool-visibility
# or
pnpm add @reaatech/multi-tenant-mcp-tool-visibility
```

## Feature Overview

- **Three policy types** — `allow` (whitelist), `deny` (blacklist), and `dynamic` (runtime
  evaluator function).
- **Unified API** — Same engine for tools, resources, and prompts; each dimension receives its
  own independent policy map.
- **Default-deny** — When no policy is configured for a tenant, all items are visible. When an
  allow-list exists but doesn't list the item, access is denied.

## Quick Start

```typescript
import { VisibilityEngineImpl } from '@reaatech/multi-tenant-mcp-tool-visibility';

const engine = new VisibilityEngineImpl({
  'tenant-a': { type: 'allow', items: ['echo', 'status'] },
  'tenant-b': { type: 'deny', items: ['admin-delete'] },
  'tenant-c': {
    type: 'dynamic',
    evaluator: (itemName, tenantId) => itemName.startsWith(`${tenantId}:`),
  },
});

engine.isVisible('echo', 'tenant-a'); // true (in allow-list)
engine.isVisible('admin-delete', 'tenant-a'); // false (not in allow-list)
engine.isVisible('echo', 'tenant-b'); // true (not in deny-list)
engine.isVisible('admin-delete', 'tenant-b'); // false (in deny-list)
engine.isVisible('tenant-c:my-tool', 'tenant-c'); // true (dynamic match)
```

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `VisibilityEngine` | Interface | `isVisible(itemName, tenantId) → boolean` |
| `VisibilityPolicy` | Type | `{ type: 'allow' \| 'deny' \| 'dynamic', items?, evaluator? }` |
| `VisibilityEngineImpl` | Class | Default implementation with allow-list, deny-list, and dynamic evaluation |

### Visibility Policy Types

| Policy | Behaviour |
|--------|-----------|
| `{ type: 'allow', items: [...] }` | Only listed items are visible; everything else is denied |
| `{ type: 'deny', items: [...] }` | All items are visible except the listed ones |
| `{ type: 'dynamic', evaluator: fn }` | The `evaluator` function is called for every visibility check |

## Related Packages

- [@reaatech/multi-tenant-mcp-types](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-types)
- [@reaatech/multi-tenant-mcp-middleware](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-middleware)

## License

[MIT](https://github.com/reaatech/multi-tenant-mcp/blob/main/LICENSE)
