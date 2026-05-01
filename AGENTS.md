# AGENTS.md — multi-tenant-mcp

> Agent-focused guidance for contributing to this codebase.

## Project Structure

This is a **pnpm workspace monorepo** managed with Turborepo.

```
packages/
  types/              — Shared types, error codes, and LRU-bounded map
  tenant-resolver/    — Tenant identity resolution from headers, JWTs, or API keys
  rate-limiter/       — Per-tenant rate limiting with in-memory and Redis stores
  tool-visibility/    — Allow/deny/dynamic visibility policies for tools, resources, prompts
  cost-accounting/    — Per-call, per-token, and tiered cost tracking
  artifact-store/     — Tenant-isolated artifact storage (filesystem + S3)
  config-isolation/   — Per-tenant config with Zod validation and migration support
  observability/      — Structured logging and per-tenant metrics
  middleware/          — Composable multi-tenant middleware for MCP servers
e2e/                   — End-to-end, security, and performance tests
examples/
  sse/                 — SSE transport example (Express)
  stdio/               — Stdio transport example
```

## Build System

- **Package manager:** pnpm (required)
- **Build tool:** tsup (per-package) + Turborepo (orchestration)
- **Format/Lint:** Biome (not Prettier/ESLint)
- **Test:** Vitest
- **Versioning:** Changesets
- **TypeScript:** Strict mode, ESM + CJS dual output

### Common Commands

```bash
# Install all dependencies
pnpm install

# Build everything
pnpm build

# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Lint & format
pnpm lint
pnpm lint:fix
pnpm format

# Type-check without emit
pnpm typecheck

# Create a changeset for versioning
pnpm changeset

# Clean all build outputs and node_modules
pnpm clean
```

## Coding Conventions

1. **Runtime validation:** Use Zod for all external-facing data. Never trust raw JSON.
2. **Error handling:** Use `MiddlewareError` from `@reaatech/multi-tenant-mcp-types`. Include
   `MiddlewareErrorCode` enum values.
3. **Types:** Prefer `type` over `interface` for data shapes. Keep `interface` for class contracts.
4. **No `any`:** Biome is configured to error on `any`. Use `unknown` + narrowing instead.
5. **Exports:** Always provide ESM + CJS dual output with `types` condition first in `exports`.
6. **Imports:** Use package names (`@reaatech/multi-tenant-mcp-*`) for cross-package imports.
   Never use relative `../../` paths between packages.
7. **No `console.log`**: Use `ConsoleTenantLogger` from `@reaatech/multi-tenant-mcp-observability`
   for all logging in library code.

## Adding a New Package

1. Create `packages/<name>/` with `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`
2. Use `@reaatech/multi-tenant-mcp-types` for shared types. Do not duplicate schemas.
3. Add workspace dependency entries in the package's `package.json` using `workspace:*`.
4. Add path alias to `tsconfig.typecheck.json`.
5. Run `pnpm install` from root to link workspace packages.

### Package template

```json
{
  "name": "@reaatech/multi-tenant-mcp-<name>",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist"],
  "publishConfig": { "access": "public" },
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts --clean",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "clean": "rm -rf dist"
  }
}
```

## Testing

- Unit tests live next to source files: `src/foo.test.ts`
- E2E, security, and performance tests live in `e2e/`
- Always run `pnpm test` before committing
- Use `pnpm test:coverage` to check coverage

## Release Flow

1. Create a changeset: `pnpm changeset` (interactive — pick packages, bump type, write summary)
2. Commit the generated `.changeset/*.md` file
3. On merge to `main`, CI opens a "Version Packages" PR via `changesets/action`
4. Review the version bumps and auto-generated CHANGELOGs
5. Merge the Version Packages PR → packages publish to npm + GitHub Packages

## Protocol Integration

This project wraps [MCP (Model Context Protocol)](https://modelcontextprotocol.io) servers. The
middleware layer intercepts MCP request handlers (`tools/list`, `tools/call`, `resources/list`,
`resources/read`, `prompts/list`, `prompts/get`) rather than providing Express-style `.use()`
middleware. All middleware is registered via `middleware.handle(server, method, handler)`.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full request pipeline, data flows, and security
model.
