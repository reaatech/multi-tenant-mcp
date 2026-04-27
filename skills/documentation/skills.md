# Skill: Documentation

## Purpose

Generate and maintain project documentation for multi-tenant-mcp.

## Capabilities

- **API Documentation** — Generate API docs from TypeScript types and JSDoc comments
- **README Updates** — Update README with feature changes and usage examples
- **Migration Guides** — Create guides for upgrading between versions
- **Changelog Generation** — Generate changelogs from git commits
- **Documentation Validation** — Validate documentation consistency and accuracy

## Input Parameters

```json
{
  "action": "generate-api-docs | update-readme | create-migration-guide | generate-changelog | validate-docs",
  "options": {
    "outputDir": "string",
    "includePrivate": "boolean",
    "sinceVersion": "string",
    "format": "markdown | html"
  }
}
```

## Output

- Generated documentation files (markdown or HTML)
- Updated README with new content
- Migration guide with breaking changes and upgrade steps
- Changelog with categorized changes (feat, fix, breaking)
- Validation report with inconsistencies and suggestions

## Usage Examples

### Generate API Documentation

```json
{
  "action": "generate-api-docs",
  "options": {
    "outputDir": "./docs/api",
    "includePrivate": false,
    "format": "markdown"
  }
}
```

### Update README with New Feature

```json
{
  "action": "update-readme",
  "options": {
    "feature": {
      "name": "Redis Rate Limiter",
      "description": "Distributed rate limiting with Redis backend",
      "usage": "import { RedisRateLimiter } from './rate-limiter';"
    }
  }
}
```

### Generate Changelog from Git

```json
{
  "action": "generate-changelog",
  "options": {
    "sinceVersion": "0.2.0",
    "format": "markdown"
  }
}
```

### Validate Documentation

```json
{
  "action": "validate-docs",
  "options": {
    "checkLinks": true,
    "checkExamples": true
  }
}
```

## When to Invoke

- After adding or changing public APIs
- Before release to ensure docs match code
- When README examples become outdated
- When generating release notes or changelogs

## Invocation Actions

1. Update JSDoc comments in source files
2. Regenerate API docs with `pnpm docs:generate`
3. Update README.md quick-start if API changed
4. Validate all markdown links with `pnpm docs:validate`

## Documentation Standards

### API Documentation
- All public interfaces must have JSDoc comments
- Include @param, @returns, @throws tags
- Include usage examples in comments
- Mark deprecated items with @deprecated

### README Structure
- Overview and features
- Installation instructions
- Quick start example
- Core modules documentation
- Development setup
- Contributing guidelines
- License

### Migration Guides
- List all breaking changes
- Provide before/after code examples
- Include upgrade steps
- Link to related issues/PRs

### Changelog Format
- Follow [Keep a Changelog](https://keepachangelog.com/) format
- Categorize changes: Added, Changed, Deprecated, Removed, Fixed, Security
- Link to PR/issue numbers

## Validation Rules

- All public APIs must be documented
- All examples must be syntactically valid
- All links must be functional
- Documentation must match current API
- No outdated version references
- Consistent terminology throughout

## Configuration

Configured via `skills.config.json`:

```json
{
  "documentation": {
    "apiOutputDir": "./docs/api",
    "includePrivate": false
  }
}
```

## Error Handling

- Generation failure → Error with partial output if any
- Validation failures → Report with specific line numbers and suggestions
- Missing documentation → List of undocumented public APIs
- Broken links → List of URLs and source files
