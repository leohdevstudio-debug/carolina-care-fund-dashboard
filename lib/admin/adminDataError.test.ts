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

  it("explains missing category admin database SQL", () => {
    const error = new SupabaseAdminRequestError(
      '{"message":"Could not find the table fund.v_admin_expense_category"}',
      404
    );

    expect(formatAdminDataError(error)).toContain("admin-expense-mvp.sql");
  });

  it("explains missing donation admin database SQL", () => {
    const error = new SupabaseAdminRequestError(
      '{"message":"Could not find the table fund.v_admin_donation"}',
      404
    );

    expect(formatAdminDataError(error)).toContain("admin-expense-mvp.sql");
  });

  it("explains missing donor admin database SQL", () => {
    const error = new SupabaseAdminRequestError(
      '{"message":"Could not find the table fund.v_admin_donor"}',
      404
    );

    expect(formatAdminDataError(error)).toContain("admin-expense-mvp.sql");
  });

  it("explains missing budget admin database SQL", () => {
    const error = new SupabaseAdminRequestError(
      '{"message":"Could not find the table fund.v_admin_budget"}',
      404
    );

    expect(formatAdminDataError(error)).toContain("admin-expense-mvp.sql");
  });

  it("explains missing campaign admin database SQL", () => {
    const error = new SupabaseAdminRequestError(
      '{"message":"Could not find the table fund.v_admin_campaign"}',
      404
    );

    expect(formatAdminDataError(error)).toContain("admin-expense-mvp.sql");
  });

  it("explains missing exchange-rate admin database SQL", () => {
    const error = new SupabaseAdminRequestError(
      '{"message":"Could not find the table fund.v_admin_exchange_rate"}',
      404
    );

    expect(formatAdminDataError(error)).toContain("admin-expense-mvp.sql");
  });

  it("explains missing schema usage grants", () => {
    const error = new SupabaseAdminRequestError(
      '{"code":"42501","message":"permission denied for schema fund"}',
      403
    );

    expect(formatAdminDataError(error)).toContain("admin-expense-mvp.sql");
  });

  it("explains missing referenced table grants", () => {
    const error = new SupabaseAdminRequestError(
      '{"code":"42501","message":"permission denied for table currency"}',
      403
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
