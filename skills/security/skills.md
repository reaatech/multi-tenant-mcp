# Skill: Security

## Purpose

Perform security analysis and validation for the multi-tenant-mcp monorepo, with a focus on tenant
isolation and data protection.

## Capabilities

- **Vulnerability Scanning** — Scan dependencies for known security vulnerabilities
- **Tenant Isolation Validation** — Verify tenant data cannot leak across boundaries
- **Data Leakage Detection** — Check for potential data leakage risks
- **Authentication Flow Audit** — Audit authentication and authorization flows
- **Rate Limiting Verification** — Verify rate limiting implementation prevents abuse

## Input Parameters

```json
{
  "action": "run-audit | validate-isolation | check-leaks | audit-auth | verify-rate-limits",
  "options": {
    "focus": ["string"],
    "packages": ["string"],
    "generateReport": "boolean",
    "failOnIssues": "boolean",
    "severityThreshold": "low | medium | high | critical"
  }
}
```

## Output

- Security audit report with findings and severity levels
- Tenant isolation test results with evidence
- Data leakage risk assessment with specific code locations
- Authentication flow analysis with vulnerability details
- Rate limiting verification results

## Usage Examples

### Run Full Security Audit

```json
{
  "action": "run-audit",
  "options": {
    "focus": ["tenant-isolation", "auth-validation", "rate-limiting"],
    "generateReport": true,
    "failOnIssues": true,
    "severityThreshold": "high"
  }
}
```

### Validate Tenant Isolation

```json
{
  "action": "validate-isolation",
  "options": {
    "testCases": [
      "cross-tenant-data-access",
      "tenant-context-manipulation",
      "shared-state-contamination"
    ],
    "generateReport": true
  }
}
```

### Check for Data Leaks

```json
{
  "action": "check-leaks",
  "options": {
    "packages": ["observability", "middleware"],
    "focus": ["logs", "error-messages", "response-headers"],
    "generateReport": true
  }
}
```

### Audit Authentication Flows

```json
{
  "action": "audit-auth",
  "options": {
    "packages": ["tenant-resolver"],
    "flows": ["jwt-validation", "api-key-validation", "tenant-resolution"],
    "generateReport": true
  }
}
```

## When to Invoke

- After changes to tenant resolution, auth, or isolation code
- Before any release or publish action
- When adding a new storage backend or config store
- When a PR touches `packages/tenant-resolver/`, `packages/rate-limiter/`, or
  `packages/artifact-store/`

## Invocation Actions

1. Run dependency audit: `pnpm audit --audit-level moderate`
2. Run e2e security tests: `pnpm turbo run test --filter=e2e`
3. Verify tenant isolation boundaries in changed files
4. Check for PII in logs / error messages
5. Validate that cost calculation remains server-side only
6. Review cross-package imports for isolation guarantees

## Security Focus Areas

### Tenant Isolation
- **Auth Boundary** — Verify tenant resolved from verified auth context
- **Data Boundary** — Ensure all data access scoped to tenant ID
- **Config Boundary** — Confirm configurations loaded per-tenant
- **Storage Boundary** — Validate artifact paths namespaced by tenant

### Attack Mitigation
- **Tenant Hijacking** — Validate tenant ID against auth context
- **Rate Limit Bypass** — Verify distributed rate limiting (Redis)
- **Tool Access Escalation** — Enforce visibility at middleware layer
- **Cost Manipulation** — Server-side cost calculation only

### Data Protection
- **PII in Logs** — Check for personally identifiable information in logs
- **Error Message Leaks** — Ensure error messages don't reveal tenant data
- **Response Header Leaks** — Verify headers don't expose sensitive info
- **Memory Isolation** — Ensure tenant data not shared in memory

## Vulnerability Severity Levels

- **Critical** — Immediate tenant data compromise possible
- **High** — Significant security weakness, exploitation likely
- **Medium** — Security weakness, exploitation possible under specific conditions
- **Low** — Minor security issue, low exploitation risk

## Security Testing Methods

### Static Analysis
- Code scanning for security patterns
- Dependency vulnerability checking (`pnpm audit`)
- Configuration security validation

### Dynamic Analysis
- E2E security tests in `e2e/src/security/`
- Auth flow penetration testing
- Rate limiting stress testing

### Manual Review
- Architecture security review
- Code review for security-sensitive areas
- Threat modeling sessions

## Configuration

Configured via `skills.config.json`:

```json
{
  "security": {
    "auditLevel": "moderate",
    "failOnVulnerabilities": true
  }
}
```

## Error Handling

- Critical vulnerabilities found → Fail immediately with details
- High severity issues → Report with remediation suggestions
- Medium/Low issues → Report with recommendations
- Scan failures → Report partial results with error details
