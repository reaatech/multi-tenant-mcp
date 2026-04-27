# Skill: Testing

## Purpose

Manage test execution and coverage analysis for the multi-tenant-mcp project.

## Capabilities

- **Unit Test Execution** — Run unit tests with Vitest
- **Integration Test Execution** — Run integration tests with test containers
- **Coverage Analysis** — Generate and analyze code coverage reports
- **Coverage Gap Detection** — Identify untested code paths
- **Test Data Generation** — Create test fixtures and mock data

## Input Parameters

```json
{
  "action": "run-tests | analyze-coverage | generate-fixtures",
  "options": {
    "coverage": "boolean",
    "watch": "boolean",
    "testPathPattern": "string",
    "testNamePattern": "string",
    "bail": "boolean",
    "threads": "number"
  }
}
```

## Output

- Test execution results (pass/fail, duration, assertions)
- Coverage reports (statements, branches, functions, lines)
- Coverage gap analysis with specific file/line recommendations
- Generated test fixtures and mock data files

## Usage Examples

### Run All Tests with Coverage

```json
{
  "action": "run-tests",
  "options": {
    "coverage": true,
    "watch": false
  }
}
```

### Run Specific Test File

```json
{
  "action": "run-tests",
  "options": {
    "coverage": false,
    "testPathPattern": "tenant-resolver",
    "watch": false
  }
}
```

### Analyze Coverage Gaps

```json
{
  "action": "analyze-coverage",
  "options": {
    "minimumCoverage": 90
  }
}
```

### Generate Test Fixtures

```json
{
  "action": "generate-fixtures",
  "options": {
    "module": "rate-limiter",
    "count": 100
  }
}
```

## When to Invoke

- After implementing or modifying any module
- When CI reports test failures
- When coverage drops below the 90% threshold
- Before opening a pull request
- When generating test fixtures for multi-tenant scenarios

## Invocation Actions

1. Run `pnpm test` for fast feedback
2. Run `pnpm test:coverage` to check coverage gaps
3. Run `pnpm test:integration` when Redis/DB changes are involved
4. Generate or update fixtures in `tests/fixtures/`

## Test Categories

### Unit Tests
- Individual module testing in isolation
- Mock external dependencies
- Fast execution (<100ms per test)

### Integration Tests
- Multi-module interaction testing
- Real Redis/Database connections (test containers)
- Medium execution time (<5s per test)

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
