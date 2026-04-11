const BASE_CURRENCY = "AUD";

export function formatCurrency(value: number, currency = BASE_CURRENCY): string {
  return new Intl.NumberFormat("en-AU", {
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