import { describe, expect, it } from "vitest";
import { parseExchangeRateInput } from "@/lib/admin/exchangeRateValidation";

const validRate = {
  rateDate: "2026-06-11",
  quoteCurrencyCode: "USD",
  rate: 0.65,
  source: "test-provider",
  fetchedAt: "2026-06-11T00:00:00.000Z",
};

describe("parseExchangeRateInput", () => {
  it("accepts valid exchange-rate payloads and trims source", () => {
    expect(
      parseExchangeRateInput({
        ...validRate,
        source: " test-provider ",
      })
    ).toEqual(validRate);
  });

  it("rejects AUD as a quote currency", () => {
    expect(() =>
      parseExchangeRateInput({
        ...validRate,
        quoteCurrencyCode: "AUD",
      })
    ).toThrow("Quote currency must be USD or TWD");
  });

  it("rejects non-positive rates", () => {
    expect(() =>
      parseExchangeRateInput({
        ...validRate,
        rate: 0,
      })
    ).toThrow("Rate must be greater than zero");
  });

  it("rejects invalid rate dates", () => {
    expect(() =>
      parseExchangeRateInput({
        ...validRate,
        rateDate: "2026-02-30",
      })
    ).toThrow("Rate date must be a valid ISO date");
  });

  it("rejects invalid fetched timestamps", () => {
    expect(() =>
      parseExchangeRateInput({
        ...validRate,
        fetchedAt: "not-a-date",
      })
    ).toThrow("Fetched at must be a valid ISO datetime");
  });
});
