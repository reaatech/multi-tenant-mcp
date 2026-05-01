import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallbackUsageEmitter,
  DefaultCostCalculator,
  InMemoryCostTracker,
} from '@reaatech/multi-tenant-mcp-cost-accounting';
import { createMultiTenantMiddleware } from '@reaatech/multi-tenant-mcp-middleware';
import { ConsoleTenantLogger, MetricsCollector } from '@reaatech/multi-tenant-mcp-observability';
import { DefaultRateLimiter, MemoryRateLimitStore } from '@reaatech/multi-tenant-mcp-rate-limiter';
import { JWTTenantResolver, TenantContextStore } from '@reaatech/multi-tenant-mcp-tenant-resolver';
import express from 'express';

const app = express();
const logger = new ConsoleTenantLogger();
const metrics = new MetricsCollector();

const jwtSecret = process.env.JWT_SECRET ?? 'change-me';
const tenantResolver = new JWTTenantResolver({
  claim: 'tenant_id',
  secret: jwtSecret,
});

const rateLimitStore = new MemoryRateLimitStore({
  requestsPerMinute: 100,
  tokensPerMinute: 10_000,
});
const costTracker = new InMemoryCostTracker();

app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport('/messages', res);

  const tenantContext = tenantResolver.resolve({
    headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), v])),
  });

  if (!tenantContext) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const store = new TenantContextStore();
  store.run(tenantContext, () => {
    const server = new Server({ name: 'sse-example', version: '1.0.0' });

    const middleware = createMultiTenantMiddleware({
      tenantResolver,
      tenantContextStore: store,
      rateLimiter: new DefaultRateLimiter(rateLimitStore),
      toolVisibility: {
        [tenantContext.tenantId]: { type: 'allow', items: ['echo', 'status'] },
      },
      costCalculator: new DefaultCostCalculator({
        perCall: { echo: 0.001 },
      }),
      costTracker,
      usageEmitter: new CallbackUsageEmitter((event) => {
        logger.info('Usage', { tenantId: event.tenantId, item: event.itemName });
      }),
      logger,
      metrics,
    });

    middleware.handle(server, 'tools/list', () => ({
      tools: [
        { name: 'echo', description: 'Echo back input' },
        { name: 'status', description: 'Server status' },
      ],
    }));

    middleware.handle(server, 'tools/call', (request) => {
      const req = request as { params: { name: string; arguments?: Record<string, unknown> } };
      switch (req.params.name) {
        case 'echo':
          return { content: [{ type: 'text', text: String(req.params.arguments?.message ?? '') }] };
        case 'status':
          return { content: [{ type: 'text', text: 'ok' }] };
        default:
          return { content: [{ type: 'text', text: 'Unknown tool' }] };
      }
    });

    server.connect(transport).catch((err: unknown) => {
      logger.error('SSE transport error', { error: String(err) });
    });

    logger.info('SSE connection established', { tenantId: tenantContext.tenantId });
  });
});

app.post('/messages', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented in example' });
});

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
  logger.info('SSE server listening', { port: PORT });
});
