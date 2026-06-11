import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/supabaseAdmin", () => ({
  adminFetch: vi.fn(),
}));

vi.mock("@/lib/exchangeRates", () => ({
  getCurrentExchangeRates: vi.fn(),
}));

import { adminFetch } from "@/lib/admin/supabaseAdmin";
import { getCurrentExchangeRates } from "@/lib/exchangeRates";
import { getAdminExchangeRateSnapshotForDate } from "@/services/admin/exchangeRateSnapshots";

const adminFetchMock = vi.mocked(adminFetch);
const getCurrentExchangeRatesMock = vi.mocked(getCurrentExchangeRates);

describe("getAdminExchangeRateSnapshotForDate", () => {
  beforeEach(() => {
    adminFetchMock.mockReset();
    getCurrentExchangeRatesMock.mockReset();
  });

  it("loads AUD quote rates for the requested historical date", async () => {
    adminFetchMock.mockResolvedValueOnce([
      {
        fetched_at: "2026-05-01T01:00:00.000Z",
        quote_currency_code: "USD",
        rate: 0.64,
        rate_date: "2026-05-01",
        source: "manual-admin",
      },
      {
        fetched_at: "2026-05-01T01:00:00.000Z",
        quote_currency_code: "TWD",
        rate: 19.8,
        rate_date: "2026-05-01",
        source: "manual-admin",
      },
    ]);

    await expect(
      getAdminExchangeRateSnapshotForDate("2026-05-01")
    ).resolves.toEqual({
      fetchedAt: "2026-05-01T01:00:00.000Z",
      rateDate: "2026-05-01",
      rates: {
        AUD: 1,
        TWD: 19.8,
        USD: 0.64,
      },
      source: "manual-admin",
    });

    expect(adminFetchMock).toHaveBeenCalledWith(
      "exchange_rates",
      expect.stringContaining("rate_date=eq.2026-05-01")
    );
  });

  it("requires both USD and TWD rates for the requested date", async () => {
    adminFetchMock.mockResolvedValueOnce([
      {
        fetched_at: "2026-05-01T01:00:00.000Z",
        quote_currency_code: "USD",
        rate: 0.64,
        rate_date: "2026-05-01",
        source: "manual-admin",
      },
    ]);

    await expect(
      getAdminExchangeRateSnapshotForDate("2026-05-01", {
        now: () => new Date("2026-06-11T00:00:00.000Z"),
      })
    ).rejects.toThrow(
      "Missing exchange rates for 2026-05-01. Add USD and TWD rates in Exchange Rates Admin before saving this record."
    );
  });

  it("fetches and stores missing rates automatically for today's date", async () => {
    const fetchedAt = "2026-06-11T00:02:31.000Z";
    const storedRates = [
      {
        fetched_at: fetchedAt,
        quote_currency_code: "USD",
        rate: 0.700455,
        rate_date: "2026-06-11",
        source: "https://www.exchangerate-api.com",
      },
      {
        fetched_at: fetchedAt,
        quote_currency_code: "TWD",
        rate: 22.196047,
        rate_date: "2026-06-11",
        source: "https://www.exchangerate-api.com",
      },
    ];

    adminFetchMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ exchange_rate_id: 10 }, { exchange_rate_id: 11 }])
      .mockResolvedValueOnce(storedRates);
    getCurrentExchangeRatesMock.mockResolvedValueOnce({
      baseCurrency: "AUD",
      fetchedAt,
      isFallback: false,
      rates: {
        AUD: 1,
        TWD: 22.196047,
        USD: 0.700455,
      },
      source: "https://www.exchangerate-api.com",
    });

    await expect(
      getAdminExchangeRateSnapshotForDate("2026-06-11", {
        now: () => new Date("2026-06-10T15:00:00.000Z"),
      })
    ).resolves.toEqual({
      fetchedAt,
      rateDate: "2026-06-11",
      rates: {
        AUD: 1,
        TWD: 22.196047,
        USD: 0.700455,
      },
      source: "https://www.exchangerate-api.com",
    });

    expect(getCurrentExchangeRatesMock).toHaveBeenCalledOnce();
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      2,
      "exchange_rates",
      "select=exchange_rate_id",
      expect.objectContaining({
        body: [
          expect.objectContaining({
            quote_currency_code: "USD",
            rate: 0.700455,
            rate_date: "2026-06-11",
          }),
          expect.objectContaining({
            quote_currency_code: "TWD",
            rate: 22.196047,
            rate_date: "2026-06-11",
          }),
        ],
        method: "POST",
        prefer: "return=representation",
      })
    );
  });
});
