import { describe, expect, it } from 'vitest';
import type { ConfigMigration } from './migration.js';
import { ConfigMigrationRunner } from './migration.js';

describe('ConfigMigrationRunner', () => {
  it('should apply migrations in order', () => {
    const migrations: ConfigMigration[] = [
      {
        version: '1.1.0',
        migrate: (config) => ({ ...config, featureB: true }),
      },
      {
        version: '1.2.0',
        migrate: (config) => ({ ...config, featureC: true }),
      },
    ];

    const runner = new ConfigMigrationRunner(migrations);
    const result = runner.run({ featureA: true }, '1.0.0');

    expect(result.config).toEqual({
      featureA: true,
      featureB: true,
      featureC: true,
    });
    expect(result.version).toBe('1.2.0');
  });

  it('should skip migrations older than current version', () => {
    const migrations: ConfigMigration[] = [
      {
        version: '1.0.0',
        migrate: () => ({ upgraded: false }),
      },
      {
        version: '1.1.0',
        migrate: (config) => ({ ...config, upgraded: true }),
      },
    ];

    const runner = new ConfigMigrationRunner(migrations);
    const result = runner.run({ existing: true }, '1.0.0');

    expect(result.config).toEqual({ existing: true, upgraded: true });
  });

  it('should skip all migrations when already at latest version', () => {
    const migrations: ConfigMigration[] = [
      {
        version: '1.1.0',
        migrate: () => ({ changed: true }),
      },
    ];

    const runner = new ConfigMigrationRunner(migrations);
    const result = runner.run({ existing: true }, '1.1.0');

    expect(result.config).toEqual({ existing: true });
  });

  it('should handle out-of-order migration definitions', () => {
    const migrations: ConfigMigration[] = [
      {
        version: '1.2.0',
        migrate: (config) => ({ ...config, step: 2 }),
      },
      {
        version: '1.1.0',
        migrate: (config) => ({ ...config, step: 1 }),
      },
    ];

    const runner = new ConfigMigrationRunner(migrations);
    const result = runner.run({ step: 0 }, '1.0.0');

    expect(result.config).toEqual({ step: 2 });
  });
});
