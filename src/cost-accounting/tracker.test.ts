import { describe, expect, it } from "vitest";
import { InMemoryCostTracker } from "./tracker.js";
import { DefaultCostCalculator } from "./calculator.js";
import type { UsageEvent } from "./types.js";

describe("InMemoryCostTracker", () => {
  it("should start with zero costs", () => {
    const tracker = new InMemoryCostTracker();
    const account = tracker.getAccount("t1");

    expect(account).toEqual({
      tenantId: "t1",
      totalCost: 0,
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    });
  });

  it("should accumulate costs per tenant", () => {
    const tracker = new InMemoryCostTracker();
    const event: UsageEvent = {
      tenantId: "t1",
      itemName: "tool-a",
      itemType: "tool",
      inputTokens: 100,
      outputTokens: 50,
      timestamp: new Date(),
    };

    tracker.recordEvent(event, 0.5);
    tracker.recordEvent(event, 0.3);

    const account = tracker.getAccount("t1");
    expect(account.totalCost).toBe(0.8);
    expect(account.totalCalls).toBe(2);
    expect(account.totalInputTokens).toBe(200);
    expect(account.totalOutputTokens).toBe(100);
  });

  it("should isolate tenant accounts", () => {
    const tracker = new InMemoryCostTracker();
    const event1: UsageEvent = {
      tenantId: "t1",
      itemName: "tool-a",
      itemType: "tool",
      timestamp: new Date(),
    };
    const event2: UsageEvent = {
      tenantId: "t2",
      itemName: "tool-b",
      itemType: "tool",
      timestamp: new Date(),
    };

    tracker.recordEvent(event1, 1.0);
    tracker.recordEvent(event2, 2.0);

    expect(tracker.getAccount("t1").totalCost).toBe(1.0);
    expect(tracker.getAccount("t2").totalCost).toBe(2.0);
  });

  it("should calculate and record cost atomically via record()", () => {
    const calculator = new DefaultCostCalculator({
      perCall: { "tool-a": 0.05 },
      perToken: { input: 0.001, output: 0.002 },
    });
    const tracker = new InMemoryCostTracker({ calculator });

    const event: UsageEvent = {
      tenantId: "t1",
      itemName: "tool-a",
      itemType: "tool",
      inputTokens: 100,
      outputTokens: 50,
      timestamp: new Date(),
    };

    const cost = tracker.record(event);

    expect(cost).toBe(0.05 + 100 * 0.001 + 50 * 0.002);

    const account = tracker.getAccount("t1");
    expect(account.totalCost).toBe(cost);
    expect(account.totalCalls).toBe(1);
    expect(account.totalInputTokens).toBe(100);
    expect(account.totalOutputTokens).toBe(50);
  });

  it("should throw from record() when no calculator is configured", () => {
    const tracker = new InMemoryCostTracker();
    const event: UsageEvent = {
      tenantId: "t1",
      itemName: "tool-a",
      itemType: "tool",
      timestamp: new Date(),
    };

    expect(() => tracker.record(event)).toThrow(/calculator/);
  });
});
