/**
 * Example: Multi-tenant MCP server with SSE transport.
 *
 * In SSE mode, each HTTP connection maps to a tenant session.
 * Tenant identity is resolved from headers at connection time and
 * cached for the lifetime of the connection.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import {
  createMultiTenantMiddleware,
  JWTTenantResolver,
  TenantContextStore,
  MemoryRateLimitStore,
  DefaultRateLimiter,
  DefaultCostCalculator,
  InMemoryCostTracker,
  CallbackUsageEmitter,
  ConsoleTenantLogger,
  MetricsCollector,
} from "../src/index.js";

const app = express();
const logger = new ConsoleTenantLogger();
const metrics = new MetricsCollector();

const jwtSecret = process.env.JWT_SECRET ?? "change-me";
const tenantResolver = new JWTTenantResolver({
  claim: "tenant_id",
  secret: jwtSecret,
});

// In-memory stores (use Redis in production)
const rateLimitStore = new MemoryRateLimitStore({
  requestsPerMinute: 100,
  tokensPerMinute: 10_000,
});
const costTracker = new InMemoryCostTracker();

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);

  // Resolve tenant from the incoming HTTP request headers
  const tenantContext = tenantResolver.resolve({
    headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), v])),
  });

  if (!tenantContext) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const store = new TenantContextStore();
  store.run(tenantContext, () => {
    const server = new Server({ name: "sse-example", version: "1.0.0" });

    const middleware = createMultiTenantMiddleware({
      tenantResolver,
      tenantContextStore: store,
      rateLimiter: new DefaultRateLimiter(rateLimitStore),
      toolVisibility: {
        [tenantContext.tenantId]: { type: "allow", items: ["echo", "status"] },
      },
      costCalculator: new DefaultCostCalculator({
        perCall: { echo: 0.001 },
      }),
      costTracker,
      usageEmitter: new CallbackUsageEmitter((event) => {
        logger.info("Usage", { tenantId: event.tenantId, item: event.itemName });
      }),
      logger,
      metrics,
    });

    middleware.handle(server, "tools/list", () => ({
      tools: [
        { name: "echo", description: "Echo back input" },
        { name: "status", description: "Server status" },
      ],
    }));

    middleware.handle(server, "tools/call", (request) => {
      const req = request as { params: { name: string; arguments?: Record<string, unknown> } };
      switch (req.params.name) {
        case "echo":
          return { content: [{ type: "text", text: String(req.params.arguments?.message ?? "") }] };
        case "status":
          return { content: [{ type: "text", text: "ok" }] };
        default:
          return { content: [{ type: "text", text: "Unknown tool" }] };
      }
    });

    server.connect(transport).catch((err: unknown) => {
      logger.error("SSE transport error", { error: String(err) });
    });

    logger.info("SSE connection established", { tenantId: tenantContext.tenantId });
  });
});

app.post("/messages", async (req, res) => {
  // Note: In a real app, map this to the correct SSEServerTransport session
  res.status(501).json({ error: "Not implemented in example" });
});

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
  logger.info("SSE server listening", { port: PORT });
});
