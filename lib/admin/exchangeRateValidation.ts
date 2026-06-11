export type AdminExchangeRateInput = {
  rateDate: string;
  quoteCurrencyCode: "USD" | "TWD";
  rate: number;
  source: string;
  fetchedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }

  return value.trim();
}

function requireIsoDate(value: unknown, label: string): string {
  const text = requireString(value, label);
  const parsed = new Date(`${text}T00:00:00.000Z`);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== text
  ) {
    throw new Error(`${label} must be a valid ISO date`);
  }

  return text;
}

function requireIsoDateTime(value: unknown, label: string): string {
  const text = requireString(value, label);
  const parsed = new Date(text);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid ISO datetime`);
  }

  return parsed.toISOString();
}

function requireQuoteCurrency(value: unknown): "USD" | "TWD" {
  if (value !== "USD" && value !== "TWD") {
    throw new Error("Quote currency must be USD or TWD");
  }

  return value;
}

function requirePositiveRate(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error("Rate must be greater than zero");
  }

  return value;
}

export function parseExchangeRateInput(
  value: unknown
): AdminExchangeRateInput {
  if (!isRecord(value)) {
    throw new Error("Exchange-rate payload is required");
  }

  return {
    rateDate: requireIsoDate(value.rateDate, "Rate date"),
    quoteCurrencyCode: requireQuoteCurrency(value.quoteCurrencyCode),
    rate: requirePositiveRate(value.rate),
    source: requireString(value.source, "Source"),
    fetchedAt: requireIsoDateTime(value.fetchedAt, "Fetched at"),
  };
}
