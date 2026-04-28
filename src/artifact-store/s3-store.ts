import type { Artifact, ArtifactStore, StorageQuota } from "./types.js";
import {
  assertSafeArtifactName,
  assertSafeTenantId,
  resolveWithinTenantPrefix,
} from "./path-safety.js";

type S3CommandCtor = new (input: Record<string, unknown>) => { input: Record<string, unknown> };
type S3SendClient = { send(command: unknown): Promise<Record<string, unknown>> };

interface S3Commands {
  PutObjectCommand: S3CommandCtor;
  GetObjectCommand: S3CommandCtor;
  ListObjectsV2Command: S3CommandCtor;
  DeleteObjectCommand: S3CommandCtor;
  HeadObjectCommand: S3CommandCtor;
}

let _commands: S3Commands | null = null;
let _loadError: string | null = null;

async function s3Commands(): Promise<S3Commands> {
  if (_commands) return _commands;
  if (_loadError) {
    throw new Error(_loadError);
  }
  try {
    const s3 = await import("@aws-sdk/client-s3");
    _commands = {
      PutObjectCommand: s3.PutObjectCommand as unknown as S3CommandCtor,
      GetObjectCommand: s3.GetObjectCommand as unknown as S3CommandCtor,
      ListObjectsV2Command: s3.ListObjectsV2Command as unknown as S3CommandCtor,
      DeleteObjectCommand: s3.DeleteObjectCommand as unknown as S3CommandCtor,
      HeadObjectCommand: s3.HeadObjectCommand as unknown as S3CommandCtor,
    };
    return _commands;
  } catch (err) {
    _loadError = err instanceof Error ? err.message : String(err);
    throw new Error(
      "@aws-sdk/client-s3 is an optional dependency required for S3ArtifactStore. " +
        "Install it: pnpm add @aws-sdk/client-s3"
    );
  }
}

/**
 * S3-backed artifact store for production deployments.
 *
 * Stores artifacts under `{prefix}/{tenantId}/{name}` within a bucket.
 */
export class S3ArtifactStore implements ArtifactStore {
  constructor(
    private readonly client: S3SendClient,
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
    const { PutObjectCommand } = await s3Commands();
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
    const { GetObjectCommand } = await s3Commands();
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
    const { ListObjectsV2Command } = await s3Commands();
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

      const contents = response.Contents as Array<Record<string, unknown>> | undefined;
      for (const obj of contents ?? []) {
        if (!obj.Key || (obj.Key as string).endsWith("/")) continue;
        const itemName = (obj.Key as string).slice(tenantPrefix.length);
        artifacts.push({
          id: obj.Key as string,
          tenantId,
          name: itemName,
          contentType: "application/octet-stream",
          size: typeof obj.Size === "number" ? obj.Size : 0,
          createdAt: obj.LastModified instanceof Date ? obj.LastModified : new Date(),
          updatedAt: obj.LastModified instanceof Date ? obj.LastModified : new Date(),
        });
      }

      continuationToken = response.NextContinuationToken as string | undefined;
    } while (continuationToken);

    return artifacts;
  }

  async delete(tenantId: string, name: string): Promise<void> {
    const { DeleteObjectCommand } = await s3Commands();
    const key = this.objectKey(tenantId, name);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  async exists(tenantId: string, name: string): Promise<boolean> {
    const { HeadObjectCommand } = await s3Commands();
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
