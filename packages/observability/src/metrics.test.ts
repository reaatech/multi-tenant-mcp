import { describe, expect, it } from 'vitest';
import { MetricsCollector } from './metrics.js';

describe('MetricsCollector', () => {
  it('should track counters with labels', () => {
    const metrics = new MetricsCollector();
    metrics.requests.increment({ method: 'tools/call' });
    metrics.requests.increment({ method: 'tools/call' });
    metrics.requests.increment({ method: 'tools/list' });

    expect(metrics.requests.getValue({ method: 'tools/call' })).toBe(2);
    expect(metrics.requests.getValue({ method: 'tools/list' })).toBe(1);
  });

  it('should return a snapshot of all metrics', () => {
    const metrics = new MetricsCollector();
    metrics.requests.increment({ method: 'a' });
    metrics.rateLimitHits.increment({ tenantId: 't1' });
    metrics.toolUsage.increment({ tool: 'x' });
    metrics.errors.increment({ type: 'fail' });

    const snapshot = metrics.snapshot();
    expect(Object.keys(snapshot.requests)).toHaveLength(1);
    expect(Object.keys(snapshot.rateLimitHits)).toHaveLength(1);
    expect(Object.keys(snapshot.toolUsage)).toHaveLength(1);
    expect(Object.keys(snapshot.errors)).toHaveLength(1);
  });

  it('should default to zero for unseen labels', () => {
    const metrics = new MetricsCollector();
    expect(metrics.requests.getValue({ method: 'unknown' })).toBe(0);
  });
});
