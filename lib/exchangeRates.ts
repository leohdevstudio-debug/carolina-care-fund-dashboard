import {
  BASE_CURRENCY,
  type DisplayCurrency,
  type ExchangeRateResponse,
} from "@/lib/currency";

type NextFetchRequestInit = RequestInit & {
  next?: {
    revalidate: number;
  };
};

type FetchLike = (
  input: string,
  init?: NextFetchRequestInit
) => Promise<Response>;

type ProviderPayload = {
  result?: string;
  provider?: string;
  time_last_update_utc?: string;
  base_code?: string;
  rates?: Partial<Record<DisplayCurrency, number>>;
};

type CurrencyApiRate = {
  code?: string;
  value?: number;
};

type HistoricalProviderPayload = {
  data?: Partial<Record<"USD" | "TWD", CurrencyApiRate>>;
  meta?: {
    last_updated_at?: string;
  };
  message?: string;
};

type CacheEntry = {
  value: ExchangeRateResponse;
  expiresAt: number;
};

const PROVIDER_URL =
  process.env.EXCHANGE_RATE_PROVIDER_URL ??
  "https://open.er-api.com/v6/latest/AUD";
const HISTORICAL_PROVIDER_URL =
  process.env.CURRENCYAPI_HISTORICAL_PROVIDER_URL ??
  "https://api.currencyapi.com/v3/historical";
const DEFAULT_ADMIN_TIME_ZONE = "Australia/Brisbane";

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

function parseRateDate(value: string): {
  day: number;
  month: number;
  year: number;
} {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("Rate date must be a valid ISO date");
  }

  const [year, month, day] = value.split("-").map(Number);

  return { day, month, year };
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

function requireCurrencyApiRate(
  data: HistoricalProviderPayload["data"],
  currency: "USD" | "TWD"
): number {
  const rate = data?.[currency]?.value;

  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Provider response is missing ${currency}`);
  }

  return rate;
}

function historicalProviderUrl(rateDate: string): string {
  parseRateDate(rateDate);
  const url = new URL(HISTORICAL_PROVIDER_URL);

  url.searchParams.set("date", rateDate);
  url.searchParams.set("base_currency", BASE_CURRENCY);
  url.searchParams.set("currencies", "USD,TWD");

  return url.toString();
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

export async function fetchHistoricalProviderExchangeRates(
  rateDate: string,
  fetcher: FetchLike = fetch,
  now: () => Date = () => new Date(),
  apiKey = process.env.CURRENCYAPI_API_KEY ?? ""
): Promise<ExchangeRateResponse> {
  const key = apiKey.trim();

  if (!key) {
    throw new Error(
      "Historical exchange-rate lookup requires CURRENCYAPI_API_KEY"
    );
  }

  const response = await fetcher(historicalProviderUrl(rateDate), {
    headers: {
      accept: "application/json",
      apikey: key,
    },
    next: {
      revalidate: 24 * 60 * 60,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Historical exchange-rate provider failed with ${response.status}`
    );
  }

  const payload = (await response.json()) as HistoricalProviderPayload;

  if (!payload.data) {
    throw new Error(
      `Historical exchange-rate provider returned ${
        payload.message ?? "an error"
      }`
    );
  }

  return {
    baseCurrency: BASE_CURRENCY,
    rates: {
      AUD: 1,
      USD: requireCurrencyApiRate(payload.data, "USD"),
      TWD: requireCurrencyApiRate(payload.data, "TWD"),
    },
    source: "https://currencyapi.com",
    fetchedAt: now().toISOString(),
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

type DateExchangeRateOptions = {
  apiKey?: string;
  fetcher?: FetchLike;
  now?: () => Date;
  timeZone?: string;
};

export async function getExchangeRatesForDate(
  rateDate: string,
  options: DateExchangeRateOptions = {}
): Promise<ExchangeRateResponse> {
  parseRateDate(rateDate);

  const now = options.now ?? (() => new Date());
  const today = todayInTimeZone(
    now(),
    options.timeZone ?? DEFAULT_ADMIN_TIME_ZONE
  );

  if (rateDate > today) {
    throw new Error("Rate date cannot be in the future");
  }

  if (rateDate === today) {
    return getCurrentExchangeRates(options.fetcher, now);
  }

  return fetchHistoricalProviderExchangeRates(
    rateDate,
    options.fetcher,
    now,
    options.apiKey
  );
}
