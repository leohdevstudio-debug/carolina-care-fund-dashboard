import {
  convertFromBase,
  type DisplayCurrency,
  type ExchangeRateResponse,
} from "@/lib/currency";
import type { PublicExpense } from "@/services/dashboard";

type ExpenseHelperInput = {
  displayCurrency: DisplayCurrency;
  exchangeRates: ExchangeRateResponse;
  expenses: PublicExpense[];
  locale: string;
};

export type MonthlyExpenseSummary = {
  key: string;
  label: string;
  count: number;
  displayAmount: number;
};

function monthKey(value: string): string {
  return value.slice(0, 7);
}

function monthLabel(key: string, locale: string): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function displayAmount(
  baseAmount: number,
  displayCurrency: DisplayCurrency,
  exchangeRates: ExchangeRateResponse
): number {
  return Number(
    convertFromBase(baseAmount, displayCurrency, exchangeRates).toFixed(2)
  );
}

function csvCell(value: string | number): string {
  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function summarizeExpensesByMonth({
  displayCurrency,
  exchangeRates,
  expenses,
  locale,
}: ExpenseHelperInput): MonthlyExpenseSummary[] {
  const summaries = new Map<string, { count: number; totalBase: number }>();

  expenses.forEach((expense) => {
    const key = monthKey(expense.expense_date);
    const current = summaries.get(key) ?? { count: 0, totalBase: 0 };

    summaries.set(key, {
      count: current.count + 1,
      totalBase: current.totalBase + Number(expense.base_currency_amount ?? 0),
    });
  });

  return Array.from(summaries.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, summary]) => ({
      count: summary.count,
      displayAmount: displayAmount(
        summary.totalBase,
        displayCurrency,
        exchangeRates
      ),
      key,
      label: monthLabel(key, locale),
    }));
}

export function buildExpenseExportCsv({
  displayCurrency,
  exchangeRates,
  expenses,
  locale,
}: ExpenseHelperInput): string {
  const header = [
    "Date",
    "Month",
    "Campaign",
    "Category group",
    "Category",
    "Description",
    "Original amount",
    "Original currency",
    "Base amount AUD",
    "Display amount",
    "Display currency",
  ];

  const rows = expenses.map((expense) => {
    const key = monthKey(expense.expense_date);

    return [
      expense.expense_date,
      monthLabel(key, locale),
      expense.campaign_name,
      expense.category_group,
      expense.category_name,
      expense.expense_description,
      Number(expense.original_amount ?? 0),
      expense.currency_code,
      Number(expense.base_currency_amount ?? 0),
      displayAmount(
        Number(expense.base_currency_amount ?? 0),
        displayCurrency,
        exchangeRates
      ),
      displayCurrency,
    ];
  });

  return `\uFEFF${[header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n")}`;
}

export function buildExpenseExportFileName(date = new Date()): string {
  return `carolina-care-fund-expenses-${date.toISOString().slice(0, 10)}.csv`;
}
