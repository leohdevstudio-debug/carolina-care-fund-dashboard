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
