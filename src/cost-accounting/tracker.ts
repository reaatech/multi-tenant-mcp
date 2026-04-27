import { BoundedMap } from "../types/bounded-map.js";
import type { CostAccount, CostCalculator, CostTracker, UsageEvent } from "./types.js";

export interface InMemoryCostTrackerOptions {
  /**
   * Maximum number of tenant accounts held in memory. When exceeded,
   * the least-recently-used account is evicted. Defaults to 10_000.
   */
  readonly maxTenants?: number;
  /**
   * Optional calculator. When provided, `record(event)` will compute
   * cost against the current account atomically — preferred over the
   * lower-level `recordEvent(event, cost)` when the calculator needs
   * to see the pre-event account (e.g., volume tiers).
   */
  readonly calculator?: CostCalculator;
}

/**
 * Tracks accumulated costs per tenant in memory. Single-process only;
 * for multi-instance deployments emit events through `UsageEventEmitter`
 * and aggregate downstream.
 */
export class InMemoryCostTracker implements CostTracker {
  private readonly accounts: BoundedMap<string, CostAccount>;
  private readonly calculator?: CostCalculator;

  constructor(options: InMemoryCostTrackerOptions = {}) {
    this.accounts = new BoundedMap(options.maxTenants ?? 10_000);
    this.calculator = options.calculator;
  }

  getAccount(tenantId: string): CostAccount {
    return this.accounts.get(tenantId) ?? emptyAccount(tenantId);
  }

  recordEvent(event: UsageEvent, cost: number): void {
    const existing = this.accounts.get(event.tenantId) ?? emptyAccount(event.tenantId);
    this.accounts.set(event.tenantId, applyEvent(existing, event, cost));
  }

  /**
   * Record a usage event, calculating cost against the current account
   * atomically. Requires a calculator to have been supplied at
   * construction time.
   */
  record(event: UsageEvent): number {
    if (!this.calculator) {
      throw new Error(
        "InMemoryCostTracker.record requires a calculator; pass one to the constructor or use recordEvent(event, cost)"
      );
    }
    const existing = this.accounts.get(event.tenantId) ?? emptyAccount(event.tenantId);
    const cost = this.calculator.calculate(event, existing);
    this.accounts.set(event.tenantId, applyEvent(existing, event, cost));
    return cost;
  }
}

function emptyAccount(tenantId: string): CostAccount {
  return {
    tenantId,
    totalCost: 0,
    totalCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
  };
}

function applyEvent(account: CostAccount, event: UsageEvent, cost: number): CostAccount {
  return {
    tenantId: account.tenantId,
    totalCost: account.totalCost + cost,
    totalCalls: account.totalCalls + 1,
    totalInputTokens: account.totalInputTokens + (event.inputTokens ?? 0),
    totalOutputTokens: account.totalOutputTokens + (event.outputTokens ?? 0),
  };
}
