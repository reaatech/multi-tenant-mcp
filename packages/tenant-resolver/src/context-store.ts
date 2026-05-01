import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantContext } from '@reaatech/multi-tenant-mcp-types';

/**
 * AsyncLocalStorage-based store for propagating tenant context through
 * the async call stack.
 *
 * Usage:
 * ```typescript
 * const store = new TenantContextStore();
 *
 * // At connection time (e.g., after `initialize`):
 * store.run(resolvedContext, () => {
 *   // All request handlers inside this run have access to the context
 *   server.setRequestHandler("tools/list", listToolsHandler);
 * });
 *
 * // Inside a handler:
 * const ctx = store.get();
 * ```
 */
export class TenantContextStore {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  /**
   * Run a function within the context of a resolved tenant.
   */
  run<T>(context: TenantContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  /**
   * Retrieve the current tenant context from async context.
   *
   * @returns The tenant context, or `undefined` if not in a scoped run.
   */
  get(): TenantContext | undefined {
    return this.storage.getStore();
  }
}
