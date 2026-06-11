"use client";

import { FormEvent, useMemo, useState } from "react";
import type {
  AdminExchangeRateQuoteFilter,
  AdminExchangeRateRow,
} from "@/services/admin/exchangeRates";

type Props = {
  initialError?: string;
  initialExchangeRates: AdminExchangeRateRow[];
};

type FormState = {
  rateDate: string;
  quoteCurrencyCode: "USD" | "TWD";
  rate: string;
  source: string;
  fetchedAt: string;
};

function toDatetimeLocalValue(isoValue: string): string {
  const parsed = new Date(isoValue);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 16);
}

function emptyForm(): FormState {
  return {
    rateDate: new Date().toISOString().slice(0, 10),
    quoteCurrencyCode: "USD",
    rate: "",
    source: "manual-admin",
    fetchedAt: toDatetimeLocalValue(new Date().toISOString()),
  };
}

function rowToForm(row: AdminExchangeRateRow): FormState {
  return {
    rateDate: row.rate_date,
    quoteCurrencyCode: row.quote_currency_code,
    rate: String(row.rate),
    source: row.source,
    fetchedAt: toDatetimeLocalValue(row.fetched_at),
  };
}

function toIsoDatetime(value: string): string {
  return new Date(value).toISOString();
}

async function readJsonError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return body?.error ?? fallback;
}

