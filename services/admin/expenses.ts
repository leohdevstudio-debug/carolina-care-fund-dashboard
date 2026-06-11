import type { DisplayCurrency } from "@/lib/currency";
import { adminFetch } from "@/lib/admin/supabaseAdmin";
import type { AdminExpenseInput } from "@/lib/admin/expenseValidation";
import { getAdminExchangeRateSnapshotForDate } from "@/services/admin/exchangeRateSnapshots";

export type AdminExpenseStatus = "active" | "deleted" | "all";

export type AdminExpenseRow = {
  expense_id: number;
  campaign_id: number;
  campaign_name: string;
  expense_date: string;
  expense_category_id: number;
  category_name: string;
  category_group: string;
  expense_description: string;
  original_amount: number;
  currency_code: DisplayCurrency;
  base_currency_amount: number;
  aud_to_usd_rate: number | null;
  aud_to_twd_rate: number | null;
  exchange_rate_date: string | null;
  exchange_rate_source: string | null;
  exchange_rate_fetched_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_reason: string | null;
  deleted_by: string | null;
};

type ExpenseListFilters = {
  status?: AdminExpenseStatus;
  search?: string;
};

type AuditAction = "create" | "update" | "soft_delete" | "restore";

function statusFilter(status: AdminExpenseStatus | undefined): string {
  if (status === "deleted") {
    return "not.is.null";
  }

  if (status === "all") {
    return "";
  }

  return "is.null";
}

function sanitizeSearch(value: string): string {
  return value.trim().replace(/[(),*]/g, " ");
}

function buildListQuery(filters: ExpenseListFilters): string {
  const query = new URLSearchParams();
  query.set("select", "*");
  query.set("order", "expense_date.desc");
  query.set("limit", "100");

  const status = statusFilter(filters.status);
  if (status) {
    query.set("deleted_at", status);
  }

  if (filters.search?.trim()) {
    const search = sanitizeSearch(filters.search);
    query.set(
      "or",
      `(expense_description.ilike.*${search}*,category_name.ilike.*${search}*,campaign_name.ilike.*${search}*)`
    );
  }

  return query.toString();
}

function calculateBaseCurrencyAmount(
  amount: number,
  currency: DisplayCurrency,
  rates: Record<DisplayCurrency, number>
): number {
  const rate = rates[currency];

  if (!rate || rate <= 0) {
    throw new Error(`Missing exchange rate for ${currency}`);
  }

  return Number((amount / rate).toFixed(2));
}

function requireRow(rows: AdminExpenseRow[], message: string): AdminExpenseRow {
  const row = rows[0];

  if (!row) {
    throw new Error(message);
  }

  return row;
}

async function writeAudit(
  entityId: string,
  action: AuditAction,
  oldData: unknown,
  newData: unknown,
  reason?: string
): Promise<void> {
  await adminFetch("rpc/admin_insert_audit_log", "", {
    method: "POST",
    body: {
      p_action: action,
      p_entity_id: entityId,
      p_entity_table: "expense",
      p_new_data: newData,
      p_old_data: oldData,
      p_reason: reason ?? null,
    },
  });
}

export async function listAdminExpenses(
  filters: ExpenseListFilters = {}
): Promise<AdminExpenseRow[]> {
  return adminFetch<AdminExpenseRow[]>(
    "v_admin_expense",
    buildListQuery(filters)
  );
}

