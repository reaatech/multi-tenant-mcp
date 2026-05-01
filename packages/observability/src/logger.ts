import type { TenantContextStore } from '@reaatech/multi-tenant-mcp-tenant-resolver';

/**
 * Structured log entry with tenant context.
 */
export interface LogEntry {
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly message: string;
  readonly tenantId?: string;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Logger interface for tenant-aware structured logging.
 */
export interface TenantLogger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export interface ConsoleTenantLoggerOptions {
  /**
   * Optional context store. When supplied, the current tenant id is
   * read on every log call and prefixed onto the output.
   */
  readonly contextStore?: TenantContextStore;
}

/**
 * Console-based structured logger that prefixes entries with the
 * current tenant id when a `TenantContextStore` is provided.
 */
export class ConsoleTenantLogger implements TenantLogger {
  private readonly contextStore?: TenantContextStore;

  constructor(options: ConsoleTenantLoggerOptions = {}) {
    this.contextStore = options.contextStore;
  }

  private log(level: LogEntry['level'], message: string, metadata?: Record<string, unknown>): void {
    const tenantId = this.contextStore?.get()?.tenantId;
    const prefix = tenantId ? `[tenant=${tenantId}] ` : '';
    const meta = metadata ? ` ${JSON.stringify(metadata)}` : '';
    const line = `${prefix}${message}${meta}`;

    switch (level) {
      case 'debug':
        console.debug(line);
        break;
      case 'info':
        console.info(line);
        break;
      case 'warn':
        console.warn(line);
        break;
      case 'error':
        console.error(line);
        break;
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata);
  }
}
