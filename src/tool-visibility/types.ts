/**
 * Visibility policy types for tools, resources, and prompts.
 */
export type VisibilityPolicyType = "allow" | "deny" | "dynamic";

/**
 * Base visibility policy shared across tools, resources, and prompts.
 */
export interface BaseVisibilityPolicy {
  readonly type: VisibilityPolicyType;
  /** Static list of item names (used for allow/deny modes) */
  readonly items?: readonly string[];
  /** Runtime evaluator (used for dynamic mode) */
  readonly evaluator?: (itemName: string, tenantId: string) => boolean | Promise<boolean>;
}

/** Visibility policy for MCP tools. */
export type ToolVisibilityPolicy = BaseVisibilityPolicy;

/** Visibility policy for MCP resources. */
export type ResourceVisibilityPolicy = BaseVisibilityPolicy;

/** Visibility policy for MCP prompts. */
export type PromptVisibilityPolicy = BaseVisibilityPolicy;

/**
 * Engine that applies visibility policies to item lists.
 */
export interface VisibilityEngine {
  /**
   * Filter a list of item names according to the tenant's policy.
   */
  filter(items: readonly string[], tenantId: string): string[] | Promise<string[]>;

  /**
   * Check whether a single item is visible to the tenant.
   */
  isVisible(itemName: string, tenantId: string): boolean | Promise<boolean>;
}
