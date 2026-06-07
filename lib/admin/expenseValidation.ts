import { isDisplayCurrency, type DisplayCurrency } from "@/lib/currency";

export type AdminExpenseInput = {
  campaignId: number;
  expenseDate: string;
  expenseCategoryId: number;
  expenseDescription: string;
  originalAmount: number;
  currencyCode: DisplayCurrency;
};

export type SoftDeleteInput = {
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${label} is required`);
  }

  return Number(value);
}

function requirePositiveAmount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  return value;
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

function requireCurrency(value: unknown): DisplayCurrency {
  if (!isDisplayCurrency(value)) {
    throw new Error("Currency must be AUD, USD, or TWD");
  }

  return value;
}

export function parseExpenseInput(value: unknown): AdminExpenseInput {
  if (!isRecord(value)) {
    throw new Error("Expense payload is required");
  }

  return {
    campaignId: requirePositiveInteger(value.campaignId, "Campaign"),
    expenseDate: requireIsoDate(value.expenseDate, "Expense date"),
    expenseCategoryId: requirePositiveInteger(
      value.expenseCategoryId,
      "Expense category"
    ),
    expenseDescription: requireString(
      value.expenseDescription,
      "Expense description"
    ),
    originalAmount: requirePositiveAmount(value.originalAmount),
    currencyCode: requireCurrency(value.currencyCode),
  };
}

export function parseSoftDeleteInput(value: unknown): SoftDeleteInput {
  if (!isRecord(value)) {
    throw new Error("Soft delete payload is required");
  }

  const reason = requireString(value.reason, "Soft delete reason");

  return { reason };
}
