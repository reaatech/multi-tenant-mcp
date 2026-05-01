import { describe, expect, it } from 'vitest';
import { CallbackUsageEmitter } from './emitter.js';
import type { UsageEvent } from './types.js';

describe('CallbackUsageEmitter', () => {
  it('should invoke callback with event', async () => {
    const events: UsageEvent[] = [];
    const emitter = new CallbackUsageEmitter(async (event) => {
      events.push(event);
    });

    const event: UsageEvent = {
      tenantId: 't1',
      itemName: 'tool-a',
      itemType: 'tool',
      timestamp: new Date(),
    };

    await emitter.emit(event);
    expect(events).toHaveLength(1);
    expect(events[0].tenantId).toBe('t1');
  });

  it('should handle synchronous callbacks', async () => {
    const events: UsageEvent[] = [];
    const emitter = new CallbackUsageEmitter((event) => {
      events.push(event);
    });

    const event: UsageEvent = {
      tenantId: 't1',
      itemName: 'tool-a',
      itemType: 'tool',
      timestamp: new Date(),
    };

    await emitter.emit(event);
    expect(events).toHaveLength(1);
  });
});
