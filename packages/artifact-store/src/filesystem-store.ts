import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  assertSafeArtifactName,
  assertSafeTenantId,
  resolveWithinTenantDir,
} from './path-safety.js';
import type { Artifact, ArtifactStore, StorageQuota } from './types.js';

/**
 * Filesystem-backed artifact store for development and testing.
 *
 * Stores artifacts under `{basePath}/{tenantId}/{name}`. Tenant IDs and
 * artifact names are validated at every call to prevent path traversal.
 */
export class FileSystemArtifactStore implements ArtifactStore {
  constructor(
    private readonly basePath: string,
    private readonly quota?: StorageQuota,
  ) {}

  async put(
    tenantId: string,
    name: string,
    data: Buffer | string,
    contentType: string,
    metadata?: Record<string, unknown>,
  ): Promise<Artifact> {
    const path = this.resolvePath(tenantId, name);
    await mkdir(dirname(path), { recursive: true });

    if (this.quota) {
      await this.enforceQuota(tenantId, data);
    }

    await writeFile(path, data);

    const now = new Date();
    const size = Buffer.byteLength(data);

    return {
      id: `${tenantId}/${name}`,
      tenantId,
      name,
      contentType,
      size,
      createdAt: now,
      updatedAt: now,
      metadata,
    };
  }

  async get(tenantId: string, name: string): Promise<Buffer> {
    const path = this.resolvePath(tenantId, name);
    try {
      return await readFile(path);
    } catch (err) {
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
        throw new Error(`Artifact not found: ${tenantId}/${name}`);
      }
      throw err;
    }
  }

  async list(tenantId: string, prefix?: string): Promise<Artifact[]> {
    assertSafeTenantId(tenantId);
    if (prefix !== undefined) assertSafeArtifactName(prefix);

    const dir = this.tenantDir(tenantId);
    const artifacts: Artifact[] = [];

    const walk = async (currentDir: string, relativePath: string): Promise<void> => {
      let entries: string[];
      try {
        entries = await readdir(currentDir);
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = join(currentDir, entry);
        const relPath = relativePath ? `${relativePath}/${entry}` : entry;
        const info = await stat(fullPath);

        if (info.isDirectory()) {
          await walk(fullPath, relPath);
          continue;
        }

        if (prefix && !relPath.startsWith(prefix)) continue;

        artifacts.push({
          id: `${tenantId}/${relPath}`,
          tenantId,
          name: relPath,
          contentType: 'application/octet-stream',
          size: info.size,
          createdAt: info.birthtime,
          updatedAt: info.mtime,
        });
      }
    };

    await walk(dir, '');
    return artifacts;
  }

  async delete(tenantId: string, name: string): Promise<void> {
    const path = this.resolvePath(tenantId, name);
    await rm(path, { force: true });
  }

  async exists(tenantId: string, name: string): Promise<boolean> {
    const path = this.resolvePath(tenantId, name);
    try {
      const info = await stat(path);
      return info.isFile();
    } catch {
      return false;
    }
  }

  private tenantDir(tenantId: string): string {
    return join(this.basePath, tenantId);
  }

  private resolvePath(tenantId: string, name: string): string {
    assertSafeTenantId(tenantId);
    assertSafeArtifactName(name);
    return resolveWithinTenantDir(this.tenantDir(tenantId), name);
  }

  private async enforceQuota(tenantId: string, data: Buffer | string): Promise<void> {
    if (!this.quota) return;

    const existing = await this.list(tenantId);
    const totalSize = existing.reduce((sum, a) => sum + a.size, 0) + Buffer.byteLength(data);

    if (this.quota.maxBytes !== Number.POSITIVE_INFINITY && totalSize > this.quota.maxBytes) {
      throw new Error(
        `Storage quota exceeded for tenant ${tenantId}: ${String(totalSize)} > ${String(this.quota.maxBytes)}`,
      );
    }

    if (
      this.quota.maxCount !== Number.POSITIVE_INFINITY &&
      existing.length + 1 > this.quota.maxCount
    ) {
      throw new Error(
        `Artifact count quota exceeded for tenant ${tenantId}: ${String(existing.length + 1)} > ${String(this.quota.maxCount)}`,
      );
    }
  }
}
