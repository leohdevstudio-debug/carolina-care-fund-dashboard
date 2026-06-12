import { adminFetch } from "@/lib/admin/supabaseAdmin";
import type { AdminExchangeRateInput } from "@/lib/admin/exchangeRateValidation";
import { getExchangeRatesForDate } from "@/lib/exchangeRates";

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
type SupportedQuoteCurrency = "USD" | "TWD";

export type AdminExchangeRateFetchResult = {
  createdCount: number;
  existingCount: number;
  rateDate: string;
  rates: AdminExchangeRateRow[];
};

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

function byDateQuery(rateDate: string): string {
  const query = new URLSearchParams();
  query.set("select", "*");
  query.set("rate_date", `eq.${rateDate}`);
  query.set("base_currency_code", "eq.AUD");
  query.set("quote_currency_code", "in.(USD,TWD)");
  query.set("order", "quote_currency_code.asc");

  return query.toString();
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

async function fetchExchangeRatesForDate(
  rateDate: string
): Promise<AdminExchangeRateRow[]> {
  return adminFetch<AdminExchangeRateRow[]>(
    "v_admin_exchange_rate",
    byDateQuery(rateDate)
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

function missingQuoteCurrencies(
  rows: AdminExchangeRateRow[]
): SupportedQuoteCurrency[] {
  const existingQuotes = new Set(rows.map((row) => row.quote_currency_code));
  const missingQuotes: SupportedQuoteCurrency[] = [];

  if (!existingQuotes.has("USD")) {
    missingQuotes.push("USD");
  }

  if (!existingQuotes.has("TWD")) {
    missingQuotes.push("TWD");
  }

  return missingQuotes;
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

export async function fetchAndStoreAdminExchangeRatesForDate(
  rateDate: string
): Promise<AdminExchangeRateFetchResult> {
  const existingRows = await fetchExchangeRatesForDate(rateDate);
  const missingQuotes = missingQuoteCurrencies(existingRows);

  if (missingQuotes.length === 0) {
    return {
      createdCount: 0,
      existingCount: existingRows.length,
      rateDate,
      rates: existingRows,
    };
  }

  const fetchedRates = await getExchangeRatesForDate(rateDate);

  const insertedRows = await adminFetch<Array<{ exchange_rate_id: number }>>(
    "exchange_rates",
    "select=exchange_rate_id",
    {
      method: "POST",
      prefer: "return=representation",
      body: missingQuotes.map((quoteCurrencyCode) => ({
        base_currency_code: "AUD",
        fetched_at: fetchedRates.fetchedAt,
        quote_currency_code: quoteCurrencyCode,
        rate: fetchedRates.rates[quoteCurrencyCode],
        rate_date: rateDate,
        source: fetchedRates.source,
      })),
    }
  );
  const insertedIds = new Set(
    insertedRows.map((row) => Number(row.exchange_rate_id))
  );
  const refreshedRows = await fetchExchangeRatesForDate(rateDate);
  const createdRows = refreshedRows.filter((row) =>
    insertedIds.has(row.exchange_rate_id)
  );

  await Promise.all(
    createdRows.map((row) =>
      writeAudit(String(row.exchange_rate_id), "create", null, row)
    )
  );

  return {
    createdCount: insertedRows.length,
    existingCount: existingRows.length,
    rateDate,
    rates: refreshedRows,
  };
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
