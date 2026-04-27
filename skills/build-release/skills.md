# Skill: Build & Release

## Purpose

Manage build and release processes for the multi-tenant-mcp project, ensuring consistent and reliable releases.

## Capabilities

- **TypeScript Build** — Build TypeScript project with proper configuration
- **Package Validation** — Validate package contents and structure
- **Release Notes Generation** — Generate release notes from changelog
- **npm Publishing** — Publish package to npm registry
- **Git Tag & Release** — Create git tags and GitHub releases

## Input Parameters

```json
{
  "action": "build | validate-package | generate-release-notes | publish | create-release",
  "options": {
    "version": "string",
    "bump": "major | minor | patch | prerelease",
    "tag": "string",
    "changelog": "boolean",
    "publish": "boolean",
    "dryRun": "boolean"
  }
}
```

## Output

- Build artifacts (JavaScript, type definitions, source maps)
- Package validation report
- Release notes with changes and contributors
- Published package confirmation
- Git tag and GitHub release details

## Usage Examples

### Build Project

```json
{
  "action": "build",
  "options": {
    "clean": true,
    "sourcemap": true
  }
}
```

### Validate Package

```json
{
  "action": "validate-package",
  "options": {
    "checkFiles": true,
    "checkDependencies": true,
    "checkTypes": true
  }
}
```

### Generate Release Notes

```json
{
  "action": "generate-release-notes",
  "options": {
    "version": "1.0.0",
    "changelog": true
  }
}
```

### Create Full Release

```json
{
  "action": "create-release",
  "options": {
    "version": "1.0.0",
    "bump": "minor",
    "changelog": true,
    "publish": true,
    "dryRun": false
  }
}
```

## When to Invoke

- Preparing a new release (patch, minor, or major)
- Verifying package contents before publish
- After merging a feature branch to `main`
- When CI build step fails

## Invocation Actions

1. Run `pnpm build` to compile TypeScript
2. Run `pnpm validate:package` to check exports and files
3. Run `pnpm release:notes` to generate changelog entries
4. Run `pnpm publish:dry` to verify publish without side effects

## Build Process

### Pre-Build
1. Clean previous build artifacts
2. Validate TypeScript configuration
3. Check for uncommitted changes (optional)

### Build
1. Compile TypeScript to JavaScript
2. Generate type definitions (.d.ts)
3. Generate source maps
4. Copy non-TypeScript assets (if any)

### Post-Build
1. Validate build output
2. Run type checking on built files
3. Generate package size report

## Release Process

### Version Bumping
- **Major** — Breaking changes (X.0.0)
- **Minor** — New features (x.Y.0)
- **Patch** — Bug fixes (x.y.Z)
- **Prerelease** — Pre-release versions (x.y.z-0)

### Pre-Release Checklist
- [ ] All tests passing
- [ ] Code coverage requirements met
- [ ] Linting passes
- [ ] Type checking passes
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] No security vulnerabilities

### Release Steps
1. Update version in package.json
2. Generate changelog entries
3. Create git commit with version bump
4. Create git tag
5. Push to GitHub
6. Publish to npm
7. Create GitHub release

## Package Validation

### File Structure
- Required files present (package.json, LICENSE, README)
- Correct file extensions
- No unexpected files

### Dependencies
- All dependencies declared
- No missing peer dependencies
- No dev dependencies in production

### Type Definitions
- All public APIs have types
- Types are exported correctly
- No type errors in built files

### Package Size
- Bundle size within limits
- No unnecessary large files
- Tree-shaking works correctly

## Release Notes Format

```markdown
## [1.0.0] - YYYY-MM-DD

### Added
- New feature description (#PR_NUMBER)

### Changed
- Changed behavior description (#PR_NUMBER)

### Fixed
- Bug fix description (#PR_NUMBER)

### Contributors
- @contributor1, @contributor2
```

## Configuration

Configured via `skills.config.json`:

```json
{
  "buildRelease": {
    "publishRegistry": "npm",
    "createGithubRelease": true
  }
}
```

## Error Handling

- Build failure → Report with compilation errors
- Validation failure → Report with specific issues
- Publish failure → Rollback and report
- Git operation failure → Report with git error details
