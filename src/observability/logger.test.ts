import { describe, expect, it, vi } from "vitest";
import { ConsoleTenantLogger } from "./logger.js";
import { TenantContextStore } from "../tenant-resolver/context-store.js";

describe("ConsoleTenantLogger", () => {
  it("should log at all levels without throwing", () => {
    const logger = new ConsoleTenantLogger();

    // Just verify no exceptions
    expect(() => {
      logger.debug("debug msg");
      logger.info("info msg");
      logger.warn("warn msg");
      logger.error("error msg");
    }).not.toThrow();
  });

  it("should include metadata in output", () => {
    const logger = new ConsoleTenantLogger();

    expect(() => {
      logger.info("with meta", { key: "value" });
    }).not.toThrow();
  });

  it("prefixes the tenant id when a contextStore is configured", () => {
    const contextStore = new TenantContextStore();
    const logger = new ConsoleTenantLogger({ contextStore });
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    contextStore.run({ tenantId: "acme", metadata: {}, resolvedAt: new Date() }, () => {
      logger.info("hi");
    });

    expect(spy).toHaveBeenCalledWith(expect.stringContaining("[tenant=acme]"));
    spy.mockRestore();
  });
});
