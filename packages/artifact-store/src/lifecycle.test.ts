import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileSystemArtifactStore } from './filesystem-store.js';
import { ArtifactLifecycleManager } from './lifecycle.js';

describe('ArtifactLifecycleManager', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = mkdtempSync(join(tmpdir(), 'mtm-lifecycle-'));
  });

  afterEach(() => {
    rmSync(basePath, { recursive: true, force: true });
  });

  it('should delete artifacts older than maxAgeMs', async () => {
    const store = new FileSystemArtifactStore(basePath);
    await store.put('t1', 'old.txt', 'old', 'text/plain');
    await store.put('t1', 'new.txt', 'new', 'text/plain');

    // Simulate old artifact by patching updatedAt
    // (filesystem store uses mtime, so we can't easily backdate)
    // Instead, test with a very short maxAge and sleep
    await new Promise((resolve) => setTimeout(resolve, 50));

    const manager2 = new ArtifactLifecycleManager(store, { maxAgeMs: 10 });
    const deleted = await manager2.cleanup('t1');

    expect(deleted).toBe(2);
    expect(await store.exists('t1', 'old.txt')).toBe(false);
    expect(await store.exists('t1', 'new.txt')).toBe(false);
  });

  it('should keep recent artifacts', async () => {
    const store = new FileSystemArtifactStore(basePath);
    const manager = new ArtifactLifecycleManager(store, { maxAgeMs: 60_000 });

    await store.put('t1', 'recent.txt', 'recent', 'text/plain');

    const deleted = await manager.cleanup('t1');

    expect(deleted).toBe(0);
    expect(await store.exists('t1', 'recent.txt')).toBe(true);
  });

  it('should only affect specified tenant', async () => {
    const store = new FileSystemArtifactStore(basePath);
    const manager = new ArtifactLifecycleManager(store, { maxAgeMs: 10 });

    await store.put('t1', 'file.txt', 'data', 'text/plain');
    await store.put('t2', 'file.txt', 'data', 'text/plain');

    await new Promise((resolve) => setTimeout(resolve, 50));

    const deleted = await manager.cleanup('t1');

    expect(deleted).toBe(1);
    expect(await store.exists('t1', 'file.txt')).toBe(false);
    expect(await store.exists('t2', 'file.txt')).toBe(true);
  });
});
