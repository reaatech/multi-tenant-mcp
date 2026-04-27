import { BoundedMap } from "../types/bounded-map.js";

/**
 * Simple counter metric.
 */
export interface Counter {
  increment(labels?: Record<string, string>): void;
  getValue(labels?: Record<string, string>): number;
  /** All label combinations with current counts. Insertion-ordered. */
  entries(): Record<string, number>;
}

const DEFAULT_MAX_LABEL_COMBOS = 10_000;

/**
 * In-memory counter implementation with a bounded number of distinct
 * label combinations (LRU eviction when exceeded).
 */
class InMemoryCounter implements Counter {
  private readonly values: BoundedMap<string, number>;

  constructor(maxCombinations: number) {
    this.values = new BoundedMap(maxCombinations);
  }

  increment(labels?: Record<string, string>): void {
    const key = this.key(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + 1);
  }

  getValue(labels?: Record<string, string>): number {
    return this.values.get(this.key(labels)) ?? 0;
  }

  private key(labels?: Record<string, string>): string {
    if (!labels) return "_default";
    const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(sorted);
  }

  entries(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of this.values.entries()) {
      result[key] = value;
    }
    return result;
  }
}

export interface MetricsCollectorOptions {
  /**
   * Maximum distinct label combinations retained per counter. Caps
   * memory when caller-supplied labels (e.g., `tenantId`) could
   * otherwise grow without bound. Defaults to 10_000 per counter.
   */
  readonly maxLabelCombinations?: number;
}

/**
 * Collects metrics for multi-tenant MCP operations.
 */
export class MetricsCollector {
  readonly requests: Counter;
  readonly rateLimitHits: Counter;
  readonly toolUsage: Counter;
  readonly errors: Counter;

  constructor(options: MetricsCollectorOptions = {}) {
    const cap = options.maxLabelCombinations ?? DEFAULT_MAX_LABEL_COMBOS;
    this.requests = new InMemoryCounter(cap);
    this.rateLimitHits = new InMemoryCounter(cap);
    this.toolUsage = new InMemoryCounter(cap);
    this.errors = new InMemoryCounter(cap);
  }

  snapshot(): Record<string, Record<string, number>> {
    return {
      requests: this.requests.entries(),
      rateLimitHits: this.rateLimitHits.entries(),
      toolUsage: this.toolUsage.entries(),
      errors: this.errors.entries(),
    };
  }
}
