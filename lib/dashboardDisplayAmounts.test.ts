import { describe, expect, it } from "vitest";
import { getDashboardDisplayAmounts } from "@/lib/dashboardDisplayAmounts";
import type { ExchangeRateResponse } from "@/lib/currency";

const exchangeRates: ExchangeRateResponse = {
  baseCurrency: "AUD",
  fetchedAt: "2026-06-11T00:00:00.000Z",
  isFallback: false,
  rates: {
    AUD: 1,
    USD: 0.65,
    TWD: 20,
  },
  source: "test",
};

describe("dashboard display amounts", () => {
  it("uses the displayed donation total for progress funded text", () => {
    const amounts = getDashboardDisplayAmounts({
      displayCurrency: "USD",
      donations: [
        {
          base_currency_amount: 7427.77,
          currency_code: "USD",
          original_amount: 4980,
        },
      ],
      exchangeRates,
      totalReceivedBase: 7427.77,
      totalSpentBase: 0,
    });

    expect(amounts.convertedBaseTotalReceived).toBeCloseTo(4828.05, 2);
    expect(amounts.displayedTotalReceived).toBe(4980);
    expect(amounts.progressFundedAmount).toBe(4980);
  });
});
