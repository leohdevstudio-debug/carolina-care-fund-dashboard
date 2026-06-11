import type { DisplayCurrency } from "@/lib/currency";
import { getCurrentExchangeRates } from "@/lib/exchangeRates";
import { adminFetch } from "@/lib/admin/supabaseAdmin";
import type { AdminBudgetInput } from "@/lib/admin/budgetValidation";
import { recalculateCampaignTargets } from "@/services/admin/campaignTargets";

export type AdminBudgetStatus = "active" | "deleted" | "all";

export type AdminBudgetRow = {
  budget_id: number;
  campaign_id: number;
  campaign_name: string;
  expense_category_id: number;
  category_name: string;
  category_group: string;
  budget_description: string;
  estimated_amount: number;
  currency_code: DisplayCurrency;
  exchange_rate_to_base: number | null;
  base_currency_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_reason: string | null;
  deleted_by: string | null;
};

type BudgetListFilters = {
  status?: AdminBudgetStatus;
  search?: string;
};

type AuditAction = "create" | "update" | "soft_delete" | "restore";

function statusFilter(status: AdminBudgetStatus | undefined): string {
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

function buildListQuery(filters: BudgetListFilters): string {
  const query = new URLSearchParams();
  query.set("select", "*");
  query.set("order", "campaign_name.asc,category_group.asc,category_name.asc");
  query.set("limit", "100");

  const status = statusFilter(filters.status);
  if (status) {
    query.set("deleted_at", status);
  }

  if (filters.search?.trim()) {
    const search = sanitizeSearch(filters.search);
    query.set(
      "or",
      `(budget_description.ilike.*${search}*,campaign_name.ilike.*${search}*,category_name.ilike.*${search}*,category_group.ilike.*${search}*,notes.ilike.*${search}*)`
    );
  }

  return query.toString();
}

function byIdQuery(budgetId: number): string {
  return `select=*&budget_id=eq.${budgetId}&limit=1`;
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

function calculateExchangeRateToBase(
  currency: DisplayCurrency,
  rates: Record<DisplayCurrency, number>
): number {
  const rate = rates[currency];

  if (!rate || rate <= 0) {
    throw new Error(`Missing exchange rate for ${currency}`);
  }

  return Number((1 / rate).toFixed(8));
}

function requireRow(rows: AdminBudgetRow[], message: string): AdminBudgetRow {
  const row = rows[0];

  if (!row) {
    throw new Error(message);
  }

  return row;
}

async function fetchBudget(
  budgetId: number,
  message: string
): Promise<AdminBudgetRow> {
  return requireRow(
    await adminFetch<AdminBudgetRow[]>("v_admin_budget", byIdQuery(budgetId)),
    message
  );
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
      p_entity_table: "budget",
      p_new_data: newData,
      p_old_data: oldData,
      p_reason: reason ?? null,
    },
  });
}

function budgetBody(input: AdminBudgetInput) {
  return {
    campaign_id: input.campaignId,
    expense_category_id: input.expenseCategoryId,
    budget_description: input.budgetDescription,
    estimated_amount: input.estimatedAmount,
    currency_code: input.currencyCode,
    notes: input.notes,
    updated_by: "admin",
  };
}

export async function listAdminBudgets(
  filters: BudgetListFilters = {}
): Promise<AdminBudgetRow[]> {
  return adminFetch<AdminBudgetRow[]>("v_admin_budget", buildListQuery(filters));
}

export async function createAdminBudget(
  input: AdminBudgetInput
): Promise<AdminBudgetRow> {
  const rates = await getCurrentExchangeRates();
  const insertedRows = await adminFetch<Array<{ budget_id: number }>>(
    "budget",
    "select=budget_id",
    {
      method: "POST",
      prefer: "return=representation",
      body: {
        ...budgetBody(input),
        base_currency_amount: calculateBaseCurrencyAmount(
          input.estimatedAmount,
          input.currencyCode,
          rates.rates
        ),
        created_by: "admin",
        exchange_rate_to_base: calculateExchangeRateToBase(
          input.currencyCode,
          rates.rates
        ),
      },
    }
  );
  const inserted = insertedRows[0];
  if (!inserted) {
    throw new Error("Budget was not created");
  }

  const row = await fetchBudget(inserted.budget_id, "Budget was not created");

  await recalculateCampaignTargets([row.campaign_id]);
  await writeAudit(String(row.budget_id), "create", null, row);

  return row;
}

export async function updateAdminBudget(
  budgetId: number,
  input: AdminBudgetInput
): Promise<AdminBudgetRow> {
  const previous = await fetchBudget(budgetId, "Budget was not found");
  const needsRateSnapshot =
    previous.estimated_amount !== input.estimatedAmount ||
    previous.currency_code !== input.currencyCode;
  const rates = needsRateSnapshot ? await getCurrentExchangeRates() : null;
  const updatedRows = await adminFetch<Array<{ budget_id: number }>>(
    "budget",
    `budget_id=eq.${budgetId}&select=budget_id`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        ...budgetBody(input),
        updated_on: new Date().toISOString(),
        ...(rates
          ? {
              base_currency_amount: calculateBaseCurrencyAmount(
                input.estimatedAmount,
                input.currencyCode,
                rates.rates
              ),
              exchange_rate_to_base: calculateExchangeRateToBase(
                input.currencyCode,
                rates.rates
              ),
            }
          : {}),
      },
    }
  );
  if (!updatedRows[0]) {
    throw new Error("Budget was not updated");
  }

  const row = await fetchBudget(budgetId, "Budget was not updated");

  await recalculateCampaignTargets(
    previous.campaign_id === row.campaign_id
      ? [row.campaign_id]
      : [previous.campaign_id, row.campaign_id]
  );
  await writeAudit(String(budgetId), "update", previous, row);

  return row;
}

export async function softDeleteAdminBudget(
  budgetId: number,
  reason: string
): Promise<AdminBudgetRow> {
  const previous = await fetchBudget(budgetId, "Budget was not found");
  const deletedAt = new Date().toISOString();
  const updatedRows = await adminFetch<Array<{ budget_id: number }>>(
    "budget",
    `budget_id=eq.${budgetId}&select=budget_id`,
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
  if (!updatedRows[0]) {
    throw new Error("Budget was not deleted");
  }

  const row = await fetchBudget(budgetId, "Budget was not deleted");

  await recalculateCampaignTargets([row.campaign_id]);
  await writeAudit(String(budgetId), "soft_delete", previous, row, reason);

  return row;
}

export async function restoreAdminBudget(
  budgetId: number
): Promise<AdminBudgetRow> {
  const previous = await fetchBudget(budgetId, "Budget was not found");
  const updatedRows = await adminFetch<Array<{ budget_id: number }>>(
    "budget",
    `budget_id=eq.${budgetId}&select=budget_id`,
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
  if (!updatedRows[0]) {
    throw new Error("Budget was not restored");
  }

  const row = await fetchBudget(budgetId, "Budget was not restored");

  await recalculateCampaignTargets([row.campaign_id]);
  await writeAudit(String(budgetId), "restore", previous, row);

  return row;
}
