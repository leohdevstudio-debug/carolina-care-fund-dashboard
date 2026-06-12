import { describe, expect, it } from "vitest";
import type { ExchangeRateResponse } from "@/lib/currency";
import {
  buildExpenseExportCsv,
  summarizeExpensesByMonth,
} from "@/lib/publicExpenseExport";
import type { PublicExpense } from "@/services/dashboard";

const exchangeRates: ExchangeRateResponse = {
  baseCurrency: "AUD",
  fetchedAt: "2026-06-12T00:00:00.000Z",
  isFallback: false,
  rates: {
    AUD: 1,
    USD: 0.65,
    TWD: 20,
  },
  source: "test",
};

const expenses: PublicExpense[] = [
  {
    base_currency_amount: 200,
    campaign_id: 1,
    campaign_name: "Care campaign",
    category_group: "Family",
    category_name: "ChildCare",
    currency_code: "AUD",
    expense_category_id: 2,
    expense_date: "2026-06-07",
    expense_description: 'DBS "weekly", childcare',
    expense_id: 10,
    original_amount: 200,
  },
  {
    base_currency_amount: 100,
    campaign_id: 1,
    campaign_name: "Care campaign",
    category_group: "Family",
    category_name: "ChildCare",
    currency_code: "AUD",
    expense_category_id: 2,
    expense_date: "2026-05-21",
    expense_description: "Weekly childcare",
    expense_id: 11,
    original_amount: 100,
  },
  {
    base_currency_amount: 50,
    campaign_id: 1,
    campaign_name: "Care campaign",
    category_group: "Other",
    category_name: "Fees",
    currency_code: "AUD",
    expense_category_id: 3,
    expense_date: "2026-05-14",
    expense_description: "Bank fee",
    expense_id: 12,
    original_amount: 50,
  },
];

describe("public expense export helpers", () => {
  it("summarizes public expenses by month in the selected display currency", () => {
    expect(
      summarizeExpensesByMonth({
        displayCurrency: "USD",
        exchangeRates,
        expenses,
        locale: "en-AU",
      })
    ).toEqual([
      {
        count: 1,
        displayAmount: 130,
        key: "2026-06",
        label: "June 2026",
      },
      {
        count: 2,
        displayAmount: 97.5,
        key: "2026-05",
        label: "May 2026",
      },
    ]);
  });

  it("builds an Excel-compatible CSV with all public expense details", () => {
    const csv = buildExpenseExportCsv({
      displayCurrency: "USD",
      exchangeRates,
      expenses: [expenses[0]],
      locale: "en-AU",
    });

    expect(csv).toContain(
      "Date,Month,Campaign,Category group,Category,Description,Original amount,Original currency,Base amount AUD,Display amount,Display currency"
    );
    expect(csv).toContain(
      '2026-06-07,June 2026,Care campaign,Family,ChildCare,"DBS ""weekly"", childcare",200,AUD,200,130,USD'
    );
  });
});
