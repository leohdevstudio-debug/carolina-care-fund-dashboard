import { describe, expect, it } from "vitest";
import {
  BASE_CURRENCY,
  DISPLAY_CURRENCIES,
  convertFromBase,
  getDisplayRate,
  isDisplayCurrency,
  normalizeExchangeRateResponse,
} from "@/lib/currency";

describe("currency helpers", () => {
  const rates = {
    baseCurrency: "AUD",
    rates: {
      AUD: 1,
      USD: 0.66,
      TWD: 21.2,
    },
    source: "test-provider",
    fetchedAt: "2026-06-07T13:30:00.000Z",
    isFallback: false,
  };

  it("defines AUD as the only accounting base", () => {
    expect(BASE_CURRENCY).toBe("AUD");
    expect(DISPLAY_CURRENCIES).toEqual(["AUD", "USD", "TWD"]);
  });

  it("accepts only supported display currencies", () => {
    expect(isDisplayCurrency("AUD")).toBe(true);
    expect(isDisplayCurrency("USD")).toBe(true);
    expect(isDisplayCurrency("TWD")).toBe(true);
    expect(isDisplayCurrency("EUR")).toBe(false);
    expect(isDisplayCurrency(null)).toBe(false);
  });

  it("converts AUD base amounts into the selected display currency", () => {
    expect(convertFromBase(100, "AUD", rates)).toBe(100);
    expect(convertFromBase(100, "USD", rates)).toBe(66);
    expect(convertFromBase(100, "TWD", rates)).toBe(2120);
  });

  it("returns the selected display rate", () => {
    expect(getDisplayRate("AUD", rates)).toBe(1);
    expect(getDisplayRate("USD", rates)).toBe(0.66);
    expect(getDisplayRate("TWD", rates)).toBe(21.2);
  });

  it("normalizes unknown JSON into a safe exchange-rate response", () => {
    expect(
      normalizeExchangeRateResponse({
        baseCurrency: "AUD",
        rates: { AUD: 1, USD: 0.7, TWD: 22 },
        source: "unit-test",
        fetchedAt: "2026-06-07T13:30:00.000Z",
        isFallback: true,
      })
    ).toEqual({
      baseCurrency: "AUD",
      rates: { AUD: 1, USD: 0.7, TWD: 22 },
      source: "unit-test",
      fetchedAt: "2026-06-07T13:30:00.000Z",
      isFallback: true,
    });
  });

  it("rejects incomplete exchange-rate responses", () => {
    expect(() =>
      normalizeExchangeRateResponse({
        baseCurrency: "AUD",
        rates: { AUD: 1, USD: 0.7 },
        source: "unit-test",
        fetchedAt: "2026-06-07T13:30:00.000Z",
        isFallback: false,
      })
    ).toThrow("Missing exchange rate for TWD");
  });
});
