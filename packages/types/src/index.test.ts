import { describe, expect, it } from 'vitest';
import { MiddlewareError, MiddlewareErrorCode } from './index.js';

describe('MiddlewareError', () => {
  it('should carry code, message, and optional data', () => {
    const err = new MiddlewareError(MiddlewareErrorCode.RateLimitExceeded, 'too many requests', {
      tenantId: 't-1',
    });

    expect(err.code).toBe(-32002);
    expect(err.message).toBe('too many requests');
    expect(err.data).toEqual({ tenantId: 't-1' });
    expect(err.name).toBe('MiddlewareError');
  });
});

describe('MiddlewareErrorCode', () => {
  it('should have expected numeric values', () => {
    expect(MiddlewareErrorCode.Unauthorized).toBe(-32001);
    expect(MiddlewareErrorCode.RateLimitExceeded).toBe(-32002);
    expect(MiddlewareErrorCode.ToolForbidden).toBe(-32003);
    expect(MiddlewareErrorCode.ResourceForbidden).toBe(-32004);
    expect(MiddlewareErrorCode.PromptForbidden).toBe(-32005);
    expect(MiddlewareErrorCode.InternalError).toBe(-32603);
  });
});
