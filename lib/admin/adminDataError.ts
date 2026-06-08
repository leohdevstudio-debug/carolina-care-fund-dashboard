import { SupabaseAdminRequestError } from "@/lib/admin/supabaseAdmin";

const INVALID_SERVICE_ROLE_MESSAGE =
  "Admin database connection is not configured. Set SUPABASE_SERVICE_ROLE_KEY in .env.local with the real Supabase service_role key, then restart the local server.";

const MISSING_ADMIN_SQL_MESSAGE =
  "Admin database objects are not ready. Apply docs/database/admin-expense-mvp.sql in Supabase, then reload this page.";

function errorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function formatAdminDataError(error: unknown): string {
  const message = errorText(error);

  if (
    error instanceof SupabaseAdminRequestError &&
    message.includes("Invalid API key")
  ) {
    return INVALID_SERVICE_ROLE_MESSAGE;
  }

  if (message.includes("Missing SUPABASE_SERVICE_ROLE_KEY")) {
    return INVALID_SERVICE_ROLE_MESSAGE;
  }

  if (
    message.includes("v_admin_expense") ||
    message.includes("admin_insert_audit_log") ||
    message.includes("fund.expense")
  ) {
    return MISSING_ADMIN_SQL_MESSAGE;
  }

  return "Unable to load admin expenses.";
}

export function formatAdminRouteError(
  error: unknown,
  fallback: string
): string {
  const friendlyMessage = formatAdminDataError(error);

  if (friendlyMessage !== "Unable to load admin expenses.") {
    return friendlyMessage;
  }

  return error instanceof Error ? error.message : fallback;
}
