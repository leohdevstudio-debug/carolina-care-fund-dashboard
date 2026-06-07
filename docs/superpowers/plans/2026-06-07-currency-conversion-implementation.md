# Currency Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AUD/USD/TWD display currency switching while keeping AUD as the official accounting base and documenting the Supabase exchange-rate storage needed for historical auditability.

**Architecture:** Keep monetary source data in AUD and add a small currency domain layer for display conversion. Fetch current rates through an internal Next.js API route backed by a server-side provider adapter and short-lived in-memory cache. Store the database schema and operational SQL in the repo because the current application reads Supabase public views but does not include transaction creation code or migration tooling.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase REST views, Recharts, Vitest for focused unit tests.

---

## File Structure

- Create `vitest.config.ts`: local test runner config with the same `@/*` alias the app uses.
- Modify `package.json`: add `test` script and Vitest dev dependency.
- Create `lib/currency.ts`: shared currency constants, types, validation, conversion helpers, and rate metadata helpers.
- Create `lib/currency.test.ts`: unit tests for the currency helper boundary.
- Create `lib/exchangeRates.ts`: server-only exchange-rate provider adapter and cache.
- Create `lib/exchangeRates.test.ts`: unit tests for provider parsing, caching, and fallback behavior.
- Create `app/api/exchange-rates/route.ts`: internal API route used by the browser.
- Modify `lib/format.ts`: keep currency formatting in one place and reuse the shared `BASE_CURRENCY`.
- Modify `components/DashboardClient.tsx`: add display-currency selector, fetch rates on demand, convert dashboard values, and show rate metadata.
- Modify `components/ExpenseCategoryChart.tsx`: accept a currency prop for tooltip formatting.
- Modify `components/BudgetVsSpentChart.tsx`: keep the existing currency prop and receive converted values.
- Modify `messages/en.ts`, `messages/es.ts`, and `messages/zh-TW.ts`: add display currency labels and rate notes. Also repair the visibly corrupted Spanish and Traditional Chinese strings while touching these files.
- Create `docs/database/exchange-rates.sql`: Supabase SQL for `fund.exchange_rates`, a latest-rate view, and historical-rate lookup helpers.

---

### Task 1: Add Test Harness And Currency Helpers

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `lib/currency.test.ts`
- Create: `lib/currency.ts`

- [ ] **Step 1: Add test script and Vitest dependency**

Edit `package.json` so the scripts and dev dependencies include these entries:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.3",
    "prettier": "^3.8.2",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^4.0.0"
  }
}
```

Run: `npm install`

Expected: `package-lock.json` updates and `node_modules/vitest` exists.

- [ ] **Step 2: Add Vitest config**

Create `vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 3: Write failing currency helper tests**

Create `lib/currency.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BASE_CURRENCY,
  DISPLAY_CURRENCIES,
  convertFromBase,
  getDisplayRate,
  isDisplayCurrency,
  normalizeExchangeRateResponse,
} from "@/lib/currency";

describe("currency helpers", () => {
  const rates = {
    baseCurrency: "AUD",
    rates: {
      AUD: 1,
      USD: 0.66,
      TWD: 21.2,
    },
    source: "test-provider",
    fetchedAt: "2026-06-07T13:30:00.000Z",
    isFallback: false,
  };

  it("defines AUD as the only accounting base", () => {
    expect(BASE_CURRENCY).toBe("AUD");
    expect(DISPLAY_CURRENCIES).toEqual(["AUD", "USD", "TWD"]);
  });

  it("accepts only supported display currencies", () => {
    expect(isDisplayCurrency("AUD")).toBe(true);
    expect(isDisplayCurrency("USD")).toBe(true);
    expect(isDisplayCurrency("TWD")).toBe(true);
    expect(isDisplayCurrency("EUR")).toBe(false);
    expect(isDisplayCurrency(null)).toBe(false);
  });

  it("converts AUD base amounts into the selected display currency", () => {
    expect(convertFromBase(100, "AUD", rates)).toBe(100);
    expect(convertFromBase(100, "USD", rates)).toBe(66);
    expect(convertFromBase(100, "TWD", rates)).toBe(2120);
  });

  it("returns the selected display rate", () => {
    expect(getDisplayRate("AUD", rates)).toBe(1);
    expect(getDisplayRate("USD", rates)).toBe(0.66);
    expect(getDisplayRate("TWD", rates)).toBe(21.2);
  });

  it("normalizes unknown JSON into a safe exchange-rate response", () => {
    expect(
      normalizeExchangeRateResponse({
        baseCurrency: "AUD",
        rates: { AUD: 1, USD: 0.7, TWD: 22 },
        source: "unit-test",
        fetchedAt: "2026-06-07T13:30:00.000Z",
        isFallback: true,
      })
    ).toEqual({
      baseCurrency: "AUD",
      rates: { AUD: 1, USD: 0.7, TWD: 22 },
      source: "unit-test",
      fetchedAt: "2026-06-07T13:30:00.000Z",
      isFallback: true,
    });
  });

  it("rejects incomplete exchange-rate responses", () => {
    expect(() =>
      normalizeExchangeRateResponse({
        baseCurrency: "AUD",
        rates: { AUD: 1, USD: 0.7 },
        source: "unit-test",
        fetchedAt: "2026-06-07T13:30:00.000Z",
        isFallback: false,
      })
    ).toThrow("Missing exchange rate for TWD");
  });
});
```

