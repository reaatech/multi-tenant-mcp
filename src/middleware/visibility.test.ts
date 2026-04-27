/* eslint-disable @typescript-eslint/no-deprecated, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { describe, expect, it, vi } from "vitest";
import { createMultiTenantMiddleware } from "./composer.js";
import { TenantContextStore } from "../tenant-resolver/context-store.js";
import { MiddlewareErrorCode } from "../types/index.js";
import type { TenantContext } from "../types/index.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

function createMockServer() {
  const handlers = new Map<string, (req: unknown) => unknown>();
  return {
    setRequestHandler: vi.fn((method: string, handler: (req: unknown) => unknown) => {
      handlers.set(method, handler);
    }),
    handlers,
  };
}

function ctx(tenantId: string): TenantContext {
  return { tenantId, metadata: {}, resolvedAt: new Date() };
}

describe("Visibility middleware integration", () => {
  describe("tools", () => {
    it("should filter tools/list by allow-list", async () => {
      const store = new TenantContextStore();
      const mockServer = createMockServer();
      const middleware = createMultiTenantMiddleware({
        tenantContextStore: store,
        toolVisibility: { "tenant-a": { type: "allow", items: ["tool-1", "tool-2"] } },
      });

      middleware.handle(mockServer as unknown as Server, "tools/list", () => ({
        tools: [{ name: "tool-1" }, { name: "tool-2" }, { name: "tool-3" }],
      }));

      const handler = mockServer.handlers.get("tools/list")!;
      const result = await store.run(ctx("tenant-a"), () => handler({}));

      expect(result.tools).toHaveLength(2);
      expect(result.tools.map((t: { name: string }) => t.name)).toEqual(["tool-1", "tool-2"]);
    });

    it("should filter tools/list by deny-list", async () => {
      const store = new TenantContextStore();
      const mockServer = createMockServer();
      const middleware = createMultiTenantMiddleware({
        tenantContextStore: store,
        toolVisibility: { "tenant-b": { type: "deny", items: ["tool-2"] } },
      });

      middleware.handle(mockServer as unknown as Server, "tools/list", () => ({
        tools: [{ name: "tool-1" }, { name: "tool-2" }, { name: "tool-3" }],
      }));

      const handler = mockServer.handlers.get("tools/list")!;
      const result = await store.run(ctx("tenant-b"), () => handler({}));

      expect(result.tools).toHaveLength(2);
      expect(result.tools.map((t: { name: string }) => t.name)).toEqual(["tool-1", "tool-3"]);
    });

    it("should allow tools/call for visible tools", async () => {
      const store = new TenantContextStore();
      const mockServer = createMockServer();
      const middleware = createMultiTenantMiddleware({
        tenantContextStore: store,
        toolVisibility: { "tenant-a": { type: "allow", items: ["tool-1"] } },
      });

      middleware.handle(mockServer as unknown as Server, "tools/call", () => ({
        content: [{ type: "text", text: "ok" }],
      }));

      const handler = mockServer.handlers.get("tools/call")!;
      const result = await store.run(ctx("tenant-a"), () =>
        handler({ params: { name: "tool-1" } })
      );

      expect(result.content[0].text).toBe("ok");
    });

    it("should reject tools/call for hidden tools", async () => {
      const store = new TenantContextStore();
      const mockServer = createMockServer();
      const middleware = createMultiTenantMiddleware({
        tenantContextStore: store,
        toolVisibility: { "tenant-a": { type: "allow", items: ["tool-1"] } },
      });

      middleware.handle(mockServer as unknown as Server, "tools/call", () => ({
        content: [{ type: "text", text: "ok" }],
      }));

      const handler = mockServer.handlers.get("tools/call")!;
      await store.run(ctx("tenant-a"), async () => {
        await expect(handler({ params: { name: "tool-2" } })).rejects.toMatchObject({
          code: MiddlewareErrorCode.ToolForbidden,
          message: 'Tool "tool-2" is not accessible to this tenant',
        });
      });
    });
  });

  describe("resources", () => {
    it("should filter resources/list by allow-list", async () => {
      const store = new TenantContextStore();
      const mockServer = createMockServer();
      const middleware = createMultiTenantMiddleware({
        tenantContextStore: store,
        resourceVisibility: {
          "tenant-a": { type: "allow", items: ["file:///a.txt", "file:///b.txt"] },
        },
      });

      middleware.handle(mockServer as unknown as Server, "resources/list", () => ({
        resources: [{ uri: "file:///a.txt" }, { uri: "file:///b.txt" }, { uri: "file:///c.txt" }],
      }));

      const handler = mockServer.handlers.get("resources/list")!;
      const result = await store.run(ctx("tenant-a"), () => handler({}));

      expect(result.resources).toHaveLength(2);
      expect(result.resources.map((r: { uri: string }) => r.uri)).toEqual([
        "file:///a.txt",
        "file:///b.txt",
      ]);
    });

    it("should reject resources/read for hidden resources", async () => {
      const store = new TenantContextStore();
      const mockServer = createMockServer();
      const middleware = createMultiTenantMiddleware({
        tenantContextStore: store,
        resourceVisibility: { "tenant-a": { type: "allow", items: ["file:///a.txt"] } },
      });

      middleware.handle(mockServer as unknown as Server, "resources/read", () => ({
        contents: [{ uri: "file:///b.txt", text: "secret" }],
      }));

      const handler = mockServer.handlers.get("resources/read")!;
      await store.run(ctx("tenant-a"), async () => {
        await expect(handler({ params: { uri: "file:///b.txt" } })).rejects.toMatchObject({
          code: MiddlewareErrorCode.ResourceForbidden,
          message: 'Resource "file:///b.txt" is not accessible to this tenant',
        });
      });
    });
  });

  describe("prompts", () => {
    it("should filter prompts/list by allow-list", async () => {
      const store = new TenantContextStore();
      const mockServer = createMockServer();
      const middleware = createMultiTenantMiddleware({
        tenantContextStore: store,
        promptVisibility: { "tenant-a": { type: "allow", items: ["prompt-1"] } },
      });

      middleware.handle(mockServer as unknown as Server, "prompts/list", () => ({
        prompts: [{ name: "prompt-1" }, { name: "prompt-2" }],
      }));

      const handler = mockServer.handlers.get("prompts/list")!;
      const result = await store.run(ctx("tenant-a"), () => handler({}));

      expect(result.prompts).toHaveLength(1);
      expect(result.prompts[0].name).toBe("prompt-1");
    });

    it("should reject prompts/get for hidden prompts", async () => {
      const store = new TenantContextStore();
      const mockServer = createMockServer();
      const middleware = createMultiTenantMiddleware({
        tenantContextStore: store,
        promptVisibility: { "tenant-a": { type: "allow", items: ["prompt-1"] } },
      });

      middleware.handle(mockServer as unknown as Server, "prompts/get", () => ({
        messages: [{ role: "user", content: { type: "text", text: "hello" } }],
      }));

      const handler = mockServer.handlers.get("prompts/get")!;
      await store.run(ctx("tenant-a"), async () => {
        await expect(handler({ params: { name: "prompt-2" } })).rejects.toMatchObject({
          code: MiddlewareErrorCode.PromptForbidden,
          message: 'Prompt "prompt-2" is not accessible to this tenant',
        });
      });
    });
  });

  describe("dynamic policies", () => {
    it("should evaluate dynamic tool visibility at runtime", async () => {
      const store = new TenantContextStore();
      const mockServer = createMockServer();
      const middleware = createMultiTenantMiddleware({
        tenantContextStore: store,
        toolVisibility: {
          "tenant-c": {
            type: "dynamic",
            evaluator: (name) => name.startsWith("allowed-"),
          },
        },
      });

      middleware.handle(mockServer as unknown as Server, "tools/list", () => ({
        tools: [{ name: "allowed-x" }, { name: "blocked-y" }],
      }));

      const handler = mockServer.handlers.get("tools/list")!;
      const result = await store.run(ctx("tenant-c"), () => handler({}));

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe("allowed-x");
    });

    it("should evaluate dynamic tool call at runtime", async () => {
      const store = new TenantContextStore();
      const mockServer = createMockServer();
      const middleware = createMultiTenantMiddleware({
        tenantContextStore: store,
        toolVisibility: {
          "tenant-c": {
            type: "dynamic",
            evaluator: (name) => name.startsWith("allowed-"),
          },
        },
      });

      middleware.handle(mockServer as unknown as Server, "tools/call", () => ({
        content: [{ type: "text", text: "ok" }],
      }));

      const handler = mockServer.handlers.get("tools/call")!;
      await store.run(ctx("tenant-c"), async () => {
        await expect(handler({ params: { name: "blocked-y" } })).rejects.toMatchObject({
          code: MiddlewareErrorCode.ToolForbidden,
        });
      });
    });
  });
});
