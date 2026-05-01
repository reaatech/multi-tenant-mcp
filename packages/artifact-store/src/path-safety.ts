import { posix, resolve, sep } from 'node:path';

/**
 * Reject values that would escape a tenant-scoped directory or object
 * prefix. Used by both `FileSystemArtifactStore` and `S3ArtifactStore`.
 *
 * Rules:
 *  - `tenantId` must be non-empty, have no path separators, no `..`, and
 *    no NUL bytes.
 *  - `name` must be non-empty, never absolute, never contain `..`
 *    segments, and never contain NUL bytes. Forward slashes are allowed
 *    so callers can use sub-paths like `images/logo.png`.
 */
export function assertSafeTenantId(tenantId: string): void {
  if (typeof tenantId !== 'string' || tenantId.length === 0) {
    throw new Error('Invalid tenantId: must be a non-empty string');
  }
  if (tenantId.includes('\0')) {
    throw new Error('Invalid tenantId: contains NUL byte');
  }
  if (tenantId === '.' || tenantId === '..' || tenantId.includes('/') || tenantId.includes('\\')) {
    throw new Error(`Invalid tenantId: "${tenantId}"`);
  }
}

export function assertSafeArtifactName(name: string): void {
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('Invalid artifact name: must be a non-empty string');
  }
  if (name.includes('\0')) {
    throw new Error('Invalid artifact name: contains NUL byte');
  }
  if (name.startsWith('/') || name.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(name)) {
    throw new Error(`Invalid artifact name: must be relative ("${name}")`);
  }
  const segments = name.split(/[\\/]/);
  for (const segment of segments) {
    if (segment === '..' || segment === '.') {
      throw new Error(`Invalid artifact name: traversal segment in "${name}"`);
    }
  }
}

/**
 * Resolves a tenant-scoped filesystem path and verifies the result is
 * contained within the tenant directory. Belt-and-braces check on top
 * of the component-level validation above.
 */
export function resolveWithinTenantDir(tenantDir: string, name: string): string {
  const resolvedDir = resolve(tenantDir);
  const resolved = resolve(resolvedDir, name);
  const dirWithSep = resolvedDir.endsWith(sep) ? resolvedDir : resolvedDir + sep;
  if (resolved !== resolvedDir && !resolved.startsWith(dirWithSep)) {
    throw new Error(`Invalid artifact name: escapes tenant directory ("${name}")`);
  }
  return resolved;
}

/**
 * Resolves a tenant-scoped S3 object key and verifies the normalized
 * result stays under `{prefix}/{tenantId}/`.
 */
export function resolveWithinTenantPrefix(prefix: string, tenantId: string, name: string): string {
  const tenantPrefix = `${prefix}/${tenantId}/`;
  const joined = tenantPrefix + name;
  const normalized = posix.normalize(joined);
  if (!normalized.startsWith(tenantPrefix)) {
    throw new Error(`Invalid artifact name: escapes tenant prefix ("${name}")`);
  }
  return normalized;
}
