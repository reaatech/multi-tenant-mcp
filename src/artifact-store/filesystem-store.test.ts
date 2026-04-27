import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSystemArtifactStore } from "./filesystem-store.js";
import type { StorageQuota } from "./types.js";

describe("FileSystemArtifactStore", () => {
  let basePath: string;

  beforeEach(() => {
    basePath = mkdtempSync(join(tmpdir(), "mtm-artifacts-"));
  });

  afterEach(() => {
    rmSync(basePath, { recursive: true, force: true });
  });

  it("should store and retrieve an artifact", async () => {
    const store = new FileSystemArtifactStore(basePath);
    await store.put("t1", "data.json", '{"hello":"world"}', "application/json");

    const data = await store.get("t1", "data.json");
    expect(data.toString()).toBe('{"hello":"world"}');
  });

  it("should list artifacts for a tenant", async () => {
    const store = new FileSystemArtifactStore(basePath);
    await store.put("t1", "a.txt", "a", "text/plain");
    await store.put("t1", "b.txt", "b", "text/plain");

    const list = await store.list("t1");
    expect(list.map((a) => a.name).sort()).toEqual(["a.txt", "b.txt"]);
  });

  it("should filter list by prefix", async () => {
    const store = new FileSystemArtifactStore(basePath);
    await store.put("t1", "logs/1.txt", "1", "text/plain");
    await store.put("t1", "notes/1.txt", "1", "text/plain");

    const list = await store.list("t1", "logs/");
    expect(list.map((a) => a.name)).toEqual(["logs/1.txt"]);
  });

  it("should delete an artifact", async () => {
    const store = new FileSystemArtifactStore(basePath);
    await store.put("t1", "tmp.txt", "tmp", "text/plain");
    expect(await store.exists("t1", "tmp.txt")).toBe(true);

    await store.delete("t1", "tmp.txt");
    expect(await store.exists("t1", "tmp.txt")).toBe(false);
  });

  it("should return empty list for unknown tenant", async () => {
    const store = new FileSystemArtifactStore(basePath);
    const list = await store.list("unknown");
    expect(list).toEqual([]);
  });

  it("should enforce storage quota", async () => {
    const quota: StorageQuota = { maxBytes: 10, maxCount: 2 };
    const store = new FileSystemArtifactStore(basePath, quota);

    await store.put("t1", "small.txt", "12345", "text/plain");
    await store.put("t1", "small2.txt", "12345", "text/plain");

    await expect(store.put("t1", "big.txt", "12345678901", "text/plain")).rejects.toThrow(
      "quota exceeded"
    );

    await expect(store.put("t1", "third.txt", "1", "text/plain")).rejects.toThrow("quota exceeded");
  });

  it("should isolate tenants", async () => {
    const store = new FileSystemArtifactStore(basePath);
    await store.put("t1", "file.txt", "t1-data", "text/plain");
    await store.put("t2", "file.txt", "t2-data", "text/plain");

    expect((await store.get("t1", "file.txt")).toString()).toBe("t1-data");
    expect((await store.get("t2", "file.txt")).toString()).toBe("t2-data");
  });

  describe("path traversal", () => {
    it("rejects names that escape via ..", async () => {
      const store = new FileSystemArtifactStore(basePath);
      await store.put("t1", "file.txt", "t1-data", "text/plain");

      await expect(store.get("t2", "../t1/file.txt")).rejects.toThrow(/Invalid artifact name/);
      await expect(store.put("t2", "../t1/pwned.txt", "nope", "text/plain")).rejects.toThrow(
        /Invalid artifact name/
      );
      await expect(store.delete("t2", "../t1/file.txt")).rejects.toThrow(/Invalid artifact name/);
    });

    it("rejects absolute names", async () => {
      const store = new FileSystemArtifactStore(basePath);
      await expect(store.get("t1", "/etc/passwd")).rejects.toThrow(/Invalid artifact name/);
    });

    it("rejects tenantIds with separators or traversal", async () => {
      const store = new FileSystemArtifactStore(basePath);
      await expect(store.put("../etc", "x", "y", "text/plain")).rejects.toThrow(/Invalid tenantId/);
      await expect(store.get("a/b", "x")).rejects.toThrow(/Invalid tenantId/);
      await expect(store.list("..")).rejects.toThrow(/Invalid tenantId/);
    });

    it("rejects NUL bytes", async () => {
      const store = new FileSystemArtifactStore(basePath);
      await expect(store.get("t1", "file\0hidden")).rejects.toThrow(/NUL byte/);
      await expect(store.put("t1\0x", "x", "y", "text/plain")).rejects.toThrow(/NUL byte/);
    });
  });
});
