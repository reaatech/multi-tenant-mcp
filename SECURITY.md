# Security Policy

## Supported Versions

`multi-tenant-mcp` follows semantic versioning. Security fixes land on
the latest minor of each supported major. Older majors receive fixes
only for critical issues.

| Version | Status            |
| ------- | ----------------- |
| 1.x     | Supported         |

## Reporting a Vulnerability

**Do not** open a public GitHub issue for security reports.

Email `security@reaatech.com` with:

- A description of the issue and the component affected
  (tenant resolver, artifact store, rate limiter, etc.)
- Steps to reproduce, ideally with a minimal code sample
- Your assessment of impact (data leak, DoS, auth bypass, ...)
- Any proposed mitigation

You can expect an acknowledgement within three business days and a
status update within ten. Fixes for confirmed high-severity issues
are shipped as a patch release; we coordinate disclosure with the
reporter.

## Threat Model

This library's core value is tenant isolation. Reports are
especially welcome for:

- Path / object-key traversal that crosses tenant boundaries in
  `FileSystemArtifactStore` or `S3ArtifactStore`.
- Tenant-id injection or spoofing via headers, JWT claims, or
  `AsyncLocalStorage` context.
- Unbounded memory growth driven by caller-controlled identifiers
  (rate limiter, cost tracker, metrics labels).
- JWT handling: `alg:none` acceptance, signature bypass, claim
  smuggling, audience/issuer check omissions.
- Information leaks through logs, metrics labels, or emitted usage
  events.

## Out of Scope

- Vulnerabilities in the MCP transport layer (`@modelcontextprotocol/sdk`).
- Misuse of the public API that contradicts the documented invariants
  (for example, calling a resolver without wiring
  `TenantContextStore.run(...)` and then observing that handlers throw
  `Unauthorized`).
- Denial-of-service caused by unbounded input sizes in user-supplied
  handlers — callers are responsible for validating request payloads
  before delegating to a middleware-wrapped handler.
