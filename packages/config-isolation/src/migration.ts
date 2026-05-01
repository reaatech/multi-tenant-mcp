import type { TenantConfig } from './types.js';

/**
 * A single configuration migration.
 */
export interface ConfigMigration {
  /** Semantic version this migration targets (e.g., "1.1.0") */
  readonly version: string;
  /** Migrate a config from the previous version to this version. */
  migrate(config: TenantConfig): TenantConfig;
}

/**
 * Runs config migrations in version order.
 */
export class ConfigMigrationRunner {
  constructor(private readonly migrations: readonly ConfigMigration[]) {}

  /**
   * Apply all migrations with a version greater than `currentVersion`.
   *
   * @param config - Current configuration object
   * @param currentVersion - Semantic version of the current config
   * @returns Migrated configuration and its new version
   */
  run(config: TenantConfig, currentVersion: string): { config: TenantConfig; version: string } {
    const sorted = [...this.migrations].sort((a, b) => this.compareVersions(a.version, b.version));

    let result = config;
    let lastVersion = currentVersion;

    for (const migration of sorted) {
      if (this.compareVersions(migration.version, currentVersion) > 0) {
        result = migration.migrate(result);
        lastVersion = migration.version;
      }
    }

    return { config: result, version: lastVersion };
  }

  private compareVersions(a: string, b: string): number {
    const parse = (v: string): number[] => v.split('.').map(Number);
    const av = parse(a);
    const bv = parse(b);
    for (let i = 0; i < Math.max(av.length, bv.length); i++) {
      const diff = (av[i] ?? 0) - (bv[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }
}
