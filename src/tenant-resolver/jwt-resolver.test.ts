import { describe, expect, it } from "vitest";
import { sign } from "jsonwebtoken";
import { JWTTenantResolver } from "./jwt-resolver.js";

describe("JWTTenantResolver", () => {
  const secret = "test-secret";

  it("should resolve tenant from JWT claim", () => {
    const token = sign({ tenant_id: "tenant-abc" }, secret);
    const resolver = new JWTTenantResolver({ claim: "tenant_id", secret });

    const result = resolver.resolve({
      headers: { authorization: `Bearer ${token}` },
    });

    expect(result).not.toBeNull();
    expect(result!.tenantId).toBe("tenant-abc");
  });

  it("exposes no claims by default", () => {
    const token = sign({ tenant_id: "t1", email: "a@b.c", roles: ["admin"] }, secret);
    const resolver = new JWTTenantResolver({ claim: "tenant_id", secret });

    const result = resolver.resolve({
      headers: { authorization: `Bearer ${token}` },
    });

    expect(result!.metadata).toEqual({});
  });

  it("copies only whitelisted claims into metadata", () => {
    const token = sign({ tenant_id: "t1", email: "a@b.c", roles: ["admin"] }, secret);
    const resolver = new JWTTenantResolver({
      claim: "tenant_id",
      secret,
      claimsToExpose: ["email"],
    });

    const result = resolver.resolve({
      headers: { authorization: `Bearer ${token}` },
    });

    expect(result!.metadata).toEqual({ email: "a@b.c" });
  });

  it("should return null when authorization header is missing", () => {
    const resolver = new JWTTenantResolver({ claim: "tenant_id", secret });
    const result = resolver.resolve({ headers: {} });

    expect(result).toBeNull();
  });

  it("should return null when token is invalid", () => {
    const resolver = new JWTTenantResolver({ claim: "tenant_id", secret });
    const result = resolver.resolve({
      headers: { authorization: "Bearer invalid-token" },
    });

    expect(result).toBeNull();
  });

  it("should return null when claim is missing", () => {
    const token = sign({ org_id: "tenant-abc" }, secret);
    const resolver = new JWTTenantResolver({ claim: "tenant_id", secret });

    const result = resolver.resolve({
      headers: { authorization: `Bearer ${token}` },
    });

    expect(result).toBeNull();
  });

  it("should validate audience when configured", () => {
    const token = sign({ tenant_id: "t1" }, secret, { audience: "expected-aud" });
    const resolver = new JWTTenantResolver({
      claim: "tenant_id",
      secret,
      audience: "wrong-aud",
    });

    const result = resolver.resolve({
      headers: { authorization: `Bearer ${token}` },
    });

    expect(result).toBeNull();
  });

  it("should validate issuer when configured", () => {
    const token = sign({ tenant_id: "t1" }, secret, { issuer: "expected-iss" });
    const resolver = new JWTTenantResolver({
      claim: "tenant_id",
      secret,
      issuer: "wrong-iss",
    });

    const result = resolver.resolve({
      headers: { authorization: `Bearer ${token}` },
    });

    expect(result).toBeNull();
  });

  it("should accept lowercase bearer prefix", () => {
    const token = sign({ tenant_id: "t1" }, secret);
    const resolver = new JWTTenantResolver({ claim: "tenant_id", secret });

    const result = resolver.resolve({
      headers: { authorization: `bearer ${token}` },
    });

    expect(result).not.toBeNull();
    expect(result!.tenantId).toBe("t1");
  });
});
