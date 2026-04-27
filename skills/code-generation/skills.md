# Skill: Code Generation

## Purpose

Generate TypeScript code for multi-tenant-mcp modules based on specifications and templates.

## Capabilities

- **Module Scaffolding** — Generate complete module structure from specifications
- **Interface Generation** — Create TypeScript interfaces and types from schemas
- **Middleware Components** — Implement middleware components following project patterns
- **Test Templates** — Generate test file templates with appropriate assertions

## Input Parameters

```json
{
  "action": "generate-module",
  "module": {
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

- Generated TypeScript source files
- Generated test files (if requested)
- Generated documentation stubs (if requested)
- Summary of generated files and structure

## Usage Examples

### Generate a Rate Limiter Module

```json
{
  "action": "generate-module",
  "module": {
    "name": "RedisRateLimiter",
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
  "action": "generate-module",
  "module": {
    "name": "JWTTenantResolver",
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

- Scaffolding a new module (rate-limiter, tenant-resolver, etc.)
- Adding a new public interface or type definition
- Generating test file templates for a new component
- Creating middleware boilerplate

## Invocation Actions

1. Create `src/{module}/index.ts` with public exports
2. Create `src/{module}/{module}.ts` with implementation
3. Create `src/{module}/types.ts` with interfaces and Zod schemas
4. Create `src/{module}/{module}.test.ts` with Vitest tests
5. Update `src/index.ts` barrel export if applicable

## Constraints

- Generated code must follow project TypeScript strict mode
- Generated code must follow ESLint and Prettier rules
- Generated code must include appropriate JSDoc comments
- Generated code must not introduce security vulnerabilities
- Generated code must maintain tenant isolation guarantees
- Every module must export its types for public API surface

## Error Handling

- Invalid module type → Error with available types
- Missing required spec fields → Error with required fields list
- Generation failure → Error with partial results if any
- File write failure → Error with affected files

## Configuration

Configured via `skills.config.json`:

```json
{
  "codeGeneration": {
    "outputDir": "./src",
    "templateDir": "./templates",
    "includeTests": true
  }
}
