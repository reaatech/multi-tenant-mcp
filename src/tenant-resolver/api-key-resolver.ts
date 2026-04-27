import type { TenantContext } from "../types/index.js";
import type { APIKeyTenantResolverConfig, ResolveRequest, TenantResolver } from "./types.js";

/**
 * Resolves tenant identity from an API key header.
 */
export class APIKeyTenantResolver implements TenantResolver {
  constructor(private readonly config: APIKeyTenantResolverConfig) {}

  async resolve(request: ResolveRequest): Promise<TenantContext | null> {
    const raw = request.headers[this.config.headerName.toLowerCase()];
    const apiKey = Array.isArray(raw) ? raw[0] : raw;

    if (!apiKey || typeof apiKey !== "string") {
      return null;
    }

    const result = await this.config.lookup(apiKey);
    return result ?? null;
  }
}
