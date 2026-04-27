import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import type { Artifact, ArtifactStore, StorageQuota } from "./types.js";
import {
  assertSafeArtifactName,
  assertSafeTenantId,
  resolveWithinTenantPrefix,
} from "./path-safety.js";

/**
 * S3-backed artifact store for production deployments.
 *
 * Stores artifacts under `{prefix}/{tenantId}/{name}` within a bucket.
 */
export class S3ArtifactStore implements ArtifactStore {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly prefix = "artifacts",
    private readonly quota?: StorageQuota
  ) {}

  async put(
    tenantId: string,
    name: string,
    data: Buffer | string,
    contentType: string,
    metadata?: Record<string, unknown>
  ): Promise<Artifact> {
    const key = this.objectKey(tenantId, name);
    const body = typeof data === "string" ? Buffer.from(data) : data;

    if (this.quota) {
      await this.enforceQuota(tenantId, body.length);
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata ? this.sanitizeMetadata(metadata) : undefined,
      })
    );

    const now = new Date();
    return {
      id: key,
      tenantId,
      name,
      contentType,
      size: body.length,
      createdAt: now,
      updatedAt: now,
      metadata,
    };
  }

  async get(tenantId: string, name: string): Promise<Buffer> {
    const key = this.objectKey(tenantId, name);
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    if (!response.Body) {
      throw new Error(`Artifact not found: ${key}`);
    }

    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async list(tenantId: string, prefix?: string): Promise<Artifact[]> {
    assertSafeTenantId(tenantId);
    if (prefix !== undefined && prefix.length > 0) assertSafeArtifactName(prefix);
    const tenantPrefix = `${this.prefix}/${tenantId}/${prefix ?? ""}`;
    const artifacts: Artifact[] = [];

    let continuationToken: string | undefined;
    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: tenantPrefix,
          ContinuationToken: continuationToken,
        })
      );

      for (const obj of response.Contents ?? []) {
        if (!obj.Key || obj.Key.endsWith("/")) continue;
        const name = obj.Key.slice(tenantPrefix.length);
        artifacts.push({
          id: obj.Key,
          tenantId,
          name,
          contentType: "application/octet-stream",
          size: obj.Size ?? 0,
          createdAt: obj.LastModified ?? new Date(),
          updatedAt: obj.LastModified ?? new Date(),
        });
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return artifacts;
  }

  async delete(tenantId: string, name: string): Promise<void> {
    const key = this.objectKey(tenantId, name);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  async exists(tenantId: string, name: string): Promise<boolean> {
    const key = this.objectKey(tenantId, name);
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === "NotFound") {
        return false;
      }
      throw err;
    }
  }

  private objectKey(tenantId: string, name: string): string {
    assertSafeTenantId(tenantId);
    assertSafeArtifactName(name);
    return resolveWithinTenantPrefix(this.prefix, tenantId, name);
  }

  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      result[key] = typeof value === "string" ? value : JSON.stringify(value);
    }
    return result;
  }

  private async enforceQuota(tenantId: string, newSize: number): Promise<void> {
    if (!this.quota) return;

    const existing = await this.list(tenantId);
    const totalSize = existing.reduce((sum, a) => sum + a.size, 0) + newSize;

    if (this.quota.maxBytes !== Infinity && totalSize > this.quota.maxBytes) {
      throw new Error(
        `Storage quota exceeded for tenant ${tenantId}: ${String(totalSize)} > ${String(this.quota.maxBytes)}`
      );
    }

    if (this.quota.maxCount !== Infinity && existing.length + 1 > this.quota.maxCount) {
      throw new Error(
        `Artifact count quota exceeded for tenant ${tenantId}: ${String(existing.length + 1)} > ${String(this.quota.maxCount)}`
      );
    }
  }
}
