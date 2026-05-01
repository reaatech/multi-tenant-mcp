import type { ZodType } from 'zod';
import type { ConfigValidator, TenantConfig } from './types.js';

/**
 * Validates tenant configurations using a Zod schema.
 */
export class ZodConfigValidator implements ConfigValidator {
  constructor(private readonly schema: ZodType) {}

  validate(config: unknown): TenantConfig {
    return this.schema.parse(config) as TenantConfig;
  }
}
