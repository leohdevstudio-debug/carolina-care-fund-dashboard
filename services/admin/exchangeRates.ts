import { adminFetch } from "@/lib/admin/supabaseAdmin";
import type { AdminExchangeRateInput } from "@/lib/admin/exchangeRateValidation";

export type AdminExchangeRateQuoteFilter = "USD" | "TWD" | "all";

export type AdminExchangeRateRow = {
  exchange_rate_id: number;
  rate_date: string;
  base_currency_code: "AUD";
  quote_currency_code: "USD" | "TWD";
  rate: number;
  source: string;
  fetched_at: string;
  created_at: string;
};

type ExchangeRateListFilters = {
  quoteCurrencyCode?: AdminExchangeRateQuoteFilter;
  search?: string;
};

type AuditAction = "create" | "update";

function sanitizeSearch(value: string): string {
  return value.trim().replace(/[(),*]/g, " ");
}

function buildListQuery(filters: ExchangeRateListFilters): string {
  const query = new URLSearchParams();
  query.set("select", "*");
  query.set("order", "rate_date.desc,fetched_at.desc");
  query.set("limit", "100");

  if (
    filters.quoteCurrencyCode === "USD" ||
    filters.quoteCurrencyCode === "TWD"
  ) {
    query.set("quote_currency_code", `eq.${filters.quoteCurrencyCode}`);
  }

  if (filters.search?.trim()) {
    const search = sanitizeSearch(filters.search);
    query.set("or", `(source.ilike.*${search}*)`);
  }

  return query.toString();
}

function byIdQuery(exchangeRateId: number): string {
  return `select=*&exchange_rate_id=eq.${exchangeRateId}&limit=1`;
}

function requireRow(
  rows: AdminExchangeRateRow[],
  message: string
): AdminExchangeRateRow {
  const row = rows[0];

  if (!row) {
    throw new Error(message);
  }

  return row;
}

async function fetchExchangeRate(
  exchangeRateId: number,
  message: string
): Promise<AdminExchangeRateRow> {
  return requireRow(
    await adminFetch<AdminExchangeRateRow[]>(
      "v_admin_exchange_rate",
      byIdQuery(exchangeRateId)
    ),
    message
  );
}

async function writeAudit(
  entityId: string,
  action: AuditAction,
  oldData: unknown,
  newData: unknown
): Promise<void> {
  await adminFetch("rpc/admin_insert_audit_log", "", {
    method: "POST",
    body: {
      p_action: action,
      p_entity_id: entityId,
      p_entity_table: "exchange_rates",
      p_new_data: newData,
      p_old_data: oldData,
      p_reason: null,
    },
  });
}

function exchangeRateBody(input: AdminExchangeRateInput) {
  return {
    rate_date: input.rateDate,
    base_currency_code: "AUD",
    quote_currency_code: input.quoteCurrencyCode,
    rate: input.rate,
    source: input.source,
    fetched_at: input.fetchedAt,
  };
}

export async function listAdminExchangeRates(
  filters: ExchangeRateListFilters = {}
): Promise<AdminExchangeRateRow[]> {
  return adminFetch<AdminExchangeRateRow[]>(
    "v_admin_exchange_rate",
    buildListQuery(filters)
  );
}

export async function createAdminExchangeRate(
  input: AdminExchangeRateInput
): Promise<AdminExchangeRateRow> {
  const insertedRows = await adminFetch<Array<{ exchange_rate_id: number }>>(
    "exchange_rates",
    "select=exchange_rate_id",
    {
      method: "POST",
      prefer: "return=representation",
      body: exchangeRateBody(input),
    }
  );
  const inserted = insertedRows[0];
  if (!inserted) {
    throw new Error("Exchange rate was not created");
  }

  const row = await fetchExchangeRate(
    inserted.exchange_rate_id,
    "Exchange rate was not created"
  );

  await writeAudit(String(row.exchange_rate_id), "create", null, row);

  return row;
}

export async function updateAdminExchangeRate(
  exchangeRateId: number,
  input: AdminExchangeRateInput
): Promise<AdminExchangeRateRow> {
  const previous = await fetchExchangeRate(
    exchangeRateId,
    "Exchange rate was not found"
  );
  const updatedRows = await adminFetch<Array<{ exchange_rate_id: number }>>(
    "exchange_rates",
    `exchange_rate_id=eq.${exchangeRateId}&select=exchange_rate_id`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: exchangeRateBody(input),
    }
  );
  if (!updatedRows[0]) {
    throw new Error("Exchange rate was not updated");
  }

  const row = await fetchExchangeRate(
    exchangeRateId,
    "Exchange rate was not updated"
  );

  await writeAudit(String(exchangeRateId), "update", previous, row);

  return row;
}
