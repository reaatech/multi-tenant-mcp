import type { CostAccount, PricingModel, UsageEvent } from './types.js';

/**
 * Calculates the monetary cost of a usage event based on a pricing model.
 */
export class DefaultCostCalculator {
  constructor(private readonly pricing: PricingModel) {}

  calculate(event: UsageEvent, account: CostAccount): number {
    let cost = 0;

    // Per-call pricing
    if (this.pricing.perCall?.[event.itemName]) {
      cost += this.pricing.perCall[event.itemName];
    }

    // Per-token pricing
    if (this.pricing.perToken) {
      const inputTokens = event.inputTokens ?? 0;
      const outputTokens = event.outputTokens ?? 0;
      cost +=
        inputTokens * this.pricing.perToken.input + outputTokens * this.pricing.perToken.output;
    }

    // Tiered discount
    if (this.pricing.tiers && this.pricing.tiers.length > 0) {
      const tier = this.findTier(account.totalCalls + 1);
      if (tier && tier.discount > 0) {
        cost = cost * (1 - tier.discount);
      }
    }

    return cost;
  }

  private findTier(totalCalls: number): { upTo: number; discount: number } | undefined {
    for (const tier of this.pricing.tiers ?? []) {
      if (totalCalls <= tier.upTo) {
        return tier;
      }
    }
    return undefined;
  }
}
