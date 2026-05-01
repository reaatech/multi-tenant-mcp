# Skill: Code Generation

## Purpose

Generate TypeScript code for multi-tenant-mcp packages based on specifications and templates.

## Capabilities

- **Package Scaffolding** — Generate complete package structure from specifications
- **Interface Generation** — Create TypeScript interfaces and types from schemas
- **Middleware Components** — Implement middleware components following project patterns
- **Test Templates** — Generate test file templates with appropriate assertions

## Input Parameters

```json
{
  "action": "generate-package",
  "package": {
    "name": "string",
    "type": "rate-limiter | tenant-resolver | tool-visibility | cost-accounting | artifact-store | config-isolation",
    "spec": {
      "description": "string",
      "interfaces": ["string"],
      "implementations": ["string"],
      "dependencies": ["string"]
    }
  },
  "options": {
    "includeTests": "boolean",
    "includeDocumentation": "boolean"
  }
}
```

## Output

- Generated TypeScript source files in `packages/<name>/src/`
- Generated test files (if requested) co-located with source
- Generated README.md + LICENSE in the package root
- Summary of generated files and structure

## Usage Examples

### Generate a Rate Limiter Package

```json
{
  "action": "generate-package",
  "package": {
    "name": "rate-limiter",
    "type": "rate-limiter",
    "spec": {
      "description": "Redis-backed distributed rate limiter for multi-tenant scenarios",
      "interfaces": ["RateLimitStore", "RateLimiter"],
      "implementations": ["RedisRateLimitStore"],
      "dependencies": ["redis"]
    }
  },
  "options": {
    "includeTests": true,
    "includeDocumentation": true
  }
}
```

### Generate a Tenant Resolver

```json
{
  "action": "generate-package",
  "package": {
    "name": "tenant-resolver",
    "type": "tenant-resolver",
    "spec": {
      "description": "Extract tenant identity from JWT claims",
      "interfaces": ["TenantResolver", "TenantContext"],
      "implementations": ["JWTTenantResolver"],
      "dependencies": ["jsonwebtoken"]
    }
  },
  "options": {
    "includeTests": true,
    "includeDocumentation": false
  }
}
```

## When to Invoke

- Scaffolding a new package (rate-limiter, tenant-resolver, etc.)
- Adding a new public interface or type definition to an existing package
- Generating test file templates for a new component
- Creating middleware boilerplate

## Invocation Actions

1. Create `packages/<name>/src/index.ts` with public barrel exports
2. Create `packages/<name>/src/<module>.ts` with implementation
3. Create `packages/<name>/src/types.ts` with interfaces and Zod schemas
4. Create `packages/<name>/src/<module>.test.ts` with Vitest tests (co-located)
5. Create `packages/<name>/package.json` using the workspace template
6. Create `packages/<name>/tsconfig.json` extending root
7. Create `packages/<name>/vitest.config.ts`
8. Add path alias to `tsconfig.typecheck.json`

## Package Template

See `AGENTS.md` for the complete `package.json` template. Key requirements:
- `name`: `@reaatech/multi-tenant-mcp-<name>`
- Build via `tsup src/index.ts --format cjs,esm --dts --clean`
- Test via `vitest run`
- Import shared types from `@reaatech/multi-tenant-mcp-types`
- Import sibling packages via `workspace:*`

## Constraints

- Generated code must follow project TypeScript strict mode
- Generated code must follow Biome lint and format rules
- Generated code must include appropriate JSDoc comments
- Generated code must not introduce security vulnerabilities
- Generated code must maintain tenant isolation guarantees
- Every package must export its types for public API surface
- Cross-package imports must use `@reaatech/multi-tenant-mcp-*` package names, never relative `../../` paths

## Error Handling

- Invalid package type → Error with available types
- Missing required spec fields → Error with required fields list
- Generation failure → Error with partial results if any
- File write failure → Error with affected files

## Configuration

Configured via `skills.config.json`:

```json
{
  "codeGeneration": {
    "outputDir": "./packages",
    "includeTests": true,
    "strictMode": true
  }
}
```
