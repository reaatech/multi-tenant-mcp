import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodConfigValidator } from './validator.js';

describe('ZodConfigValidator', () => {
  it('should validate a matching config', () => {
    const schema = z.object({ theme: z.string(), apiVersion: z.number() });
    const validator = new ZodConfigValidator(schema);

    const result = validator.validate({ theme: 'dark', apiVersion: 2 });
    expect(result).toEqual({ theme: 'dark', apiVersion: 2 });
  });

  it('should throw on invalid config', () => {
    const schema = z.object({ theme: z.string() });
    const validator = new ZodConfigValidator(schema);

    expect(() => validator.validate({ theme: 123 })).toThrow();
  });

  it('should throw on missing fields', () => {
    const schema = z.object({ theme: z.string() });
    const validator = new ZodConfigValidator(schema);

    expect(() => validator.validate({})).toThrow();
  });
});
