import type { UsageEvent, UsageEventEmitter } from "./types.js";

/**
 * Emits usage events via a user-provided callback.
 *
 * The callback is invoked asynchronously and non-blocking.
 */
export class CallbackUsageEmitter implements UsageEventEmitter {
  constructor(private readonly callback: (event: UsageEvent) => void | Promise<void>) {}

  async emit(event: UsageEvent): Promise<void> {
    await this.callback(event);
  }
}
