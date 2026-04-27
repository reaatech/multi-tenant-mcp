import { describe, expect, it } from "vitest";
import { BoundedMap } from "./bounded-map.js";

describe("BoundedMap", () => {
  it("should store and retrieve values", () => {
    const map = new BoundedMap<string, number>(5);
    map.set("a", 1);
    map.set("b", 2);

    expect(map.get("a")).toBe(1);
    expect(map.get("b")).toBe(2);
    expect(map.has("a")).toBe(true);
    expect(map.has("c")).toBe(false);
  });

  it("should evict LRU entry when capacity is exceeded", () => {
    const map = new BoundedMap<string, number>(2);
    map.set("a", 1);
    map.set("b", 2);
    map.set("c", 3);

    expect(map.has("a")).toBe(false);
    expect(map.has("b")).toBe(true);
    expect(map.has("c")).toBe(true);
  });

  it("should iterate over entries", () => {
    const map = new BoundedMap<string, number>(5);
    map.set("a", 1);
    map.set("b", 2);
    map.set("c", 3);

    const entries = [...map.entries()];
    expect(entries).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });

  it("should clear all entries", () => {
    const map = new BoundedMap<string, number>(5);
    map.set("a", 1);
    map.set("b", 2);

    expect(map.size).toBe(2);

    map.clear();

    expect(map.size).toBe(0);
    expect(map.get("a")).toBeUndefined();
    expect(map.get("b")).toBeUndefined();
  });

  it("should delete a specific entry", () => {
    const map = new BoundedMap<string, number>(5);
    map.set("a", 1);
    map.set("b", 2);

    expect(map.delete("a")).toBe(true);
    expect(map.has("a")).toBe(false);
    expect(map.size).toBe(1);
    expect(map.delete("a")).toBe(false);
  });

  it("should reject invalid maxSize", () => {
    expect(() => new BoundedMap(0)).toThrow(/positive integer/);
    expect(() => new BoundedMap(-1)).toThrow(/positive integer/);
    expect(() => new BoundedMap(Infinity)).toThrow(/positive integer/);
    expect(() => new BoundedMap(NaN)).toThrow(/positive integer/);
  });

  it("should update existing key without eviction", () => {
    const map = new BoundedMap<string, number>(2);
    map.set("a", 1);
    map.set("b", 2);
    map.set("a", 10);

    expect(map.get("a")).toBe(10);
    expect(map.size).toBe(2);
  });
});
