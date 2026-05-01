import type { TenantConfig, TenantConfigStore } from './types.js';

/**
 * In-memory tenant configuration store for development and testing.
 */
export class InMemoryConfigStore implements TenantConfigStore {
  private readonly configs = new Map<string, TenantConfig>();

  get(tenantId: string): Promise<TenantConfig | null> {
    return Promise.resolve(this.configs.get(tenantId) ?? null);
  }

  set(tenantId: string, config: TenantConfig): Promise<void> {
    this.configs.set(tenantId, { ...config });
    return Promise.resolve();
  }

  delete(tenantId: string): Promise<void> {
    this.configs.delete(tenantId);
    return Promise.resolve();
  }
}