- [ ] **Step 4: Run tests and verify they fail**

Run: `npm run test -- lib/currency.test.ts`

Expected: FAIL because `@/lib/currency` does not exist.

- [ ] **Step 5: Implement currency helpers**

Create `lib/currency.ts`:

```ts
export const BASE_CURRENCY = "AUD" as const;
export const DISPLAY_CURRENCIES = ["AUD", "USD", "TWD"] as const;

export type BaseCurrency = typeof BASE_CURRENCY;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export type ExchangeRatesByCurrency = Record<DisplayCurrency, number>;

export type ExchangeRateResponse = {
  baseCurrency: BaseCurrency;
  rates: ExchangeRatesByCurrency;
  source: string;
  fetchedAt: string;
  isFallback: boolean;
};

export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return (
    typeof value === "string" &&
    DISPLAY_CURRENCIES.includes(value as DisplayCurrency)
  );
}

export function getDisplayRate(
  currency: DisplayCurrency,
  exchangeRates: ExchangeRateResponse
): number {
  return exchangeRates.rates[currency];
}

export function convertFromBase(
  amount: number | null | undefined,
  currency: DisplayCurrency,
  exchangeRates: ExchangeRateResponse
): number {
  return Number(amount ?? 0) * getDisplayRate(currency, exchangeRates);
}

function assertNumber(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(message);
  }

  return value;
}

export function normalizeExchangeRateResponse(
  value: unknown
): ExchangeRateResponse {
  if (!value || typeof value !== "object") {
    throw new Error("Exchange-rate response must be an object");
  }

  const candidate = value as {
    baseCurrency?: unknown;
    rates?: unknown;
    source?: unknown;
    fetchedAt?: unknown;
    isFallback?: unknown;
  };

  if (candidate.baseCurrency !== BASE_CURRENCY) {
    throw new Error("Exchange-rate response must use AUD as base currency");
  }

  if (!candidate.rates || typeof candidate.rates !== "object") {
    throw new Error("Exchange-rate response must include rates");
  }

  const rateCandidate = candidate.rates as Partial<
    Record<DisplayCurrency, unknown>
  >;

  const rates: ExchangeRatesByCurrency = {
    AUD: assertNumber(rateCandidate.AUD, "Missing exchange rate for AUD"),
    USD: assertNumber(rateCandidate.USD, "Missing exchange rate for USD"),
    TWD: assertNumber(rateCandidate.TWD, "Missing exchange rate for TWD"),
  };

  if (candidate.source === undefined || typeof candidate.source !== "string") {
    throw new Error("Exchange-rate response must include a source");
  }

  if (
    candidate.fetchedAt === undefined ||
    typeof candidate.fetchedAt !== "string"
  ) {
    throw new Error("Exchange-rate response must include fetchedAt");
  }

  if (typeof candidate.isFallback !== "boolean") {
    throw new Error("Exchange-rate response must include isFallback");
  }

  return {
    baseCurrency: BASE_CURRENCY,
    rates,
    source: candidate.source,
    fetchedAt: candidate.fetchedAt,
    isFallback: candidate.isFallback,
  };
}
```

- [ ] **Step 6: Run helper tests and commit**

Run: `npm run test -- lib/currency.test.ts`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Commit:

```bash
git add package.json package-lock.json vitest.config.ts lib/currency.ts lib/currency.test.ts
git commit -m "Add currency conversion helpers"
```

---

### Task 2: Add Exchange-Rate Provider Adapter And API Route

