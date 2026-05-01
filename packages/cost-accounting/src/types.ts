/**
 * Represents a billable usage event.
 */
export interface UsageEvent {
  readonly tenantId: string;
  /** Name of the tool, resource, or prompt invoked */
  readonly itemName: string;
  /** Type of MCP primitive */
  readonly itemType: 'tool' | 'resource' | 'prompt';
  /** Number of input tokens (if applicable) */
  readonly inputTokens?: number;
  /** Number of output tokens (if applicable) */
  readonly outputTokens?: number;
  /** Timestamp of the event */
  readonly timestamp: Date;
  /** Additional metadata (model name, region, etc.) */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Per-call pricing map: item name → cost in currency units.
 */
export type PerCallPricing = Readonly<Record<string, number>>;

/**
 * Per-token pricing configuration.
 */
export interface PerTokenPricing {
  readonly input: number;
  readonly output: number;
}

/**
 * Volume discount tier.
 */
export interface PricingTier {
  /** Upper bound of this tier (inclusive). Use `Infinity` for open-ended top tier. */
  readonly upTo: number;
  /** Discount fraction (0 = no discount, 0.1 = 10% off) */
  readonly discount: number;
}

/**
 * Complete pricing model.
 */
export interface PricingModel {
  /** Fixed cost per invocation */
  readonly perCall?: PerCallPricing;
  /** Cost per token */
  readonly perToken?: PerTokenPricing;
  /** Volume discount tiers (applied to total monthly usage) */
  readonly tiers?: readonly PricingTier[];
}

/**
 * Tracks accumulated costs for a tenant.
 */
export interface CostAccount {
  readonly tenantId: string;
  /** Total cost accumulated (in currency units) */
  readonly totalCost: number;
  /** Total number of invocations */
  readonly totalCalls: number;
  /** Total input tokens consumed */
  readonly totalInputTokens: number;
  /** Total output tokens consumed */
  readonly totalOutputTokens: number;
}

/**
 * Emits usage events for billing/analytics pipelines.
 */
export interface UsageEventEmitter {
  emit(event: UsageEvent): void | Promise<void>;
}

/**
 * Tracks accumulated costs for billing/analytics.
 */
export interface CostTracker {
  /** Retrieve the current cost account for a tenant. */
  getAccount(tenantId: string): CostAccount;
  /** Record a usage event and its calculated cost against the tenant's account. */
  recordEvent(event: UsageEvent, cost: number): void;
}

/**
 * Calculates the monetary cost of a usage event.
 */
export interface CostCalculator {
  calculate(event: UsageEvent, account: CostAccount): number;
}
