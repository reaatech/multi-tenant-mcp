import { describe, expect, it } from "vitest";
import { DefaultCostCalculator } from "../../src/cost-accounting/calculator.js";
import type { CostAccount, UsageEvent } from "../../src/cost-accounting/types.js";

describe("Property-based: Cost calculation accuracy", () => {
  const baseAccount: CostAccount = {
    tenantId: "t1",
    totalCost: 0,
    totalCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
  };

  function randomEvent(inputTokens: number, outputTokens: number): UsageEvent {
    return {
      tenantId: "t1",
      itemName: "tool-a",
      itemType: "tool",
      inputTokens,
      outputTokens,
      timestamp: new Date(),
    };
  }

  it("should never produce negative costs", () => {
    const calc = new DefaultCostCalculator({
      perCall: { "tool-a": 0.01 },
      perToken: { input: 0.001, output: 0.002 },
    });

    for (let i = 0; i < 100; i++) {
      const input = Math.floor(Math.random() * 10000);
      const output = Math.floor(Math.random() * 10000);
      const cost = calc.calculate(randomEvent(input, output), baseAccount);
      expect(cost).toBeGreaterThanOrEqual(0);
    }
  });

  it("should be linear with respect to token counts (no tiers)", () => {
    const calc = new DefaultCostCalculator({
      perToken: { input: 0.001, output: 0.002 },
    });

    const cost1 = calc.calculate(randomEvent(100, 50), baseAccount);
    const cost2 = calc.calculate(randomEvent(200, 100), baseAccount);

    // Doubling tokens should double cost
    expect(cost2).toBeCloseTo(cost1 * 2, 10);
  });

  it("should apply tiered discounts monotonically", () => {
    const calc = new DefaultCostCalculator({
      perCall: { "tool-a": 1.0 },
      tiers: [
        { upTo: 10, discount: 0 },
        { upTo: 20, discount: 0.1 },
        { upTo: Infinity, discount: 0.2 },
      ],
    });

    const costs: number[] = [];
    for (let calls = 0; calls < 30; calls++) {
      const account: CostAccount = { ...baseAccount, totalCalls: calls };
      costs.push(calc.calculate(randomEvent(0, 0), account));
    }

    // First 10 calls: full price
    for (let i = 0; i < 10; i++) {
      expect(costs[i]).toBe(1.0);
    }

    // Calls 11-20: 10% discount
    for (let i = 10; i < 20; i++) {
      expect(costs[i]).toBeCloseTo(0.9, 10);
    }

    // Calls 21+: 20% discount
    for (let i = 20; i < 30; i++) {
      expect(costs[i]).toBeCloseTo(0.8, 10);
    }
  });

  it("should be zero when no pricing matches", () => {
    const calc = new DefaultCostCalculator({});
    for (let i = 0; i < 50; i++) {
      const cost = calc.calculate(
        randomEvent(Math.floor(Math.random() * 1000), Math.floor(Math.random() * 1000)),
        baseAccount
      );
      expect(cost).toBe(0);
    }
  });
});
