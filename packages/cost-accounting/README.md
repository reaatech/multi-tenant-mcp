# @reaatech/multi-tenant-mcp-cost-accounting

[![npm version](https://img.shields.io/npm/v/@reaatech/multi-tenant-mcp-cost-accounting.svg)](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-cost-accounting)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/multi-tenant-mcp/ci.yml?branch=main&label=CI)](https://github.com/reaatech/multi-tenant-mcp/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Track and report per-tenant usage costs with per-call, per-token, and tiered pricing models.

## Installation

```bash
npm install @reaatech/multi-tenant-mcp-cost-accounting
# or
pnpm add @reaatech/multi-tenant-mcp-cost-accounting
```

## Feature Overview

- **Per-call pricing** — Assign a flat cost to each tool invocation.
- **Per-token pricing** — Charge independently for input and output tokens.
- **Tiered discounts** — Volume discounts applied progressively as call counts grow.
- **Usage emitters** — Forward `UsageEvent` records to your billing pipeline via a callback.
  Emissions are non-blocking and never fail the request.

## Quick Start

```typescript
import {
  DefaultCostCalculator,
  InMemoryCostTracker,
  CallbackUsageEmitter,
} from '@reaatech/multi-tenant-mcp-cost-accounting';

const calculator = new DefaultCostCalculator({
  perCall: { 'tool-premium': 0.05, 'tool-standard': 0.005 },
  perToken: { input: 0.001, output: 0.002 },
  tiers: [
    { upTo: 1000, discount: 0 },
    { upTo: 10_000, discount: 0.1 },
    { upTo: Number.POSITIVE_INFINITY, discount: 0.2 },
  ],
});

const tracker = new InMemoryCostTracker({ calculator });

const emitter = new CallbackUsageEmitter(async (event) => {
  await billingPipeline.record(event);
});

const event = {
  tenantId: 'acme-corp',
  itemName: 'tool-premium',
  itemType: 'tool',
  inputTokens: 1500,
  outputTokens: 800,
  timestamp: new Date(),
};

const cost = calculator.calculate(event, tracker.getAccount('acme-corp'));
await tracker.record(event); // accumulates into the tenant's CostAccount
```

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `CostCalculator` | Interface | `calculate(event, account) → number` |
| `CostTracker` | Interface | `record(event)` + `getAccount(tenantId)` |
| `UsageEventEmitter` | Interface | `emit(event)` — async, non-blocking |
| `CostAccount` | Interface | `tenantId`, `totalCost`, `totalCalls`, `totalInputTokens`, `totalOutputTokens` |
| `UsageEvent` | Interface | Event payload: `tenantId`, `itemName`, `itemType`, `inputTokens`, `outputTokens`, `timestamp` |
| `DefaultCostCalculator` | Class | Per-call + per-token + tiered cost calculation |
| `InMemoryCostTracker` | Class | LRU-bounded in-memory cost accumulator |
| `CallbackUsageEmitter` | Class | Invoke a user callback for each usage event |

### Pricing Evaluation Order

1. Per-call cost (`pricing.perCall[itemName]`)
2. Per-token cost (`pricing.perToken.input × count` + `pricing.perToken.output × count`)
3. Tiered discount applied to the subtotal based on `account.totalCalls`

## Related Packages

- [@reaatech/multi-tenant-mcp-types](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-types)
- [@reaatech/multi-tenant-mcp-middleware](https://www.npmjs.com/package/@reaatech/multi-tenant-mcp-middleware)

## License

[MIT](https://github.com/reaatech/multi-tenant-mcp/blob/main/LICENSE)
