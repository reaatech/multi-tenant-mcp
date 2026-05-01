import { describe, expect, it, vi } from 'vitest';
import { S3ArtifactStore } from './s3-store.js';

let s3Available = false;
try {
  await import('@aws-sdk/client-s3');
  s3Available = true;
} catch {
  void 0;
}

function createMockS3Client() {
  const commands: Array<{ name: string; input: Record<string, unknown> }> = [];

  return {
    send: vi.fn(
      async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
        commands.push({ name: command.constructor.name, input: command.input });

        if (command.constructor.name === 'GetObjectCommand') {
          return {
            Body: {
              async *[Symbol.asyncIterator]() {
                yield Buffer.from('hello-s3');
              },
            },
          };
        }

        if (command.constructor.name === 'ListObjectsV2Command') {
          return {
            Contents: [
              { Key: 'artifacts/t1/file.txt', Size: 100, LastModified: new Date('2024-01-01') },
              {
                Key: 'artifacts/t1/nested/doc.pdf',
                Size: 200,
                LastModified: new Date('2024-01-02'),
              },
            ],
            NextContinuationToken: undefined,
          };
        }

        if (command.constructor.name === 'HeadObjectCommand') {
          return {};
        }

        return {};
      },
    ),
    commands,
  };
}

describe.runIf(s3Available)('S3ArtifactStore', () => {
  it('should put an artifact', async () => {
    const client = createMockS3Client();
    const store = new S3ArtifactStore(client, 'my-bucket');

    const artifact = await store.put('t1', 'data.json', '{"hello":"world"}', 'application/json');

    expect(artifact.name).toBe('data.json');
    expect(artifact.tenantId).toBe('t1');
    expect(artifact.size).toBe(17);

    const putCall = client.commands.find((c) => c.name === 'PutObjectCommand');
    expect(putCall).toBeDefined();
    if (!putCall) throw new Error('PutObjectCommand not found');
    expect(putCall.input.Key).toBe('artifacts/t1/data.json');
    expect(putCall.input.Bucket).toBe('my-bucket');
  });

  it('should get an artifact', async () => {
    const client = createMockS3Client();
    const store = new S3ArtifactStore(client, 'my-bucket');

    const data = await store.get('t1', 'file.txt');
    expect(data.toString()).toBe('hello-s3');
  });

  it('should list artifacts for a tenant', async () => {
    const client = createMockS3Client();
    const store = new S3ArtifactStore(client, 'my-bucket');

    const list = await store.list('t1');
    expect(list).toHaveLength(2);
    expect(list.map((a) => a.name)).toEqual(['file.txt', 'nested/doc.pdf']);
  });

  it('should delete an artifact', async () => {
    const client = createMockS3Client();
    const store = new S3ArtifactStore(client, 'my-bucket');

    await store.delete('t1', 'file.txt');

    const deleteCall = client.commands.find((c) => c.name === 'DeleteObjectCommand');
    expect(deleteCall).toBeDefined();
    if (!deleteCall) throw new Error('DeleteObjectCommand not found');
    expect(deleteCall.input.Key).toBe('artifacts/t1/file.txt');
  });

  it('should check existence', async () => {
    const client = createMockS3Client();
    const store = new S3ArtifactStore(client, 'my-bucket');

    const exists = await store.exists('t1', 'file.txt');
    expect(exists).toBe(true);
  });

  it('should return false for missing artifact on NotFound', async () => {
    const client = createMockS3Client();
    client.send = vi.fn(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === 'HeadObjectCommand') {
        const err = new Error('NotFound');
        err.name = 'NotFound';
        throw err;
      }
      return {};
    });

    const store = new S3ArtifactStore(client, 'my-bucket');
    const exists = await store.exists('t1', 'missing.txt');
    expect(exists).toBe(false);
  });

  it('should rethrow non-NotFound HeadObject errors', async () => {
    const client = createMockS3Client();
    client.send = vi.fn(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === 'HeadObjectCommand') {
        throw new Error('NetworkError');
      }
      return {};
    });

    const store = new S3ArtifactStore(client, 'my-bucket');
    await expect(store.exists('t1', 'file.txt')).rejects.toThrow('NetworkError');
  });

  it('should sanitize metadata to strings', async () => {
    const client = createMockS3Client();
    const store = new S3ArtifactStore(client, 'my-bucket');

    await store.put('t1', 'data.json', 'data', 'application/json', {
      version: 2,
      tags: ['a', 'b'],
    });

    const putCall = client.commands.find((c) => c.name === 'PutObjectCommand');
    if (!putCall) throw new Error('PutObjectCommand not found');
    expect(putCall.input.Metadata).toEqual({
      version: '2',
      tags: '["a","b"]',
    });
  });

  it('should enforce byte quota', async () => {
    const client = createMockS3Client();
    const store = new S3ArtifactStore(client, 'my-bucket', 'artifacts', {
      maxBytes: 50,
      maxCount: 100,
    });

    await expect(
      store.put('t1', 'big.bin', Buffer.alloc(100), 'application/octet-stream'),
    ).rejects.toThrow('Storage quota exceeded');
  });

  describe('path traversal', () => {
    it('rejects tenantIds with slashes or traversal', async () => {
      const client = createMockS3Client();
      const store = new S3ArtifactStore(client, 'my-bucket');

      await expect(store.put('a/b', 'x', 'y', 'text/plain')).rejects.toThrow(/Invalid tenantId/);
      await expect(store.get('..', 'x')).rejects.toThrow(/Invalid tenantId/);
    });

    it('rejects names with traversal segments', async () => {
      const client = createMockS3Client();
      const store = new S3ArtifactStore(client, 'my-bucket');

      await expect(store.get('t1', '../t2/secret')).rejects.toThrow(/Invalid artifact name/);
      await expect(store.put('t1', '../t2/file', 'data', 'text/plain')).rejects.toThrow(
        /Invalid artifact name/,
      );
    });

    it('rejects absolute names and NUL bytes', async () => {
      const client = createMockS3Client();
      const store = new S3ArtifactStore(client, 'my-bucket');

      await expect(store.get('t1', '/abs/path')).rejects.toThrow(/Invalid artifact name/);
      await expect(store.get('t1', 'bad\0name')).rejects.toThrow(/NUL byte/);
    });
  });

  it('should enforce count quota', async () => {
    const client = createMockS3Client();
    const store = new S3ArtifactStore(client, 'my-bucket', 'artifacts', {
      maxBytes: 10000,
      maxCount: 2,
    });

    // The list returns 2 existing items, so a 3rd should fail
    await expect(store.put('t1', 'third.txt', 'data', 'text/plain')).rejects.toThrow(
      'Artifact count quota exceeded',
    );
  });
});
