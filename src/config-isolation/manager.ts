import type { TenantConfig, TenantConfigStore, ConfigValidator } from "./types.js";

/**
 * Deep-clones a config object to ensure runtime isolation between
 * tenants. Uses `structuredClone` (Node 17+), which preserves Date,
 * Map, Set, and typed arrays and detects cycles. Functions and
 * class instances are unsupported and will throw.
 */
function deepClone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Deep-merges two plain objects. `overrides` takes precedence.
 */
function deepMerge(base: TenantConfig, overrides: TenantConfig): TenantConfig {
  const result: TenantConfig = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key] as TenantConfig, value as TenantConfig);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Manages tenant configurations with validation, inheritance, and runtime isolation.
 */
export class TenantConfigManager {
  constructor(
    private readonly store: TenantConfigStore,
    private readonly validator?: ConfigValidator,
    private readonly baseConfig: TenantConfig = {}
  ) {}

  /**
   * Retrieve the effective configuration for a tenant.
   *
   * The effective config is `baseConfig` deep-merged with the tenant's
   * stored overrides. The result is deep-cloned to prevent mutations
   * from leaking across boundaries.
   */
  async get(tenantId: string): Promise<TenantConfig> {
    const stored = await this.store.get(tenantId);
    const effective = stored ? deepMerge(this.baseConfig, stored) : deepClone(this.baseConfig);
    return deepClone(effective);
  }

  /**
   * Store configuration for a tenant.
   *
   * The config is validated (if a validator is configured) and deep-cloned
   * before storage to ensure isolation.
   */
  async set(tenantId: string, config: TenantConfig): Promise<void> {
    const toStore = this.validator ? this.validator.validate(config) : config;
    await this.store.set(tenantId, deepClone(toStore));
  }

  /**
   * Delete a tenant's configuration.
   */
  async delete(tenantId: string): Promise<void> {
    await this.store.delete(tenantId);
  }
}