export async function createAdminExpense(
  input: AdminExpenseInput
): Promise<AdminExpenseRow> {
  const rates = await getAdminExchangeRateSnapshotForDate(input.expenseDate);
  const rows = await adminFetch<AdminExpenseRow[]>("expense", "select=*", {
    method: "POST",
    prefer: "return=representation",
    body: {
      aud_to_twd_rate: rates.rates.TWD,
      aud_to_usd_rate: rates.rates.USD,
      base_currency_amount: calculateBaseCurrencyAmount(
        input.originalAmount,
        input.currencyCode,
        rates.rates
      ),
      campaign_id: input.campaignId,
      currency_code: input.currencyCode,
      exchange_rate_date: input.expenseDate,
      exchange_rate_fetched_at: rates.fetchedAt,
      exchange_rate_source: rates.source,
      created_by: "admin",
      expense_category_id: input.expenseCategoryId,
      expense_date: input.expenseDate,
      expense_description: input.expenseDescription,
      original_amount: input.originalAmount,
      updated_by: "admin",
    },
  });
  const row = requireRow(rows, "Expense was not created");

  await writeAudit(String(row.expense_id), "create", null, row);

  return row;
}

export async function updateAdminExpense(
  expenseId: number,
  input: AdminExpenseInput
): Promise<AdminExpenseRow> {
  const previous = requireRow(
    await adminFetch<AdminExpenseRow[]>(
      "v_admin_expense",
      `select=*&expense_id=eq.${expenseId}&limit=1`
    ),
    "Expense was not found"
  );
  const needsRateSnapshot =
    previous.expense_date !== input.expenseDate ||
    previous.original_amount !== input.originalAmount ||
    previous.currency_code !== input.currencyCode;
  const rates = needsRateSnapshot
    ? await getAdminExchangeRateSnapshotForDate(input.expenseDate)
    : null;
  const rows = await adminFetch<AdminExpenseRow[]>(
    "expense",
    `expense_id=eq.${expenseId}&select=*`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        campaign_id: input.campaignId,
        currency_code: input.currencyCode,
        expense_category_id: input.expenseCategoryId,
        expense_date: input.expenseDate,
        expense_description: input.expenseDescription,
        original_amount: input.originalAmount,
        updated_by: "admin",
        updated_on: new Date().toISOString(),
        ...(rates
          ? {
              aud_to_twd_rate: rates.rates.TWD,
              aud_to_usd_rate: rates.rates.USD,
              base_currency_amount: calculateBaseCurrencyAmount(
                input.originalAmount,
                input.currencyCode,
                rates.rates
              ),
              exchange_rate_date: input.expenseDate,
              exchange_rate_fetched_at: rates.fetchedAt,
              exchange_rate_source: rates.source,
            }
          : {}),
      },
    }
  );
  const row = requireRow(rows, "Expense was not updated");

  await writeAudit(String(expenseId), "update", previous, row);

  return row;
}

export async function softDeleteAdminExpense(
  expenseId: number,
  reason: string
): Promise<AdminExpenseRow> {
  const previous = requireRow(
    await adminFetch<AdminExpenseRow[]>(
      "v_admin_expense",
      `select=*&expense_id=eq.${expenseId}&limit=1`
    ),
    "Expense was not found"
  );
  const deletedAt = new Date().toISOString();
  const rows = await adminFetch<AdminExpenseRow[]>(
    "expense",
    `expense_id=eq.${expenseId}&select=*`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        deleted_at: deletedAt,
        deleted_by: "admin",
        deleted_reason: reason,
        updated_by: "admin",
        updated_on: deletedAt,
      },
    }
  );
  const row = requireRow(rows, "Expense was not deleted");

  await writeAudit(String(expenseId), "soft_delete", previous, row, reason);

  return row;
}

export async function restoreAdminExpense(
  expenseId: number
): Promise<AdminExpenseRow> {
  const previous = requireRow(
    await adminFetch<AdminExpenseRow[]>(
      "v_admin_expense",
      `select=*&expense_id=eq.${expenseId}&limit=1`
    ),
    "Expense was not found"
  );
  const rows = await adminFetch<AdminExpenseRow[]>(
    "expense",
    `expense_id=eq.${expenseId}&select=*`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        deleted_at: null,
        deleted_by: null,
        deleted_reason: null,
        updated_by: "admin",
        updated_on: new Date().toISOString(),
      },
    }
  );
  const row = requireRow(rows, "Expense was not restored");

  await writeAudit(String(expenseId), "restore", previous, row);

  return row;
}
