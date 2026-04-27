import { describe, expect, it } from "vitest";
import { InMemoryConfigStore } from "./memory-store.js";

describe("InMemoryConfigStore", () => {
  it("should store and retrieve config", async () => {
    const store = new InMemoryConfigStore();
    await store.set("t1", { theme: "dark", apiVersion: 2 });

    const config = await store.get("t1");
    expect(config).toEqual({ theme: "dark", apiVersion: 2 });
  });

  it("should return null for missing tenant", async () => {
    const store = new InMemoryConfigStore();
    const config = await store.get("missing");
    expect(config).toBeNull();
  });

  it("should delete config", async () => {
    const store = new InMemoryConfigStore();
    await store.set("t1", { key: "value" });
    await store.delete("t1");

    const config = await store.get("t1");
    expect(config).toBeNull();
  });

  it("should isolate tenant configs", async () => {
    const store = new InMemoryConfigStore();
    await store.set("t1", { a: 1 });
    await store.set("t2", { b: 2 });

    expect(await store.get("t1")).toEqual({ a: 1 });
    expect(await store.get("t2")).toEqual({ b: 2 });
  });
});
