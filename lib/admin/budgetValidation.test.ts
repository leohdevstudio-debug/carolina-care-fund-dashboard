import { describe, expect, it } from "vitest";
import { parseBudgetInput } from "@/lib/admin/budgetValidation";

const validBudget = {
  campaignId: 1,
  expenseCategoryId: 2,
  budgetDescription: "Childcare weekly budget",
  estimatedAmount: 125.5,
  currencyCode: "AUD",
  notes: "Expected weekly cost",
};

describe("parseBudgetInput", () => {
  it("accepts valid budget payloads and trims text", () => {
    expect(
      parseBudgetInput({
        ...validBudget,
        budgetDescription: " Childcare weekly budget ",
        notes: " Expected weekly cost ",
      })
    ).toEqual(validBudget);
  });

  it("normalizes blank optional notes to null", () => {
    expect(parseBudgetInput({ ...validBudget, notes: " " })).toMatchObject({
      notes: null,
    });
  });

  it("rejects non-positive amounts", () => {
    expect(() =>
      parseBudgetInput({ ...validBudget, estimatedAmount: 0 })
    ).toThrow("Amount must be greater than zero");
  });

  it("rejects unsupported currencies", () => {
    expect(() =>
      parseBudgetInput({ ...validBudget, currencyCode: "EUR" })
    ).toThrow("Currency must be AUD, USD, or TWD");
  });
});
