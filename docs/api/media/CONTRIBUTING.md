# Contributing to multi-tenant-mcp

Thank you for your interest in contributing to `multi-tenant-mcp`! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

Please be respectful and constructive in your interactions. We are committed to providing a welcoming and inclusive experience for everyone.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/reaatech/multi-tenant-mcp.git`
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 8+
- Redis (for running integration tests)

### Installation

```bash
pnpm install
```

### Development Commands

```bash
# Build the project
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Lint the code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format the code
pnpm format

# Check formatting
pnpm format:check

# Type check
pnpm typecheck
```

## How to Contribute

### Types of Contributions

We welcome various types of contributions:

- **Bug fixes** — Fix issues in the codebase
- **New features** — Add new multi-tenancy primitives
- **Documentation** — Improve docs, examples, or comments
- **Tests** — Add or improve test coverage
- **Performance improvements** — Optimize existing code
- **Security improvements** — Enhance security measures

### Before You Start

1. Check existing issues and pull requests
2. Create a new issue to discuss your proposed change
3. Wait for feedback before investing significant time

## Coding Standards

### TypeScript

- Use TypeScript for all code
- Enable strict mode in `tsconfig.json`
- Define explicit types (avoid `any`)
- Use interfaces for object shapes
- Export types for public API

### Code Style

- Follow Prettier formatting (automated)
- Follow ESLint rules (automated)
- Use meaningful variable and function names
- Keep functions small and focused
- Prefer composition over inheritance

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `style:` — Code style changes (formatting, etc.)
- `refactor:` — Code refactoring
- `test:` — Test changes
- `chore:` — Build/config changes

Example:
```
feat: add Redis-backed rate limiter

Implemented RedisRateLimitStore for distributed rate limiting
across multiple MCP server instances.

Closes #42
```

## Testing

### Test Structure

- Unit tests in `*.test.ts` files alongside source files
- Integration tests in `tests/integration/`
- End-to-end tests in `tests/e2e/`

### Writing Tests

```typescript
// Example test structure
describe("TenantResolver", () => {
  describe("resolve", () => {
    it("should extract tenant from JWT claims", () => {
      // Arrange
      const resolver = new JWTTenantResolver({ claim: "tenant_id" });
      
      // Act
      const context = resolver.resolve(mockRequest);
      
      // Assert
      expect(context.tenantId).toBe("tenant-123");
    });
  });
});
```

### Test Coverage

- Aim for >90% code coverage
- Test happy paths and error cases
- Test tenant isolation boundaries
- Test rate limiting behavior

## Pull Request Process

1. **Create a branch** from `main`
2. **Make your changes** following coding standards
3. **Write tests** for new functionality
4. **Ensure all tests pass** (`pnpm test`)
5. **Run linting** (`pnpm lint`)
6. **Update documentation** if needed
7. **Push your branch** to your fork
8. **Open a pull request** against `main`

### PR Requirements

- [ ] Tests pass
- [ ] Linting passes
- [ ] Type checking passes
- [ ] Coverage maintained or improved
- [ ] Documentation updated
- [ ] Commit messages follow conventions
- [ ] PR description explains the change

### Review Process

1. Maintainer reviews the code
2. Automated checks must pass
3. Address review feedback
4. Maintainer merges when approved

## Reporting Issues

### Bug Reports

Please include:

- Description of the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (Node.js version, OS, etc.)
- Any relevant logs or error messages

### Feature Requests

Please include:

- Description of the feature
- Use case or problem it solves
- Proposed implementation (if any)
- Alternatives considered

### Security Issues

**Do not open public issues for security vulnerabilities.**

Email security concerns to: security@reaa.tech

## Architecture Decisions

Major architectural changes should:

1. Be discussed in an issue first
2. Include rationale and alternatives
3. Consider backward compatibility
4. Include migration plan if breaking changes

## Release Process

Releases follow [Semantic Versioning](https://semver.org/):

- **Major** — Breaking changes
- **Minor** — New features (backward compatible)
- **Patch** — Bug fixes (backward compatible)

### Release Checklist

- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md`
- [ ] Create git tag
- [ ] Publish to npm
- [ ] Create GitHub release

## Questions?

If you have questions, please:

1. Check existing documentation
2. Search existing issues
3. Open a new issue for discussion

Thank you for contributing!
