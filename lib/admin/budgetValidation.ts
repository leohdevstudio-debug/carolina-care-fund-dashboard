import { isDisplayCurrency, type DisplayCurrency } from "@/lib/currency";

export type AdminBudgetInput = {
  campaignId: number;
  expenseCategoryId: number;
  budgetDescription: string;
  estimatedAmount: number;
  currencyCode: DisplayCurrency;
  notes: string | null;
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

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function requireCurrency(value: unknown): DisplayCurrency {
  if (!isDisplayCurrency(value)) {
    throw new Error("Currency must be AUD, USD, or TWD");
  }

  return value;
}

export function parseBudgetInput(value: unknown): AdminBudgetInput {
  if (!isRecord(value)) {
    throw new Error("Budget payload is required");
  }

  return {
    campaignId: requirePositiveInteger(value.campaignId, "Campaign"),
    expenseCategoryId: requirePositiveInteger(
      value.expenseCategoryId,
      "Expense category"
    ),
    budgetDescription: requireString(
      value.budgetDescription,
      "Budget description"
    ),
    estimatedAmount: requirePositiveAmount(value.estimatedAmount),
    currencyCode: requireCurrency(value.currencyCode),
    notes: optionalString(value.notes),
  };
}
