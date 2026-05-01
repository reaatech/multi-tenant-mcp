# @reaatech/multi-tenant-mcp-artifact-store

[![npm version](https://img.shields.io/npm/v/@reaatech/multi-tenant-mcp-artifact-store.svg)](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-artifact-store)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/multi-tenant-mcp/ci.yml?branch=main&label=CI)](https://github.com/reaatech/multi-tenant-mcp/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Tenant-isolated artifact and file storage. Supports filesystem and S3 backends with automatic
namespace isolation and lifecycle management.

## Installation

```bash
npm install @reaatech/multi-tenant-mcp-artifact-store
# or
pnpm add @reaatech/multi-tenant-mcp-artifact-store
```

For the S3 backend, install the optional peer:

```bash
pnpm add @aws-sdk/client-s3
```

## Feature Overview

- **Automatic namespace isolation** — Every artifact path is prefixed with `{tenantId}/`,
  preventing cross-tenant access.
- **Path-safety built-in** — Path traversal attacks are blocked; all paths are validated and
  normalised before storage operations.
- **Pluggable backends** — Filesystem for development, S3 for production. Implement `ArtifactStore`
  for any other storage system.
- **Quota enforcement** — Configurable per-tenant byte count and file count limits.
- **Lifecycle management** — TTL-based cleanup of stale artifacts.

## Quick Start

```typescript
import {
  FileSystemArtifactStore,
  ArtifactLifecycleManager,
} from '@reaatech/multi-tenant-mcp-artifact-store';

// Filesystem (development)
const store = new FileSystemArtifactStore({ baseDir: '/data/artifacts' });

await store.put('tenant-a', 'report.json', Buffer.from(JSON.stringify({ value: 42 })), 'application/json');

const data = await store.get('tenant-a', 'report.json'); // Buffer
const exists = await store.exists('tenant-b', 'report.json'); // false — isolated
const list = await store.list('tenant-a'); // [Artifact, ...]

await store.delete('tenant-a', 'report.json');

// TTL cleanup — delete artifacts older than 30 days
const lifecycle = new ArtifactLifecycleManager({ maxAgeMs: 30 * 24 * 60 * 60 * 1000 });
await lifecycle.cleanup(store);
```

### S3 (production)

```typescript
import { S3Client } from '@aws-sdk/client-s3';
import { S3ArtifactStore } from '@reaatech/multi-tenant-mcp-artifact-store';

const s3 = new S3Client({ region: 'us-east-1' });
const store = new S3ArtifactStore(s3, 'my-bucket', 'artifacts');
```

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `Artifact` | Interface | Stored artifact: `id`, `tenantId`, `name`, `contentType`, `size`, `createdAt`, `updatedAt`, `metadata` |
| `ArtifactStore` | Interface | Contract: `put`, `get`, `list`, `delete`, `exists` |
| `StorageQuota` | Interface | `maxBytes`, `maxCount` per tenant |
| `FileSystemArtifactStore` | Class | Filesystem-backed storage with path safety |
| `S3ArtifactStore` | Class | S3-backed storage (requires `@aws-sdk/client-s3`) |
| `ArtifactLifecycleManager` | Class | TTL-based cleanup of artifacts older than `maxAgeMs` |

## Related Packages

- [@reaatech/multi-tenant-mcp-types](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-types)
- [@reaatech/multi-tenant-mcp-middleware](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-middleware)

## License

[MIT](https://github.com/reaatech/multi-tenant-mcp/blob/main/LICENSE)
