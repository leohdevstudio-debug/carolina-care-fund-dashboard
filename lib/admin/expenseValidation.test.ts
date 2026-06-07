import { describe, expect, it } from "vitest";
import {
  parseExpenseInput,
  parseSoftDeleteInput,
} from "@/lib/admin/expenseValidation";

const validExpense = {
  campaignId: 1,
  expenseDate: "2026-06-08",
  expenseCategoryId: 2,
  expenseDescription: "Clinic invoice",
  originalAmount: 125.5,
  currencyCode: "AUD",
};

describe("parseExpenseInput", () => {
  it("accepts a valid expense payload", () => {
    expect(parseExpenseInput(validExpense)).toEqual(validExpense);
  });

  it("rejects non-positive amounts", () => {
    expect(() =>
      parseExpenseInput({ ...validExpense, originalAmount: 0 })
    ).toThrow("Amount must be greater than zero");
  });

  it("rejects unsupported currency codes", () => {
    expect(() =>
      parseExpenseInput({ ...validExpense, currencyCode: "EUR" })
    ).toThrow("Currency must be AUD, USD, or TWD");
  });

  it("rejects invalid dates", () => {
    expect(() =>
      parseExpenseInput({ ...validExpense, expenseDate: "2026-02-30" })
    ).toThrow("Expense date must be a valid ISO date");
  });
});

describe("parseSoftDeleteInput", () => {
  it("accepts a reason", () => {
    expect(parseSoftDeleteInput({ reason: "Duplicate entry" })).toEqual({
      reason: "Duplicate entry",
    });
  });

  it("rejects an empty reason", () => {
    expect(() => parseSoftDeleteInput({ reason: "   " })).toThrow(
      "Soft delete reason is required"
    );
  });
});
