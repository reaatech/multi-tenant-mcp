/**
 * Example: Multi-tenant MCP server with stdio transport.
 *
 * In stdio mode, there is one connection per process lifetime.
 * Tenant identity is resolved once at startup (e.g., from an environment
 * variable) and cached for all subsequent requests.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallbackUsageEmitter,
  ConsoleTenantLogger,
  DefaultCostCalculator,
  DefaultRateLimiter,
  HeaderTenantResolver,
  InMemoryCostTracker,
  MemoryRateLimitStore,
  MetricsCollector,
  TenantContextStore,
  createMultiTenantMiddleware,
} from '../src/index.js';

const logger = new ConsoleTenantLogger();
const metrics = new MetricsCollector();
const store = new TenantContextStore();

// Resolve tenant from environment (set by your orchestrator)
const tenantId = process.env.MCP_TENANT_ID ?? 'default';
store.run({ tenantId, metadata: {}, resolvedAt: new Date() }, () => {
  const server = new Server({ name: 'stdio-example', version: '1.0.0' });

  const middleware = createMultiTenantMiddleware({
    tenantResolver: new HeaderTenantResolver({ header: 'x-tenant-id' }),
    tenantContextStore: store,
    rateLimiter: new DefaultRateLimiter(
      new MemoryRateLimitStore({ requestsPerMinute: 60, tokensPerMinute: 10_000 }),
    ),
    toolVisibility: {
      [tenantId]: { type: 'allow', items: ['greet', 'calculate'] },
    },
    costCalculator: new DefaultCostCalculator({
      perCall: { greet: 0.001, calculate: 0.005 },
    }),
    costTracker: new InMemoryCostTracker(),
    usageEmitter: new CallbackUsageEmitter((event) => {
      logger.info('Usage event', { event });
    }),
    logger,
    metrics,
  });

  middleware.handle(server, 'tools/list', () => ({
    tools: [
      { name: 'greet', description: 'Say hello' },
      { name: 'calculate', description: 'Do math' },
      { name: 'admin', description: 'Admin only' },
    ],
  }));

  middleware.handle(server, 'tools/call', (request) => {
    const req = request as { params: { name: string; arguments?: Record<string, unknown> } };
    switch (req.params.name) {
      case 'greet':
        return {
          content: [
            { type: 'text', text: `Hello, ${String(req.params.arguments?.name ?? 'world')}!` },
          ],
        };
      case 'calculate':
        return { content: [{ type: 'text', text: String(42) }] };
      default:
        return { content: [{ type: 'text', text: 'Unknown tool' }] };
    }
  });

  const transport = new StdioServerTransport();
  server.connect(transport).catch((err: unknown) => {
    logger.error('Server error', { error: String(err) });
    process.exit(1);
  });

  logger.info('Stdio server started', { tenantId });
});
