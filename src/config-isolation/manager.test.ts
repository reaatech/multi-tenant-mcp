import { describe, expect, it } from "vitest";
import { z } from "zod";
import { TenantConfigManager } from "./manager.js";
import { InMemoryConfigStore } from "./memory-store.js";
import { ZodConfigValidator } from "./validator.js";

describe("TenantConfigManager", () => {
  it("should return base config when no tenant config exists", async () => {
    const store = new InMemoryConfigStore();
    const manager = new TenantConfigManager(store, undefined, { theme: "light", debug: false });

    const config = await manager.get("t1");
    expect(config).toEqual({ theme: "light", debug: false });
  });

  it("should deep-merge tenant overrides with base config", async () => {
    const store = new InMemoryConfigStore();
    const manager = new TenantConfigManager(store, undefined, {
      theme: "light",
      features: { a: true, b: false },
    });

    await manager.set("t1", { theme: "dark", features: { b: true } });
    const config = await manager.get("t1");

    expect(config).toEqual({
      theme: "dark",
      features: { a: true, b: true },
    });
  });

  it("should deep-clone configs to prevent mutation leakage", async () => {
    const store = new InMemoryConfigStore();
    const manager = new TenantConfigManager(store, undefined, { nested: { value: 1 } });

    const config1 = await manager.get("t1");
    config1.nested.value = 999;

    const config2 = await manager.get("t1");
    expect(config2.nested.value).toBe(1);
  });

  it("should validate configs before storage", async () => {
    const store = new InMemoryConfigStore();
    const validator = new ZodConfigValidator(z.object({ theme: z.string() }));
    const manager = new TenantConfigManager(store, validator);

    await expect(manager.set("t1", { theme: 123 })).rejects.toThrow();
    await expect(manager.set("t1", { theme: "dark" })).resolves.toBeUndefined();
  });

  it("should isolate tenant configs", async () => {
    const store = new InMemoryConfigStore();
    const manager = new TenantConfigManager(store);

    await manager.set("t1", { key: "a" });
    await manager.set("t2", { key: "b" });

    expect(await manager.get("t1")).toEqual({ key: "a" });
    expect(await manager.get("t2")).toEqual({ key: "b" });
  });

  it("should delete tenant config and fall back to base", async () => {
    const store = new InMemoryConfigStore();
    const manager = new TenantConfigManager(store, undefined, { theme: "light" });

    await manager.set("t1", { theme: "dark" });
    await manager.delete("t1");

    const config = await manager.get("t1");
    expect(config).toEqual({ theme: "light" });
  });
});
