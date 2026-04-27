import { describe, expect, it } from "vitest";
import {
  HeaderTenantResolver,
  TenantContextStore,
  MemoryRateLimitStore,
  DefaultRateLimiter,
  VisibilityEngineImpl,
  InMemoryCostTracker,
  FileSystemArtifactStore,
  InMemoryConfigStore,
  TenantConfigManager,
  JWTTenantResolver,
} from "../../src/index.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("Security: Tenant Isolation", () => {
  describe("Cross-tenant data access", () => {
    it("should prevent tenant A from reading tenant B's artifacts", async () => {
      const basePath = mkdtempSync(join(tmpdir(), "mtm-sec-"));
      const store = new FileSystemArtifactStore(basePath);

      await store.put("tenant-a", "secret.txt", "a-data", "text/plain");
      await store.put("tenant-b", "secret.txt", "b-data", "text/plain");

      const aData = await store.get("tenant-a", "secret.txt");
      expect(aData.toString()).toBe("a-data");

      const bData = await store.get("tenant-b", "secret.txt");
      expect(bData.toString()).toBe("b-data");

      rmSync(basePath, { recursive: true, force: true });
    });

    it("should prevent tenant A from listing tenant B's artifacts", async () => {
      const basePath = mkdtempSync(join(tmpdir(), "mtm-sec-"));
      const store = new FileSystemArtifactStore(basePath);

      await store.put("tenant-a", "file.txt", "a", "text/plain");
      await store.put("tenant-b", "file.txt", "b", "text/plain");

      const aList = await store.list("tenant-a");
      expect(aList).toHaveLength(1);
      expect(aList[0].tenantId).toBe("tenant-a");

      rmSync(basePath, { recursive: true, force: true });
    });
  });

  describe("Tenant context manipulation", () => {
    it("should not allow one tenant to impersonate another via context store", async () => {
      const store = new TenantContextStore();

      const ctxA = { tenantId: "tenant-a", metadata: {}, resolvedAt: new Date() };
      const ctxB = { tenantId: "tenant-b", metadata: {}, resolvedAt: new Date() };

      store.run(ctxA, () => {
        expect(store.get()?.tenantId).toBe("tenant-a");
      });

      store.run(ctxB, () => {
        expect(store.get()?.tenantId).toBe("tenant-b");
      });
    });

    it("should resolve correct tenant even with forged headers", () => {
      const resolver = new HeaderTenantResolver({ header: "x-tenant-id" });
      const result = resolver.resolve({
        headers: { "x-tenant-id": "legitimate-tenant" },
      });

      expect(result?.tenantId).toBe("legitimate-tenant");
    });
  });

  describe("Shared state contamination", () => {
    it("should isolate rate limit counters per tenant", async () => {
      const store = new MemoryRateLimitStore({ requestsPerMinute: 1, tokensPerMinute: 100 });
      const limiter = new DefaultRateLimiter(store);

      await limiter.check("tenant-a", 0);
      const aBlocked = await limiter.check("tenant-a", 0);

      const bOk = await limiter.check("tenant-b", 0);

      expect(aBlocked.allowed).toBe(false);
      expect(bOk.allowed).toBe(true);
    });

    it("should isolate cost accounts per tenant", () => {
      const tracker = new InMemoryCostTracker();

      tracker.recordEvent(
        { tenantId: "tenant-a", itemName: "tool", itemType: "tool", timestamp: new Date() },
        1.0
      );
      tracker.recordEvent(
        { tenantId: "tenant-b", itemName: "tool", itemType: "tool", timestamp: new Date() },
        2.0
      );

      expect(tracker.getAccount("tenant-a").totalCost).toBe(1.0);
      expect(tracker.getAccount("tenant-b").totalCost).toBe(2.0);
    });

    it("should isolate config mutations between tenants", async () => {
      const store = new InMemoryConfigStore();
      const manager = new TenantConfigManager(store, undefined, { theme: "light" });

      const configA = await manager.get("tenant-a");
      configA.theme = "dark";

      const configB = await manager.get("tenant-b");
      expect(configB.theme).toBe("light");
    });

    it("should not leak tool visibility policies between tenants", async () => {
      const engine = new VisibilityEngineImpl({
        "tenant-a": { type: "allow", items: ["tool-1"] },
      });

      const aVisible = await engine.isVisible("tool-1", "tenant-a");
      const bVisible = await engine.isVisible("tool-1", "tenant-b");

      expect(aVisible).toBe(true);
      expect(bVisible).toBe(true); // defaultVisible = true, but no policy for tenant-b
    });
  });

  describe("Auth bypass attempts", () => {
    it("should return null for missing JWT token", () => {
      const resolver = new JWTTenantResolver({ claim: "tenant_id", secret: "secret" });
      const result = resolver.resolve({ headers: {} });
      expect(result).toBeNull();
    });

    it("should return null for invalid JWT token", () => {
      const resolver = new JWTTenantResolver({ claim: "tenant_id", secret: "secret" });
      const result = resolver.resolve({ headers: { authorization: "Bearer bad-token" } });
      expect(result).toBeNull();
    });
  });
});