**Files:**
- Create: `lib/exchangeRates.test.ts`
- Create: `lib/exchangeRates.ts`
- Create: `app/api/exchange-rates/route.ts`

- [ ] **Step 1: Write failing provider tests**

Create `lib/exchangeRates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  clearExchangeRateCache,
  fetchProviderExchangeRates,
  getCurrentExchangeRates,
} from "@/lib/exchangeRates";

function response(body: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("exchange-rate provider", () => {
  it("maps provider rates into the app response shape", async () => {
    const fetcher = async () =>
      response({
        result: "success",
        provider: "https://www.exchangerate-api.com",
        time_last_update_utc: "Sun, 07 Jun 2026 13:30:00 +0000",
        base_code: "AUD",
        rates: {
          AUD: 1,
          USD: 0.66,
          TWD: 21.2,
        },
      });

    await expect(fetchProviderExchangeRates(fetcher)).resolves.toEqual({
      baseCurrency: "AUD",
      rates: {
        AUD: 1,
        USD: 0.66,
        TWD: 21.2,
      },
      source: "https://www.exchangerate-api.com",
      fetchedAt: "2026-06-07T13:30:00.000Z",
      isFallback: false,
    });
  });

  it("rejects provider responses that do not include USD and TWD", async () => {
    const fetcher = async () =>
      response({
        result: "success",
        provider: "https://www.exchangerate-api.com",
        time_last_update_utc: "Sun, 07 Jun 2026 13:30:00 +0000",
        base_code: "AUD",
        rates: {
          AUD: 1,
          USD: 0.66,
        },
      });

    await expect(fetchProviderExchangeRates(fetcher)).rejects.toThrow(
      "Provider response is missing TWD"
    );
  });

  it("returns cached rates without refetching while fresh", async () => {
    clearExchangeRateCache();

    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return response({
        result: "success",
        provider: "https://www.exchangerate-api.com",
        time_last_update_utc: "Sun, 07 Jun 2026 13:30:00 +0000",
        base_code: "AUD",
        rates: {
          AUD: 1,
          USD: 0.66,
          TWD: 21.2,
        },
      });
    };

    const now = () => new Date("2026-06-07T14:00:00.000Z");

    await getCurrentExchangeRates(fetcher, now);
    await getCurrentExchangeRates(fetcher, now);

    expect(calls).toBe(1);
  });

  it("uses stale cached rates as fallback when refresh fails", async () => {
    clearExchangeRateCache();

    const successFetcher = async () =>
      response({
        result: "success",
        provider: "https://www.exchangerate-api.com",
        time_last_update_utc: "Sun, 07 Jun 2026 13:30:00 +0000",
        base_code: "AUD",
        rates: {
          AUD: 1,
          USD: 0.66,
          TWD: 21.2,
        },
      });

    await getCurrentExchangeRates(successFetcher, () =>
      new Date("2026-06-07T14:00:00.000Z")
    );

    const failingFetcher = async () => response({ result: "error" }, false, 500);

    await expect(
      getCurrentExchangeRates(failingFetcher, () =>
        new Date("2026-06-07T22:00:00.000Z")
      )
    ).resolves.toMatchObject({
      rates: {
        AUD: 1,
        USD: 0.66,
        TWD: 21.2,
      },
      isFallback: true,
    });
  });
});
```

- [ ] **Step 2: Run provider tests and verify they fail**

Run: `npm run test -- lib/exchangeRates.test.ts`

Expected: FAIL because `@/lib/exchangeRates` does not exist.

- [ ] **Step 3: Implement provider adapter and cache**

Create `lib/exchangeRates.ts`:

```ts
import {
  BASE_CURRENCY,
  type DisplayCurrency,
  type ExchangeRateResponse,
} from "@/lib/currency";

type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

type ProviderPayload = {
  result?: string;
  provider?: string;
  time_last_update_utc?: string;
  base_code?: string;
  rates?: Partial<Record<DisplayCurrency, number>>;
};

type CacheEntry = {
  value: ExchangeRateResponse;
  expiresAt: number;
};

const PROVIDER_URL =
  process.env.EXCHANGE_RATE_PROVIDER_URL ??
  "https://open.er-api.com/v6/latest/AUD";

const CACHE_TTL_MS = 60 * 60 * 1000;

let cacheEntry: CacheEntry | null = null;

export function clearExchangeRateCache(): void {
  cacheEntry = null;
}

function parseFetchedAt(value: string | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function requireRate(
  rates: ProviderPayload["rates"],
  currency: DisplayCurrency
): number {
  const rate = rates?.[currency];

  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Provider response is missing ${currency}`);
  }

  return rate;
}

