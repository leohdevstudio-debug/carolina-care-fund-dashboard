import { describe, expect, it } from "vitest";
import {
  createAdminSessionToken,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from "@/lib/admin/session";

const secret = "test-secret-with-enough-length";

describe("admin session tokens", () => {
  it("verifies a freshly created token", () => {
    const token = createAdminSessionToken(secret, () =>
      new Date("2026-06-08T00:00:00.000Z")
    );

    expect(
      verifyAdminSessionToken(token, secret, () =>
        new Date("2026-06-08T00:10:00.000Z")
      )
    ).toMatchObject({
      sub: "admin",
      exp: Date.parse("2026-06-08T08:00:00.000Z"),
    });
  });

  it("rejects an expired token", () => {
    const token = createAdminSessionToken(secret, () =>
      new Date("2026-06-08T00:00:00.000Z")
    );

    expect(
      verifyAdminSessionToken(token, secret, () =>
        new Date("2026-06-08T08:00:01.000Z")
      )
    ).toBeNull();
  });

  it("rejects a tampered token", () => {
    const token = createAdminSessionToken(secret, () =>
      new Date("2026-06-08T00:00:00.000Z")
    );

    expect(
      verifyAdminSessionToken(`${token}x`, secret, () =>
        new Date("2026-06-08T00:10:00.000Z")
      )
    ).toBeNull();
  });
});

describe("admin password comparison", () => {
  it("accepts the configured password", () => {
    expect(verifyAdminPassword("admin-pass", "admin-pass")).toBe(true);
  });

  it("rejects a different password", () => {
    expect(verifyAdminPassword("wrong", "admin-pass")).toBe(false);
  });

  it("rejects an empty configured password", () => {
    expect(verifyAdminPassword("anything", "")).toBe(false);
  });
});
