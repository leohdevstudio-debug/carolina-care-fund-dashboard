import { describe, expect, it } from "vitest";
import {
  formatAdminDataError,
  formatAdminRouteError,
} from "@/lib/admin/adminDataError";
import { SupabaseAdminRequestError } from "@/lib/admin/supabaseAdmin";

describe("formatAdminDataError", () => {
  it("explains invalid Supabase service role keys", () => {
    const error = new SupabaseAdminRequestError(
      '{"message":"Invalid API key","hint":"Double check your Supabase `anon` or `service_role` API key."}',
      401
    );

    expect(formatAdminDataError(error)).toContain(
      "Set SUPABASE_SERVICE_ROLE_KEY"
    );
  });

  it("explains missing admin database SQL", () => {
    const error = new SupabaseAdminRequestError(
      '{"message":"Could not find the table fund.v_admin_expense"}',
      404
    );

    expect(formatAdminDataError(error)).toContain("admin-expense-mvp.sql");
  });

  it("returns a generic message for unknown errors", () => {
    expect(formatAdminDataError(new Error("Unexpected"))).toBe(
      "Unable to load admin expenses."
    );
  });
});

describe("formatAdminRouteError", () => {
  it("uses the same friendly setup message for API responses", () => {
    const error = new SupabaseAdminRequestError(
      '{"message":"Invalid API key"}',
      401
    );

    expect(formatAdminRouteError(error, "Unable to list expenses")).toContain(
      "Set SUPABASE_SERVICE_ROLE_KEY"
    );
  });
});
