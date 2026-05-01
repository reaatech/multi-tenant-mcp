# Skill: Build & Release

## Purpose

Manage build and release processes for the multi-tenant-mcp monorepo, using tsup + Turborepo +
Changesets for consistent and reliable releases.

## Capabilities

- **Monorepo Build** — Build all packages with Turborepo (respects dependency graph)
- **Package Validation** — Validate package contents, exports, and types
- **Changeset Creation** — Create changesets for versioning and CHANGELOG generation
- **npm Publishing** — Publish packages to npm via CI (changesets/action)
- **GitHub Release** — Automated GitHub releases via the release workflow

## Input Parameters

```json
{
  "action": "build | create-changeset | version-packages | release",
  "options": {
    "bump": "major | minor | patch | prerelease",
    "package": "string",
    "summary": "string",
    "dryRun": "boolean"
  }
}
```

## Output

- Build artifacts in `packages/*/dist/` (ESM + CJS + type declarations)
- Changeset `.md` file in `.changeset/`
- Version bumps and CHANGELOG entries (via `changeset version`)
- Published packages on npm + GitHub Packages (via CI release workflow)

## Usage Examples

### Build All Packages

```json
{
  "action": "build"
}
```

### Create a Changeset

```json
{
  "action": "create-changeset",
  "options": {
    "bump": "patch",
    "package": "tenant-resolver",
    "summary": "Fixed JWT audience validation"
  }
}
```

## When to Invoke

- After merging a feature branch to `main` (create changeset before merge)
- Before opening a PR with new features or fixes
- When CI build step fails
- To bump versions and generate CHANGELOGs before release

## Invocation Actions

1. Build: `pnpm build` (Turborepo builds `types` first, then dependents)
2. Create changeset: `pnpm changeset` (interactive CLI)
3. Version bump: `pnpm version-packages` (consumes `.changeset/*.md` files)
4. Release: `pnpm release` (builds then publishes via `changeset publish`)
5. Type check: `pnpm typecheck` (uses `tsconfig.typecheck.json` with paths)
6. Lint: `pnpm lint` (Biome check)
7. Format: `pnpm format` (Biome format)

## Build Process

### Per-Package Build (tsup)
1. Entry: `src/index.ts` (barrel export)
2. Output: ESM (`dist/index.js`), CJS (`dist/index.cjs`), types (`dist/index.d.ts`)
3. Config: `--format cjs,esm --dts --clean`

### Monorepo Build (Turborepo)
1. Build packages in dependency order (`^build`)
2. Cache builds between invocations
3. Output artifacts in each package's `dist/` directory

## Release Flow

1. **Create changeset**: `pnpm changeset` — pick packages, choose bump type, write summary
2. **Commit changeset**: `git add .changeset/ && git commit -m "..."`
3. **Merge to main**: CI opens/updates a "Version Packages" PR
4. **Review & merge**: Version bumps + CHANGELOGs are committed
5. **Publish**: CI publishes to npm and mirrors to GitHub Packages

For the first-publish bootstrap procedure, see the per-package publish flow in the Release Steps section.

## Release Steps (Manual First Publish)

1. Verify: `pnpm install`, `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`
2. Log in: `npm login`
3. Publish each package: `cd packages/<name> && pnpm publish --access public --no-git-checks --otp=<code>`
4. Verify: `curl https://registry.npmjs.org/@reaatech%2fmulti-tenant-mcp-<name>`
5. Re-enable CI push trigger in `.github/workflows/release.yml`

## Package Validation

### Pre-Publish Checklist
- [ ] All tests passing (`pnpm test`)
- [ ] Type check passing (`pnpm typecheck`)
- [ ] Lint passing (`pnpm lint`)
- [ ] Build producing `dist/` in each package
- [ ] No stray `.js`/`.d.ts` in `packages/*/src/`
- [ ] Public packages have `publishConfig.access: "public"`
- [ ] Private packages (`examples/*`, `e2e`) marked `"private": true`
- [ ] All packages have `repository`, `homepage`, `bugs`, `license`, `author`
- [ ] READMEs are publish-quality (badges, install, quick start, API reference)

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

- Build failure → Report with compilation errors per package
- Validation failure → Report with specific issues per package
- Publish failure → Rollback and report
- Changeset conflict → Report with resolution steps
