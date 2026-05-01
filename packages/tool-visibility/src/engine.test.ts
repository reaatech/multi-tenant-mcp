import { describe, expect, it } from 'vitest';
import { VisibilityEngineImpl } from './engine.js';
import type { ToolVisibilityPolicy } from './types.js';

describe('VisibilityEngineImpl', () => {
  const policies: Record<string, ToolVisibilityPolicy> = {
    'tenant-a': { type: 'allow', items: ['tool-1', 'tool-2'] },
    'tenant-b': { type: 'deny', items: ['tool-1'] },
  };

  it('should allow-list correctly', async () => {
    const engine = new VisibilityEngineImpl(policies);
    const result = await engine.filter(['tool-1', 'tool-2', 'tool-3'], 'tenant-a');
    expect(result).toEqual(['tool-1', 'tool-2']);
  });

  it('should deny-list correctly', async () => {
    const engine = new VisibilityEngineImpl(policies);
    const result = await engine.filter(['tool-1', 'tool-2', 'tool-3'], 'tenant-b');
    expect(result).toEqual(['tool-2', 'tool-3']);
  });

  it('should default to visible when no policy exists', async () => {
    const engine = new VisibilityEngineImpl(policies);
    const result = await engine.filter(['tool-1'], 'unknown-tenant');
    expect(result).toEqual(['tool-1']);
  });

  it('should default to hidden when defaultVisible is false', async () => {
    const engine = new VisibilityEngineImpl(policies, false);
    const result = await engine.filter(['tool-1'], 'unknown-tenant');
    expect(result).toEqual([]);
  });

  it('should support dynamic evaluation', async () => {
    const dynamicPolicies: Record<string, ToolVisibilityPolicy> = {
      'tenant-c': {
        type: 'dynamic',
        evaluator: (name) => name.startsWith('allowed-'),
      },
    };

    const engine = new VisibilityEngineImpl(dynamicPolicies);
    const result = await engine.filter(['allowed-x', 'blocked-y'], 'tenant-c');
    expect(result).toEqual(['allowed-x']);
  });

  it('should check single item visibility', async () => {
    const engine = new VisibilityEngineImpl(policies);
    expect(await engine.isVisible('tool-1', 'tenant-a')).toBe(true);
    expect(await engine.isVisible('tool-3', 'tenant-a')).toBe(false);
  });
});