export default function ExchangeRatesAdminClient({
  initialError = "",
  initialExchangeRates,
}: Props) {
  const [exchangeRates, setExchangeRates] = useState(initialExchangeRates);
  const [quoteCurrencyCode, setQuoteCurrencyCode] =
    useState<AdminExchangeRateQuoteFilter>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminExchangeRateRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState(initialError);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const latestByQuote = useMemo(() => {
    const latest = new Map<string, AdminExchangeRateRow>();

    exchangeRates.forEach((rate) => {
      if (!latest.has(rate.quote_currency_code)) {
        latest.set(rate.quote_currency_code, rate);
      }
    });

    return latest;
  }, [exchangeRates]);

  async function refresh(
    nextQuoteCurrencyCode = quoteCurrencyCode,
    nextSearch = search
  ) {
    setIsRefreshing(true);
    setError("");

    const params = new URLSearchParams({
      quoteCurrencyCode: nextQuoteCurrencyCode,
      ...(nextSearch ? { search: nextSearch } : {}),
    });
    const response = await fetch(`/api/admin/exchange-rates?${params}`);

    setIsRefreshing(false);

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to load exchange rates"));
      return;
    }

    setExchangeRates((await response.json()) as AdminExchangeRateRow[]);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setIsDrawerOpen(true);
  }

  function openEdit(row: AdminExchangeRateRow) {
    setEditing(row);
    setForm(rowToForm(row));
    setError("");
    setIsDrawerOpen(true);
  }

  function closeDrawer({ clearError = true }: { clearError?: boolean } = {}) {
    setIsDrawerOpen(false);
    setEditing(null);
    setForm(emptyForm());
    if (clearError) {
      setError("");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    const payload = {
      fetchedAt: toIsoDatetime(form.fetchedAt),
      quoteCurrencyCode: form.quoteCurrencyCode,
      rate: Number(form.rate),
      rateDate: form.rateDate,
      source: form.source,
    };
    let response: Response;
    try {
      response = await fetch(
        editing
          ? `/api/admin/exchange-rates/${editing.exchange_rate_id}`
          : "/api/admin/exchange-rates",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
    } catch {
      setIsSaving(false);
      setError("Unable to save exchange rate");
      return;
    }

    setIsSaving(false);

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to save exchange rate"));
      return;
    }

    await refresh();
    closeDrawer({ clearError: false });
  }

  return (
    <div className="min-h-[calc(100vh-3rem)]">
      <section className="min-w-0">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-foreground">
              Exchange Rates
            </h1>
            <p className="mt-1 text-sm text-muted">
              Latest USD: {latestByQuote.get("USD")?.rate ?? "-"} / Latest TWD:{" "}
              {latestByQuote.get("TWD")?.rate ?? "-"}
            </p>
          </div>

          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={openCreate}
            type="button"
          >
            New rate
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <input
            aria-label="Search exchange rate sources"
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm md:w-72"
            onChange={(event) => setSearch(event.target.value)}
            value={search}
          />
          <select
            aria-label="Quote currency"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            onChange={async (event) => {
              const nextQuoteCurrencyCode = event.target
                .value as AdminExchangeRateQuoteFilter;
              setQuoteCurrencyCode(nextQuoteCurrencyCode);
              await refresh(nextQuoteCurrencyCode);
            }}
            value={quoteCurrencyCode}
          >
            <option value="all">All</option>
            <option value="USD">USD</option>
            <option value="TWD">TWD</option>
          </select>
          <button
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium disabled:opacity-60"
            disabled={isRefreshing}
            onClick={() => refresh()}
            type="button"
          >
            {isRefreshing ? "Loading..." : "Apply"}
          </button>
        </div>

        {error ? (
          <p className="mb-4 rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-border bg-accent-bg text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Rate date</th>
                <th className="px-3 py-2">Pair</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Fetched</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exchangeRates.map((row) => (
                <tr
                  className="border-b border-border text-foreground last:border-b-0"
                  key={row.exchange_rate_id}
                >
                  <td className="px-3 py-2">{row.rate_date}</td>
                  <td className="px-3 py-2">
                    {row.base_currency_code}/{row.quote_currency_code}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {Number(row.rate).toLocaleString("en-AU", {
                      maximumFractionDigits: 8,
                    })}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2">{row.source}</td>
                  <td className="px-3 py-2">
                    {new Date(row.fetched_at).toLocaleString("en-AU")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="text-primary hover:underline"
                      onClick={() => openEdit(row)}
                      type="button"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {exchangeRates.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted" colSpan={6}>
                    No exchange rates found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {isDrawerOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-end bg-foreground/20"
          role="dialog"
        >
          <button
            aria-label="Close exchange rate form"
            className="absolute inset-0 cursor-default"
            onClick={() => closeDrawer()}
            type="button"
          />
          <aside className="relative z-10 h-full w-full max-w-md overflow-y-auto border-l border-border bg-surface p-5 shadow-xl">
            <form className="flex flex-col gap-4" onSubmit={submit}>
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-foreground">
                    {editing ? "Edit exchange rate" : "New exchange rate"}
                  </h2>
                  <button
                    className="rounded-md border border-border px-3 py-1 text-sm font-medium"
                    onClick={() => closeDrawer()}
                    type="button"
                  >
                    Close
                  </button>
                </div>
                <p className="text-sm text-muted">
                  Base currency is fixed to AUD.
                </p>
              </div>

              {error ? (
                <p className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              ) : null}

              <label className="flex flex-col gap-1 text-sm font-medium">
                Rate date
                <input
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      rateDate: event.target.value,
                    }))
                  }
                  required
                  type="date"
                  value={form.rateDate}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Quote currency
                <select
                  className="rounded-md border border-border bg-white px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      quoteCurrencyCode: event.target.value as "USD" | "TWD",
                    }))
                  }
                  required
                  value={form.quoteCurrencyCode}
                >
                  <option value="USD">USD</option>
                  <option value="TWD">TWD</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Rate
                <input
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  min="0"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      rate: event.target.value,
                    }))
                  }
                  required
                  step="0.00000001"
                  type="number"
                  value={form.rate}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Source
                <input
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      source: event.target.value,
                    }))
                  }
                  required
                  value={form.source}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Fetched at
                <input
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fetchedAt: event.target.value,
                    }))
                  }
                  required
                  type="datetime-local"
                  value={form.fetchedAt}
                />
              </label>

              <div className="flex gap-2">
                <button
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium"
                  onClick={() => closeDrawer()}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
