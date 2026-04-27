import { describe, expect, it } from "vitest";
import { DefaultCostCalculator } from "./calculator.js";
import type { CostAccount, UsageEvent } from "./types.js";

describe("DefaultCostCalculator", () => {
  const baseAccount: CostAccount = {
    tenantId: "t1",
    totalCost: 0,
    totalCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
  };

  it("should calculate per-call pricing", () => {
    const calc = new DefaultCostCalculator({
      perCall: { "tool-a": 0.05 },
    });

    const event: UsageEvent = {
      tenantId: "t1",
      itemName: "tool-a",
      itemType: "tool",
      timestamp: new Date(),
    };

    expect(calc.calculate(event, baseAccount)).toBe(0.05);
  });

  it("should calculate per-token pricing", () => {
    const calc = new DefaultCostCalculator({
      perToken: { input: 0.001, output: 0.002 },
    });

    const event: UsageEvent = {
      tenantId: "t1",
      itemName: "tool-a",
      itemType: "tool",
      inputTokens: 100,
      outputTokens: 50,
      timestamp: new Date(),
    };

    expect(calc.calculate(event, baseAccount)).toBe(100 * 0.001 + 50 * 0.002);
  });

  it("should combine per-call and per-token pricing", () => {
    const calc = new DefaultCostCalculator({
      perCall: { "tool-a": 0.01 },
      perToken: { input: 0.001, output: 0.002 },
    });

    const event: UsageEvent = {
      tenantId: "t1",
      itemName: "tool-a",
      itemType: "tool",
      inputTokens: 10,
      outputTokens: 5,
      timestamp: new Date(),
    };

    expect(calc.calculate(event, baseAccount)).toBe(0.01 + 10 * 0.001 + 5 * 0.002);
  });

  it("should apply tiered discounts", () => {
    const calc = new DefaultCostCalculator({
      perCall: { "tool-a": 1.0 },
      tiers: [
        { upTo: 5, discount: 0 },
        { upTo: 10, discount: 0.1 },
        { upTo: Infinity, discount: 0.2 },
      ],
    });

    const cheapEvent: UsageEvent = {
      tenantId: "t1",
      itemName: "tool-a",
      itemType: "tool",
      timestamp: new Date(),
    };

    // 6th call → 10% discount tier
    const account: CostAccount = { ...baseAccount, totalCalls: 5 };
    expect(calc.calculate(cheapEvent, account)).toBe(0.9);

    // 11th call → 20% discount tier
    const account2: CostAccount = { ...baseAccount, totalCalls: 10 };
    expect(calc.calculate(cheapEvent, account2)).toBe(0.8);
  });

  it("should return 0 when no pricing matches", () => {
    const calc = new DefaultCostCalculator({});
    const event: UsageEvent = {
      tenantId: "t1",
      itemName: "tool-a",
      itemType: "tool",
      timestamp: new Date(),
    };

    expect(calc.calculate(event, baseAccount)).toBe(0);
  });
});
