/**
 * Generic tenant configuration object.
 */
export type TenantConfig = Record<string, unknown>;

/**
 * Validates a tenant configuration object against a schema.
 */
export interface ConfigValidator {
  validate(config: unknown): TenantConfig;
}

/**
 * Storage for tenant-specific configurations.
 */
export interface TenantConfigStore {
  /**
   * Retrieve configuration for a tenant.
   *
   * @returns The tenant configuration, or `null` if not found.
   */
  get(tenantId: string): Promise<TenantConfig | null>;

  /**
   * Store configuration for a tenant.
   */
  set(tenantId: string, config: TenantConfig): Promise<void>;

  /**
   * Delete a tenant's configuration.
   */
  delete(tenantId: string): Promise<void>;
}
