import type { ArtifactStore } from "./types.js";

/**
 * Configuration for artifact lifecycle management.
 */
export interface LifecycleConfig {
  /** Maximum age of an artifact in milliseconds */
  readonly maxAgeMs: number;
}

/**
 * Manages artifact lifecycle operations such as TTL-based cleanup.
 */
export class ArtifactLifecycleManager {
  constructor(
    private readonly store: ArtifactStore,
    private readonly config: LifecycleConfig
  ) {}

  /**
   * Remove all artifacts for a tenant that are older than `maxAgeMs`.
   *
   * @returns Number of artifacts deleted.
   */
  async cleanup(tenantId: string): Promise<number> {
    const cutoff = new Date(Date.now() - this.config.maxAgeMs);
    const artifacts = await this.store.list(tenantId);
    let deleted = 0;

    for (const artifact of artifacts) {
      if (artifact.updatedAt < cutoff) {
        await this.store.delete(tenantId, artifact.name);
        deleted++;
      }
    }

    return deleted;
  }
}
