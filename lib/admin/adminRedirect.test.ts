import { describe, expect, it } from "vitest";
import {
  buildAdminLoginHref,
  sanitizeAdminNextPath,
} from "@/lib/admin/adminRedirect";

describe("sanitizeAdminNextPath", () => {
  it("allows admin-local redirects", () => {
    expect(sanitizeAdminNextPath("/admin/campaigns")).toBe("/admin/campaigns");
    expect(sanitizeAdminNextPath("/admin?tab=overview")).toBe(
      "/admin?tab=overview"
    );
  });

  it("falls back for login loops and non-admin paths", () => {
    expect(sanitizeAdminNextPath("/admin/login")).toBe("/admin");
    expect(sanitizeAdminNextPath("/")).toBe("/admin");
    expect(sanitizeAdminNextPath("/dashboard")).toBe("/admin");
  });

  it("rejects external and protocol-relative URLs", () => {
    expect(sanitizeAdminNextPath("https://example.com/admin")).toBe("/admin");
    expect(sanitizeAdminNextPath("//example.com/admin")).toBe("/admin");
  });

  it("builds encoded admin login URLs", () => {
    expect(buildAdminLoginHref("/admin/campaigns")).toBe(
      "/admin/login?next=%2Fadmin%2Fcampaigns"
    );
  });
});
