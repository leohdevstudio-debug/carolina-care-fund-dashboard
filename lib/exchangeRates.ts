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
