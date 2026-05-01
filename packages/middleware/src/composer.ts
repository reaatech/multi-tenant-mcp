import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { VisibilityEngineImpl } from '@reaatech/multi-tenant-mcp-tool-visibility';
import type { VisibilityEngine } from '@reaatech/multi-tenant-mcp-tool-visibility';
import { MiddlewareError, MiddlewareErrorCode } from '@reaatech/multi-tenant-mcp-types';
import type { CreateMultiTenantMiddleware, MultiTenantMiddleware } from './types.js';

type RawHandler = (request: unknown) => unknown | Promise<unknown>;

interface MCPRegistration {
  setRequestHandler(method: string, handler: (request: unknown) => Promise<unknown>): void;
}

export const createMultiTenantMiddleware: CreateMultiTenantMiddleware = (
  config,
): MultiTenantMiddleware => {
  if (!config.tenantContextStore) {
    throw new Error(
      'createMultiTenantMiddleware requires `tenantContextStore`. ' +
        'Resolve the tenant at connection time (e.g., from transport headers) ' +
        'and populate the store via `store.run(ctx, cb)` so handlers can read ' +
        'it. The MCP SDK does not pass transport headers into request handlers, ' +
        'so there is no safe per-request fallback.',
    );
  }

  const toolEngine = config.toolVisibility
    ? new VisibilityEngineImpl(config.toolVisibility, true)
    : undefined;

  const resourceEngine = config.resourceVisibility
    ? new VisibilityEngineImpl(config.resourceVisibility, true)
    : undefined;

  const promptEngine = config.promptVisibility
    ? new VisibilityEngineImpl(config.promptVisibility, true)
    : undefined;

  return {
    handle(server: Server, method: string, handler: RawHandler): void {
      (server as unknown as MCPRegistration).setRequestHandler(method, async (request: unknown) => {
        const logger = config.logger;
        const metrics = config.metrics;

        logger?.debug('Request received', { method });

        const tenantContext = config.tenantContextStore.get();

        if (!tenantContext) {
          logger?.warn('Tenant resolution failed', { method });
          metrics?.errors.increment({ method, type: 'unauthorized' });
          throw new MiddlewareError(
            MiddlewareErrorCode.Unauthorized,
            'Tenant could not be resolved',
          );
        }

        const tenantId = tenantContext.tenantId;
        metrics?.requests.increment({ method, tenantId });

        logger?.debug('Tenant resolved', { tenantId, method });

        if (config.rateLimiter) {
          const rateLimit = await config.rateLimiter.check(tenantId, 0);
          if (!rateLimit.allowed) {
            logger?.warn('Rate limit exceeded', { tenantId, method });
            metrics?.rateLimitHits.increment({ tenantId, method });
            throw new MiddlewareError(
              MiddlewareErrorCode.RateLimitExceeded,
              'Rate limit exceeded',
              { resetAt: rateLimit.resetAt },
            );
          }
        }

        if (method === 'tools/list' && toolEngine) {
          return filterListResult(await handler(request), toolEngine, tenantId, 'tools', 'name');
        }

        if (method === 'resources/list' && resourceEngine) {
          return filterListResult(
            await handler(request),
            resourceEngine,
            tenantId,
            'resources',
            'uri',
          );
        }

        if (method === 'prompts/list' && promptEngine) {
          return filterListResult(
            await handler(request),
            promptEngine,
            tenantId,
            'prompts',
            'name',
          );
        }

        try {
          if (method === 'tools/call' && toolEngine) {
            const req = request as { params?: { name?: string } };
            await validateAccess(
              toolEngine,
              req.params?.name ?? '',
              tenantId,
              'tool',
              MiddlewareErrorCode.ToolForbidden,
            );
          }

          if (method === 'resources/read' && resourceEngine) {
            const req = request as { params?: { uri?: string } };
            await validateAccess(
              resourceEngine,
              req.params?.uri ?? '',
              tenantId,
              'resource',
              MiddlewareErrorCode.ResourceForbidden,
            );
          }

          if (method === 'prompts/get' && promptEngine) {
            const req = request as { params?: { name?: string } };
            await validateAccess(
              promptEngine,
              req.params?.name ?? '',
              tenantId,
              'prompt',
              MiddlewareErrorCode.PromptForbidden,
            );
          }
        } catch (err) {
          logger?.warn('Access denied', { tenantId, method, error: (err as Error).message });
          metrics?.errors.increment({ tenantId, method, type: 'access_denied' });
          throw err;
        }

        const result = await handler(request);

        const itemName = extractItemName(method, request);
        if (itemName) {
          logger?.info('Item invoked', { tenantId, method, itemName });
          metrics?.toolUsage.increment({ tenantId, method, itemName });

          if (config.costCalculator || config.usageEmitter) {
            const tokenCounts = config.tokenExtractor?.(result);
            const event = {
              tenantId,
              itemName,
              itemType: methodToItemType(method),
              inputTokens: tokenCounts?.inputTokens,
              outputTokens: tokenCounts?.outputTokens,
              timestamp: new Date(),
            };

            if (config.costCalculator && config.costTracker) {
              const account = config.costTracker.getAccount(tenantId);
              const cost = config.costCalculator.calculate(event, account);
              config.costTracker.recordEvent(event, cost);
            }

            if (config.usageEmitter) {
              void Promise.resolve(config.usageEmitter.emit(event)).catch((err: unknown) => {
                logger?.error('Usage event emission failed', {
                  tenantId,
                  itemName,
                  error: String(err),
                });
              });
            }
          }
        }

        return result;
      });
    },
  };
};

async function filterListResult(
  result: unknown,
  engine: VisibilityEngine,
  tenantId: string,
  listKey: string,
  itemKey: string,
): Promise<unknown> {
  const typed = result as Record<string, Array<Record<string, string>> | undefined>;
  const items = typed[listKey];
  if (items) {
    const names = items.map((item) => item[itemKey]);
    const visible = await engine.filter(names, tenantId);
    return {
      ...typed,
      [listKey]: items.filter((item) => visible.includes(item[itemKey])),
    };
  }
  return typed;
}

function extractItemName(method: string, request: unknown): string | undefined {
  const req = request as { params?: { name?: string; uri?: string } };
  switch (method) {
    case 'tools/call':
      return req.params?.name;
    case 'resources/read':
      return req.params?.uri;
    case 'prompts/get':
      return req.params?.name;
    default:
      return undefined;
  }
}

function methodToItemType(method: string): 'tool' | 'resource' | 'prompt' {
  switch (method) {
    case 'tools/call':
      return 'tool';
    case 'resources/read':
      return 'resource';
    case 'prompts/get':
      return 'prompt';
    default:
      return 'tool';
  }
}

async function validateAccess(
  engine: VisibilityEngine,
  name: string,
  tenantId: string,
  itemType: string,
  errorCode: MiddlewareErrorCode,
): Promise<void> {
  if (!(await engine.isVisible(name, tenantId))) {
    throw new MiddlewareError(
      errorCode,
      `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} "${name}" is not accessible to this tenant`,
    );
  }
}
