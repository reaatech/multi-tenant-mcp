# Agent Skills for multi-tenant-mcp

This document describes the AI agent skills available for developing and maintaining the `multi-tenant-mcp` project. These skills are designed to assist with various aspects of the development lifecycle.

## Overview

The project uses a skill-based agent system where each skill handles a specific domain of tasks. Skills are located in the `skills/` directory and can be invoked to perform automated or semi-automated tasks.

## Available Skills

### 1. Code Generation (`skills/code-generation/skills.md`)

**Purpose:** Generate TypeScript code for multi-tenant-mcp modules.

**Capabilities:**
- Generate module scaffolding from specifications
- Create TypeScript interfaces and types
- Implement middleware components
- Generate test templates

### 2. Testing (`skills/testing/skills.md`)

**Purpose:** Manage test execution and coverage analysis.

**Capabilities:**
- Run unit tests with Vitest
- Execute integration tests
- Generate coverage reports
- Analyze test coverage gaps
- Create test data fixtures

### 3. Documentation (`skills/documentation/skills.md`)

**Purpose:** Generate and maintain project documentation.

**Capabilities:**
- Generate API documentation from TypeScript types
- Update README with feature changes
- Create migration guides
- Generate changelogs
- Validate documentation consistency

### 4. Security (`skills/security/skills.md`)

**Purpose:** Perform security analysis and validation.

**Capabilities:**
- Scan for security vulnerabilities
- Validate tenant isolation boundaries
- Check for data leakage risks
- Audit authentication flows
- Verify rate limiting implementation

### 5. Performance (`skills/performance/skills.md`)

**Purpose:** Monitor and optimize performance.

**Capabilities:**
- Run performance benchmarks
- Analyze latency profiles
- Identify performance bottlenecks
- Suggest optimizations
- Monitor resource usage

### 6. Build & Release (`skills/build-release/skills.md`)

**Purpose:** Manage build and release processes.

**Capabilities:**
- Build TypeScript project
- Validate package contents
- Generate release notes
- Publish to npm
- Create git tags and releases

## Skill Configuration

Skills are configured in `skills.config.json` at the project root. Each skill has its own configuration section with options for behavior customization.

## Using Skills with AI Assistants

AI assistants invoke skills by reading the relevant `skills/{topic}/skills.md` file and then executing the appropriate actions using available tools (e.g., `WriteFile`, `StrReplaceFile`, `Shell`).

### Invocation Pattern

1. **Identify the skill** needed for the current task (see mapping below)
2. **Read the skill file** for context, constraints, and templates
3. **Execute** using standard tools following the skill's guidelines
4. **Validate** outputs against the skill's constraints

### Skill-to-Task Mapping

| Task | Skill File | Typical Actions |
|---|---|---|
| Scaffold a new module | `skills/code-generation/skills.md` | Write TS files, tests, barrel exports |
| Tests fail or coverage drops | `skills/testing/skills.md` | Run `pnpm test`, analyze coverage |
| Auth or isolation code changes | `skills/security/skills.md` | Audit boundaries, check for leaks |
| Benchmark or optimize | `skills/performance/skills.md` | Run benchmarks, profile latency |
| Update docs or changelog | `skills/documentation/skills.md` | Edit markdown, validate consistency |
| Release or publish | `skills/build-release/skills.md` | Version bump, build, publish |

## Best Practices

- Skills should be idempotent when possible
- Provide clear error messages
- Log important actions
- Validate inputs thoroughly
- Handle failures gracefully
- Document skill capabilities and limitations

## Contributing

When adding new skills:

1. Create a markdown spec in `skills/` directory
2. Document the skill in this file
3. Add configuration options to `skills.config.json`
4. Update the skill registry

For questions about skills, open an issue or discussion.