export async function fetchProviderExchangeRates(
  fetcher: FetchLike = fetch
): Promise<ExchangeRateResponse> {
  const response = await fetcher(PROVIDER_URL, {
    headers: {
      accept: "application/json",
    },
    next: {
      revalidate: 3600,
    },
  });

  if (!response.ok) {
    throw new Error(`Exchange-rate provider failed with ${response.status}`);
  }

  const payload = (await response.json()) as ProviderPayload;

  if (payload.result !== "success") {
    throw new Error("Exchange-rate provider returned an error");
  }

  if (payload.base_code !== BASE_CURRENCY) {
    throw new Error("Exchange-rate provider did not return AUD rates");
  }

  return {
    baseCurrency: BASE_CURRENCY,
    rates: {
      AUD: requireRate(payload.rates, "AUD"),
      USD: requireRate(payload.rates, "USD"),
      TWD: requireRate(payload.rates, "TWD"),
    },
    source: payload.provider ?? "https://www.exchangerate-api.com",
    fetchedAt: parseFetchedAt(payload.time_last_update_utc),
    isFallback: false,
  };
}

export async function getCurrentExchangeRates(
  fetcher: FetchLike = fetch,
  now: () => Date = () => new Date()
): Promise<ExchangeRateResponse> {
  const nowMs = now().getTime();

  if (cacheEntry && cacheEntry.expiresAt > nowMs) {
    return cacheEntry.value;
  }

  try {
    const value = await fetchProviderExchangeRates(fetcher);

    cacheEntry = {
      value,
      expiresAt: nowMs + CACHE_TTL_MS,
    };

    return value;
  } catch (error) {
    if (cacheEntry) {
      return {
        ...cacheEntry.value,
        isFallback: true,
      };
    }

    throw error;
  }
}
```

- [ ] **Step 4: Add the internal API route**

Create `app/api/exchange-rates/route.ts`:

```ts
import { getCurrentExchangeRates } from "@/lib/exchangeRates";

