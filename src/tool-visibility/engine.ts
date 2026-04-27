import type { BaseVisibilityPolicy, VisibilityEngine } from "./types.js";

/**
 * Generic visibility engine that applies allow-list, deny-list, or dynamic
 * policies to filter MCP primitives (tools, resources, prompts).
 */
export class VisibilityEngineImpl<
  TPolicy extends BaseVisibilityPolicy,
> implements VisibilityEngine {
  constructor(
    private readonly policies: Readonly<Record<string, TPolicy>>,
    private readonly defaultVisible = true
  ) {}

  async filter(items: readonly string[], tenantId: string): Promise<string[]> {
    const visible: string[] = [];
    for (const item of items) {
      if (await this.isVisible(item, tenantId)) {
        visible.push(item);
      }
    }
    return visible;
  }

  async isVisible(itemName: string, tenantId: string): Promise<boolean> {
    const policy = this.policies[tenantId];

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!policy) {
      return this.defaultVisible;
    }

    switch (policy.type) {
      case "allow":
        return policy.items?.includes(itemName) ?? false;
      case "deny":
        return !(policy.items?.includes(itemName) ?? false);
      case "dynamic":
        return policy.evaluator ? await policy.evaluator(itemName, tenantId) : this.defaultVisible;
      default:
        return this.defaultVisible;
    }
  }
}
