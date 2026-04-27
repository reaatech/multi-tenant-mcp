/**
 * Map with a hard size cap and LRU eviction. Writing a key moves it to
 * the most-recently-used position; when the cap is exceeded, the
 * least-recently-used entry is dropped.
 *
 * Used by in-memory stores (cost tracker, rate limiter, metrics) so a
 * caller that can influence the key space cannot grow memory without
 * bound.
 */
export class BoundedMap<K, V> {
  private readonly map = new Map<K, V>();

  constructor(private readonly maxSize: number) {
    if (!Number.isFinite(maxSize) || maxSize < 1) {
      throw new Error(`BoundedMap maxSize must be a positive integer, got ${String(maxSize)}`);
    }
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, value);
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  get size(): number {
    return this.map.size;
  }

  *entries(): IterableIterator<[K, V]> {
    yield* this.map.entries();
  }

  clear(): void {
    this.map.clear();
  }
}
