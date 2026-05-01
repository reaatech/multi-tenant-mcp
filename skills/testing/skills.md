# Skill: Testing

## Purpose

Manage test execution and coverage analysis for the multi-tenant-mcp monorepo.

## Capabilities

- **Unit Test Execution** — Run unit tests with Vitest per package
- **E2E Test Execution** — Run end-to-end, security, and performance tests from `e2e/`
- **Coverage Analysis** — Generate and analyze code coverage reports
- **Coverage Gap Detection** — Identify untested code paths
- **Test Data Generation** — Create test fixtures and mock data

## Input Parameters

```json
{
  "action": "run-tests | run-e2e | analyze-coverage | generate-fixtures",
  "options": {
    "coverage": "boolean",
    "watch": "boolean",
    "package": "string",
    "bail": "boolean"
  }
}
```

## Output

- Test execution results (pass/fail, duration, assertions)
- Coverage reports (statements, branches, functions, lines)
- Coverage gap analysis with specific file/line recommendations
- Generated test fixtures and mock data files

## Usage Examples

### Run All Tests

```json
{
  "action": "run-tests",
  "options": {
    "coverage": false,
    "watch": false
  }
}
```

### Run Tests with Coverage

```json
{
  "action": "run-tests",
  "options": {
    "coverage": true,
    "watch": false
  }
}
```

### Run E2E Tests

```json
{
  "action": "run-e2e",
  "options": {
    "coverage": false
  }
}
```

### Run Tests for a Specific Package

```json
{
  "action": "run-tests",
  "options": {
    "package": "tenant-resolver",
    "coverage": false,
    "watch": false
  }
}
```

## When to Invoke

- After implementing or modifying any package
- When CI reports test failures
- When coverage drops below the threshold
- Before opening a pull request
- When generating test fixtures for multi-tenant scenarios

## Invocation Actions

1. Run `pnpm test` for fast feedback (Turborepo orchestrates per-package vitest)
2. Run `pnpm test:coverage` to check coverage gaps across all packages
3. Run e2e tests: `pnpm turbo run test --filter=e2e`
4. Run specific package: `pnpm turbo run test --filter=@reaatech/multi-tenant-mcp-<name>`

## Test Categories

### Unit Tests
- Co-located with source: `packages/*/src/<module>.test.ts`
- Mock external dependencies
- Fast execution (<100ms per test)

### E2E / Integration Tests
- Live in `e2e/src/` workspace package
- End-to-end (`e2e/src/e2e/`), security (`e2e/src/security/`), performance (`e2e/src/performance/`)
- Test fixtures in `e2e/fixtures/`
- Use real external services where practical (Redis, S3)

### Security Tests
- Tenant isolation verification
- Auth bypass attempts
- Rate limit bypass attempts

### Performance Tests
- Rate limiting under load
- Cost calculation accuracy
- Storage operation latency

## Coverage Requirements

- **Overall** — >90% code coverage
- **Critical Paths** — 100% coverage (tenant isolation, auth, rate limiting)
- **Branch Coverage** — >85% branch coverage
- **No Critical Gaps** — No untested security-sensitive code

## Configuration

Configured via `skills.config.json`:

```json
{
  "testing": {
    "defaultCoverage": 90,
    "testTimeout": 30000
  }
}
```

## Error Handling

- Test failures → Detailed failure report with stack traces
- Coverage below threshold → List of uncovered critical paths
- Fixture generation failure → Error with generation parameters
- Timeout → Kill long-running tests and report partial results
