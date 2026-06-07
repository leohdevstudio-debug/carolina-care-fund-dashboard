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
