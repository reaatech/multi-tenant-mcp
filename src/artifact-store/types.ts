/**
 * Represents a stored artifact with metadata.
 */
export interface Artifact {
  readonly id: string;
  readonly tenantId: string;
  /** User-defined name or path */
  readonly name: string;
  /** MIME type or content descriptor */
  readonly contentType: string;
  /** Size in bytes */
  readonly size: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Custom metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Storage backend for tenant-scoped artifacts.
 */
export interface ArtifactStore {
  /**
   * Store an artifact for a tenant.
   *
   * @param tenantId - Tenant identifier
   * @param name - Artifact name / path
   * @param data - Raw content (Buffer, string, or stream)
   * @param contentType - MIME type
   * @param metadata - Optional metadata
   */
  put(
    tenantId: string,
    name: string,
    data: Buffer | string,
    contentType: string,
    metadata?: Record<string, unknown>
  ): Promise<Artifact>;

  /**
   * Retrieve an artifact by name.
   */
  get(tenantId: string, name: string): Promise<Buffer>;

  /**
   * List artifacts for a tenant.
   */
  list(tenantId: string, prefix?: string): Promise<Artifact[]>;

  /**
   * Delete an artifact.
   */
  delete(tenantId: string, name: string): Promise<void>;

  /**
   * Check whether an artifact exists.
   */
  exists(tenantId: string, name: string): Promise<boolean>;
}

/**
 * Quota configuration per tenant.
 */
export interface StorageQuota {
  /** Maximum total bytes (default: Infinity) */
  readonly maxBytes: number;
  /** Maximum number of artifacts (default: Infinity) */
  readonly maxCount: number;
}
