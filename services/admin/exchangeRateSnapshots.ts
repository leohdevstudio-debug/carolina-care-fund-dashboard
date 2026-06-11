import type { DisplayCurrency } from "@/lib/currency";
import { getCurrentExchangeRates } from "@/lib/exchangeRates";
import { adminFetch } from "@/lib/admin/supabaseAdmin";

type ExchangeRateSnapshotRow = {
  rate_date: string;
  quote_currency_code: "USD" | "TWD";
  rate: number;
  source: string;
  fetched_at: string;
};

export type AdminExchangeRateSnapshot = {
  rateDate: string;
  rates: Record<DisplayCurrency, number>;
  source: string;
  fetchedAt: string;
};

type SnapshotOptions = {
  now?: () => Date;
  timeZone?: string;
};

const DEFAULT_ADMIN_TIME_ZONE = "Australia/Brisbane";

function snapshotQuery(rateDate: string): string {
  const query = new URLSearchParams();
  query.set("select", "rate_date,quote_currency_code,rate,source,fetched_at");
  query.set("rate_date", `eq.${rateDate}`);
  query.set("base_currency_code", "eq.AUD");
  query.set("quote_currency_code", "in.(USD,TWD)");
  query.set("order", "quote_currency_code.asc");

  return query.toString();
}

function todayInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(now);
  const partMap = new Map(parts.map((part) => [part.type, part.value]));

  return `${partMap.get("year")}-${partMap.get("month")}-${partMap.get(
    "day"
  )}`;
}

function combineSource(
  usdRate: ExchangeRateSnapshotRow,
  twdRate: ExchangeRateSnapshotRow
): string {
  if (usdRate.source === twdRate.source) {
    return usdRate.source;
  }

  return `USD:${usdRate.source}; TWD:${twdRate.source}`;
}

function latestFetchedAt(
  usdRate: ExchangeRateSnapshotRow,
  twdRate: ExchangeRateSnapshotRow
): string {
  const usdFetchedAt = new Date(usdRate.fetched_at).getTime();
  const twdFetchedAt = new Date(twdRate.fetched_at).getTime();

  return usdFetchedAt >= twdFetchedAt ? usdRate.fetched_at : twdRate.fetched_at;
}

async function fetchSnapshotRows(
  rateDate: string
): Promise<ExchangeRateSnapshotRow[]> {
  return adminFetch<ExchangeRateSnapshotRow[]>(
    "exchange_rates",
    snapshotQuery(rateDate)
  );
}

function buildSnapshot(
  rateDate: string,
  rows: ExchangeRateSnapshotRow[]
): AdminExchangeRateSnapshot | null {
  const usdRate = rows.find((row) => row.quote_currency_code === "USD");
  const twdRate = rows.find((row) => row.quote_currency_code === "TWD");

  if (!usdRate || !twdRate) {
    return null;
  }

  return {
    fetchedAt: latestFetchedAt(usdRate, twdRate),
    rateDate,
    rates: {
      AUD: 1,
      USD: Number(usdRate.rate),
      TWD: Number(twdRate.rate),
    },
    source: combineSource(usdRate, twdRate),
  };
}

async function insertMissingCurrentRates(
  rateDate: string,
  rows: ExchangeRateSnapshotRow[]
): Promise<void> {
  const existingQuotes = new Set(rows.map((row) => row.quote_currency_code));
  const missingQuotes: Array<"USD" | "TWD"> = [];

  if (!existingQuotes.has("USD")) {
    missingQuotes.push("USD");
  }

  if (!existingQuotes.has("TWD")) {
    missingQuotes.push("TWD");
  }

  if (missingQuotes.length === 0) {
    return;
  }

  const currentRates = await getCurrentExchangeRates();

  await adminFetch("exchange_rates", "select=exchange_rate_id", {
    method: "POST",
    prefer: "return=representation",
    body: missingQuotes.map((quoteCurrencyCode) => ({
      base_currency_code: "AUD",
      fetched_at: currentRates.fetchedAt,
      quote_currency_code: quoteCurrencyCode,
      rate: currentRates.rates[quoteCurrencyCode],
      rate_date: rateDate,
      source: currentRates.source,
    })),
  });
}

export async function getAdminExchangeRateSnapshotForDate(
  rateDate: string,
  options: SnapshotOptions = {}
): Promise<AdminExchangeRateSnapshot> {
  const rows = await fetchSnapshotRows(rateDate);
  const snapshot = buildSnapshot(rateDate, rows);

  if (snapshot) {
    return snapshot;
  }

  const now = options.now?.() ?? new Date();
  const timeZone = options.timeZone ?? DEFAULT_ADMIN_TIME_ZONE;
  const today = todayInTimeZone(now, timeZone);

  if (rateDate === today) {
    await insertMissingCurrentRates(rateDate, rows);
    const refreshedRows = await fetchSnapshotRows(rateDate);
    const refreshedSnapshot = buildSnapshot(rateDate, refreshedRows);

    if (refreshedSnapshot) {
      return refreshedSnapshot;
    }
  }

    throw new Error(
      `Missing exchange rates for ${rateDate}. Add USD and TWD rates in Exchange Rates Admin before saving this record.`
    );
}