export async function GET(): Promise<Response> {
  try {
    const exchangeRates = await getCurrentExchangeRates();

    return Response.json(exchangeRates, {
      headers: {
        "cache-control": "public, max-age=300, stale-while-revalidate=3600",
      },
    });
  } catch {
    return Response.json(
      {
        error: "Exchange rates are temporarily unavailable",
      },
      { status: 503 }
    );
  }
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npm run test -- lib/exchangeRates.test.ts`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Commit:

```bash
git add lib/exchangeRates.ts lib/exchangeRates.test.ts app/api/exchange-rates/route.ts
git commit -m "Add exchange rate API route"
```

---

### Task 3: Document Supabase Historical Rate Storage

**Files:**
- Create: `docs/database/exchange-rates.sql`

- [ ] **Step 1: Create database SQL artifact**

Create `docs/database/exchange-rates.sql`:

```sql
create schema if not exists fund;

create table if not exists fund.exchange_rates (
  exchange_rate_id bigint generated always as identity primary key,
  rate_date date not null,
  base_currency_code text not null,
  quote_currency_code text not null,
  rate numeric(18, 8) not null,
  source text not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint exchange_rates_positive_rate check (rate > 0),
  constraint exchange_rates_supported_base check (base_currency_code = 'AUD'),
  constraint exchange_rates_supported_quote check (
    quote_currency_code in ('USD', 'TWD')
  ),
  constraint exchange_rates_unique_pair_per_date unique (
    rate_date,
    base_currency_code,
    quote_currency_code
  )
);

alter table fund.exchange_rates enable row level security;

drop policy if exists "Public can read exchange rates" on fund.exchange_rates;

create policy "Public can read exchange rates"
on fund.exchange_rates
for select
using (true);

create or replace view fund.v_public_latest_exchange_rate as
select distinct on (base_currency_code, quote_currency_code)
  rate_date,
  base_currency_code,
  quote_currency_code,
  rate,
  source,
  fetched_at
from fund.exchange_rates
where base_currency_code = 'AUD'
  and quote_currency_code in ('USD', 'TWD')
order by
  base_currency_code,
  quote_currency_code,
  rate_date desc,
  fetched_at desc;

create or replace function fund.get_exchange_rate_for_date(
  p_rate_date date,
  p_quote_currency_code text
)
returns table (
  rate_date date,
  base_currency_code text,
  quote_currency_code text,
  rate numeric,
  source text,
  fetched_at timestamptz
)
language sql
stable
as $$
  select
    er.rate_date,
    er.base_currency_code,
    er.quote_currency_code,
    er.rate,
    er.source,
    er.fetched_at
  from fund.exchange_rates er
  where er.base_currency_code = 'AUD'
    and er.quote_currency_code = p_quote_currency_code
    and er.rate_date <= p_rate_date
  order by er.rate_date desc, er.fetched_at desc
  limit 1
$$;

grant select on fund.exchange_rates to anon;
grant select on fund.v_public_latest_exchange_rate to anon;
grant execute on function fund.get_exchange_rate_for_date(date, text) to anon;
```

- [ ] **Step 2: Add operational note below the SQL**

Append this comment to the same file:

```sql
-- Operational rule:
-- When a donation is inserted, ensure rows exist for received_date with
-- quote_currency_code values 'USD' and 'TWD'.
-- When an expense is inserted, ensure rows exist for expense_date with
-- quote_currency_code values 'USD' and 'TWD'.
-- Existing transaction creation code is not present in this repo, so this
-- schema artifact is the handoff point for the Supabase-side process.
```

- [ ] **Step 3: Commit the database artifact**

Run: `git diff -- docs/database/exchange-rates.sql`

Expected: The SQL defines the table, public read policy, latest-rate view, date lookup function, grants, and operational rule.

Commit:

```bash
git add docs/database/exchange-rates.sql
git commit -m "Document exchange rate storage schema"
```

---

### Task 4: Wire Currency Conversion Into The Dashboard UI

**Files:**
- Modify: `lib/format.ts`
- Modify: `messages/en.ts`
- Modify: `messages/es.ts`
- Modify: `messages/zh-TW.ts`
- Modify: `components/ExpenseCategoryChart.tsx`
- Modify: `components/BudgetVsSpentChart.tsx`
- Modify: `components/DashboardClient.tsx`

- [ ] **Step 1: Update currency formatting**

Change `lib/format.ts` to import the shared base currency and accept an optional locale:

```ts
import { BASE_CURRENCY, type DisplayCurrency } from "@/lib/currency";

export function formatCurrency(
  value: number,
  currency: DisplayCurrency | string = BASE_CURRENCY,
  locale = "en-AU"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

export function getBarWidth(value: number, maxValue: number): string {
  if (maxValue <= 0) {
    return "0%";
  }

  return `${Math.max((value / maxValue) * 100, 4)}%`;
}

export { BASE_CURRENCY };
```

- [ ] **Step 2: Update English messages**

Add these fields to `messages/en.ts` under the existing object:

```ts
currency: {
  selectorLabel: "Display currency",
  loading: "Updating rates",
  unavailable: "Exchange rates are temporarily unavailable. Showing AUD.",
  sourcePrefix: "Rates by",
},
footer: {
  note: "Amounts shown in {currency} are approximate conversions from AUD · Data refreshes every 30 minutes",
  rateUpdated: "Rate updated {date}",
  fallbackRate: "Using the latest available saved rate from {date}",
},
```

Keep all existing English labels that are still used.

- [ ] **Step 3: Update Spanish messages with repaired encoding**

Replace `messages/es.ts` with this object:

```ts
const es = {
  header: {
    dashboardTitle: "Dashboard",
    descriptionLine1:
      "Este fondo ha sido creado para apoyar el tratamiento médico de {name}, junto con los gastos de viaje y el apoyo familiar necesario durante este proceso.",
    descriptionLine2:
      "Cada aporte ayuda a aliviar la carga económica y nos permite enfocarnos en lo más importante, su recuperación.",
    descriptionLine3: "Cada donación suma. Muchas gracias por tu apoyo.",
    beneficiary: "Beneficiario",
    baseCurrency: "Moneda base",
    targetAmount: "Meta",
    notSet: "No definido",
  },
  summary: {
    totalReceived: "Total recibido",
    totalSpent: "Total gastado",
    remainingBalance: "Balance restante",
    unallocatedBalance: "Balance no asignado",
    progressToTarget: "Progreso hacia la meta",
  },
  progress: {
    title: "Progreso de recaudación",
    funded: "financiado",
    remaining: "restante",
  },
  sections: {
    expensesByCategory: "Gastos por categoría",
    budgetVsSpent: "Presupuesto vs Gastado",
    recentDonations: "Donaciones recientes",
    recentExpenses: "Gastos recientes",
  },
  table: {
    date: "Fecha",
    donor: "Donante",
    original: "Monto original",
    base: "Monto mostrado",
    category: "Categoría",
    description: "Descripción",
  },
  charts: {
    budget: "Presupuesto",
    spent: "Gastado",
  },
  currency: {
    selectorLabel: "Moneda mostrada",
    loading: "Actualizando tasas",
    unavailable: "Las tasas de cambio no están disponibles. Mostrando AUD.",
    sourcePrefix: "Tasas de",
  },
  footer: {
    note: "Los montos en {currency} son conversiones aproximadas desde AUD · Los datos se actualizan cada 30 minutos",
    rateUpdated: "Tasa actualizada {date}",
    fallbackRate: "Usando la última tasa guardada disponible de {date}",
  },
};

export default es;
```

- [ ] **Step 4: Update Traditional Chinese messages with valid UTF-8**

Replace `messages/zh-TW.ts` with this object:

```ts
const zhTW = {
  header: {
    dashboardTitle: "Dashboard",
    descriptionLine1:
      "此募款專案旨在支持 {name} 的醫療治療，以及過程中所需的相關旅費與家庭支援。",
    descriptionLine2:
      "每一筆捐款都能減輕經濟壓力，讓我們能專注在最重要的事情上，也就是她的康復。",
    descriptionLine3: "每一份心意都非常重要，感謝您的支持。",
    beneficiary: "受益人",
    baseCurrency: "基準貨幣",
    targetAmount: "目標金額",
    notSet: "未設定",
  },
  summary: {
    totalReceived: "已收到總額",
    totalSpent: "已支出總額",
    remainingBalance: "剩餘餘額",
    unallocatedBalance: "未分配餘額",
    progressToTarget: "達成目標進度",
  },
  progress: {
    title: "募款進度",
    funded: "已完成",
    remaining: "尚需",
  },
  sections: {
    expensesByCategory: "按類別支出",
    budgetVsSpent: "預算 vs 實際支出",
    recentDonations: "最近捐款",
    recentExpenses: "最近支出",
  },
  table: {
    date: "日期",
    donor: "捐贈者",
    original: "原始金額",
    base: "顯示金額",
    category: "類別",
    description: "描述",
  },
  charts: {
    budget: "預算",
    spent: "已支出",
  },
  currency: {
    selectorLabel: "顯示貨幣",
    loading: "正在更新匯率",
    unavailable: "匯率暫時無法使用。正在顯示 AUD。",
    sourcePrefix: "匯率來源",
  },
  footer: {
    note: "{currency} 金額為從 AUD 換算的近似值 · 數據每 30 分鐘更新一次",
    rateUpdated: "匯率更新於 {date}",
    fallbackRate: "使用 {date} 儲存的最新可用匯率",
  },
};

export default zhTW;
```

- [ ] **Step 5: Update expense category chart**

Change the props and tooltip in `components/ExpenseCategoryChart.tsx`:

```ts
type Props = {
  data: ExpenseByCategory[];
  currency: string;
};

export default function ExpenseCategoryChart({ data, currency }: Props) {
  if (!data.length) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        No expense data available yet.
      </p>
    );
  }

  return (
    <div className="w-full min-w-0">
      <ResponsiveContainer width="99%" height={400}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total_spent_base"
            nameKey="category_name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            isAnimationActive={false}
            labelLine={{ stroke: "#C4B5FD", strokeWidth: 1 }}
            label={(entry: { percent?: number }) => {
              const percent = entry.percent ?? 0;
              if (!isFinite(percent) || percent < 0.05) return "";
              const rounded = Math.round(percent * 100);
              return rounded > 0 ? `${rounded}%` : "";
            }}
          >
            {data.map((item, index) => (
              <Cell
                key={item.expense_category_id}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              formatCurrency(Number(value), currency),
              String(name),
            ]}
            contentStyle={{
              borderRadius: "10px",
              border: "1px solid #E7E0D5",
              boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
              fontSize: "13px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 6: Wire conversion state into DashboardClient**

In `components/DashboardClient.tsx`, import currency helpers:

```ts
import {
  BASE_CURRENCY,
  DISPLAY_CURRENCIES,
  convertFromBase,
  isDisplayCurrency,
  normalizeExchangeRateResponse,
  type DisplayCurrency,
  type ExchangeRateResponse,
} from "@/lib/currency";
```

Remove `BASE_CURRENCY` from the `@/lib/format` import.

Add state after locale state:

```ts
const defaultExchangeRates: ExchangeRateResponse = {
  baseCurrency: BASE_CURRENCY,
  rates: {
    AUD: 1,
    USD: 1,
    TWD: 1,
  },
  source: "AUD",
  fetchedAt: new Date().toISOString(),
  isFallback: false,
};

const [displayCurrency, setDisplayCurrency] =
  useState<DisplayCurrency>(BASE_CURRENCY);
const [exchangeRates, setExchangeRates] =
  useState<ExchangeRateResponse>(defaultExchangeRates);
const [currencyStatus, setCurrencyStatus] = useState<
  "idle" | "loading" | "error"
>("idle");
```

Add selected-currency persistence:

```ts
useEffect(() => {
  const saved = localStorage.getItem("displayCurrency");

  if (isDisplayCurrency(saved)) {
    setDisplayCurrency(saved);
  }
}, []);

useEffect(() => {
  localStorage.setItem("displayCurrency", displayCurrency);
}, [displayCurrency]);
```

Add rate fetching:

```ts
useEffect(() => {
  if (displayCurrency === BASE_CURRENCY) {
    setCurrencyStatus("idle");
    return;
  }

  let isCurrent = true;

  async function loadExchangeRates() {
    setCurrencyStatus("loading");

    try {
      const response = await fetch("/api/exchange-rates");

      if (!response.ok) {
        throw new Error("Exchange-rate request failed");
      }

      const nextExchangeRates = normalizeExchangeRateResponse(
        await response.json()
      );

      if (isCurrent) {
        setExchangeRates(nextExchangeRates);
        setCurrencyStatus("idle");
      }
    } catch {
      if (isCurrent) {
        setDisplayCurrency(BASE_CURRENCY);
        setCurrencyStatus("error");
      }
    }
  }

  loadExchangeRates();

  return () => {
    isCurrent = false;
  };
}, [displayCurrency]);
```

Add conversion helpers inside the component:

```ts
const displayLocale =
  locale === "zh-TW" ? "zh-TW" : locale === "es" ? "es-ES" : "en-AU";

const displayAmount = (value: number | null | undefined) =>
  convertFromBase(value, displayCurrency, exchangeRates);

const formatDisplayCurrency = (value: number | null | undefined) =>
  formatCurrency(displayAmount(value), displayCurrency, displayLocale);

const convertedExpenseByCategory = expenseByCategory.map((item) => ({
  ...item,
  total_spent_base: displayAmount(item.total_spent_base),
}));

const convertedBudgetVsSpent = budgetVsSpent.map((item) => ({
  ...item,
  total_budget_base: displayAmount(item.total_budget_base),
  total_spent_base: displayAmount(item.total_spent_base),
  variance_base: displayAmount(item.variance_base),
}));
```

Replace base amount formatting calls for summary, progress, charts, and transaction base columns with `formatDisplayCurrency(...)`. Keep original transaction columns as `formatCurrency(d.original_amount, d.currency_code)` and `formatCurrency(e.original_amount, e.currency_code)` when present.

- [ ] **Step 7: Add currency selector markup**

Near the existing language selector, add:

```tsx
<div
  role="group"
  aria-label={t.currency.selectorLabel}
  className="flex items-center gap-0.5 rounded-full border border-border bg-surface px-1.5 py-1.5 shadow-sm"
>
  {DISPLAY_CURRENCIES.map((currency) => (
    <button
      key={currency}
      type="button"
      onClick={() => setDisplayCurrency(currency)}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1 ${
        displayCurrency === currency
          ? "bg-violet-400 text-violet-950 shadow-sm"
          : "text-muted hover:text-foreground"
      }`}
      aria-pressed={displayCurrency === currency}
    >
      {currency}
    </button>
  ))}
</div>
```

Use a wrapping container so the language selector and currency selector stack cleanly on mobile:

```tsx
<div className="flex flex-wrap justify-end gap-3">
  {/* currency selector */}
  {/* language selector */}
</div>
```

- [ ] **Step 8: Update chart calls and footer note**

Use converted chart data:

```tsx
<ExpenseCategoryChart
  data={convertedExpenseByCategory}
  currency={displayCurrency}
/>

<BudgetVsSpentChart
  data={convertedBudgetVsSpent}
  currency={displayCurrency}
  labels={{
    budget: t.charts.budget,
    spent: t.charts.spent,
  }}
/>
```

Build footer metadata:

```ts
const rateDate = formatDate(exchangeRates.fetchedAt);
const rateNote =
  displayCurrency === BASE_CURRENCY
    ? t.footer.note.replace("{currency}", BASE_CURRENCY)
    : `${t.footer.note.replace("{currency}", displayCurrency)} · ${
        exchangeRates.isFallback
          ? t.footer.fallbackRate.replace("{date}", rateDate)
          : t.footer.rateUpdated.replace("{date}", rateDate)
      }`;
```

Render status:

```tsx
{currencyStatus === "loading" && (
  <p className="text-xs text-muted">{t.currency.loading}</p>
)}
{currencyStatus === "error" && (
  <p className="text-xs text-warning">{t.currency.unavailable}</p>
)}
<p className="text-xs text-muted">{rateNote}</p>
{displayCurrency !== BASE_CURRENCY && (
  <p className="mt-1 text-[11px] text-muted">
    {t.currency.sourcePrefix}: {exchangeRates.source}
  </p>
)}
```

- [ ] **Step 9: Run checks and commit**

Run: `npm run test`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Commit:

```bash
git add lib/format.ts messages/en.ts messages/es.ts messages/zh-TW.ts components/ExpenseCategoryChart.tsx components/BudgetVsSpentChart.tsx components/DashboardClient.tsx
git commit -m "Add dashboard currency selector"
```

---

### Task 5: Verify In Browser

**Files:**
- No source files unless verification reveals a concrete issue.

- [ ] **Step 1: Start the development server**

Run:

```powershell
Start-Process -FilePath npm.cmd -ArgumentList "run dev -- --port 3000" -WorkingDirectory "C:\Users\vosto\LHDevStudio\Projects\carolina-care-fund-dashboard" -WindowStyle Hidden
```

Expected: server starts on `http://localhost:3000`.

- [ ] **Step 2: Verify the API route**

Open `http://localhost:3000/api/exchange-rates`.

Expected JSON:

```json
{
  "baseCurrency": "AUD",
  "rates": {
    "AUD": 1,
    "USD": 0.66,
    "TWD": 21.2
  },
  "source": "https://www.exchangerate-api.com",
  "fetchedAt": "2026-06-07T13:30:00.000Z",
  "isFallback": false
}
```

The exact `USD`, `TWD`, and `fetchedAt` values will differ.

- [ ] **Step 3: Verify dashboard currency behavior**

Open `http://localhost:3000`.

Manual checks:

- Default display is AUD.
- Selecting USD changes summary cards, progress values, chart tooltips, and displayed transaction base amounts.
- Selecting TWD changes the same areas.
- Original donation amounts remain in their original currencies.
- The footer shows selected currency rate metadata.
- Refresh keeps the selected display currency.
- Switching back to AUD leaves the page usable without another exchange-rate fetch.

- [ ] **Step 4: Verify responsive layout**

Check these viewport sizes:

- Desktop: `1440 x 900`
- Tablet: `768 x 1024`
- Mobile: `390 x 844`

Expected:

- Language and currency selectors do not overlap.
- Summary cards fit without text overflow.
- Tables remain horizontally scrollable on desktop/tablet and stacked on mobile.
- Chart containers remain nonblank.

- [ ] **Step 5: Final verification and commit fixes if needed**

Run:

```bash
npm run test
npm run lint
npm run build
```

Expected: all pass.

If browser verification required code changes, commit them:

```bash
git add .
git commit -m "Polish currency conversion display"
```

---

## Self-Review Checklist

- Spec goal "AUD remains official accounting base" is covered by `BASE_CURRENCY`, conversion helpers, and no mutation of dashboard source data.
- Spec goal "selector AUD/USD/TWD" is covered by Task 4.
- Spec goal "fetch rate when visitor changes currency" is covered by Task 2 and Task 4.
- Spec goal "historical AUD-to-USD and AUD-to-TWD storage" is covered by Task 3 because this repo lacks transaction creation code.
- Spec goal "transparent approximate values" is covered by footer messages and source metadata in Task 4.
- Provider choice uses ExchangeRate-API Open Access as an initial no-key endpoint; its documentation says the endpoint requires attribution, permits caching, and updates once per day.
- No task changes the official Supabase public summary math away from AUD.
