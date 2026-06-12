import { describe, expect, it, vi } from "vitest";
import {
  clearExchangeRateCache,
  fetchHistoricalProviderExchangeRates,
  fetchProviderExchangeRates,
  getCurrentExchangeRates,
} from "@/lib/exchangeRates";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("exchange-rate provider", () => {
  it("maps provider rates into the app response shape", async () => {
    const fetcher = async () =>
      response({
        result: "success",
        provider: "https://www.exchangerate-api.com",
        time_last_update_utc: "Sun, 07 Jun 2026 13:30:00 +0000",
        base_code: "AUD",
        rates: {
          AUD: 1,
          USD: 0.66,
          TWD: 21.2,
        },
      });

    await expect(fetchProviderExchangeRates(fetcher)).resolves.toEqual({
      baseCurrency: "AUD",
      rates: {
        AUD: 1,
        USD: 0.66,
        TWD: 21.2,
      },
      source: "https://www.exchangerate-api.com",
      fetchedAt: "2026-06-07T13:30:00.000Z",
      isFallback: false,
    });
  });

  it("rejects provider responses that do not include USD and TWD", async () => {
    const fetcher = async () =>
      response({
        result: "success",
        provider: "https://www.exchangerate-api.com",
        time_last_update_utc: "Sun, 07 Jun 2026 13:30:00 +0000",
        base_code: "AUD",
        rates: {
          AUD: 1,
          USD: 0.66,
        },
      });

    await expect(fetchProviderExchangeRates(fetcher)).rejects.toThrow(
      "Provider response is missing TWD"
    );
  });

  it("returns cached rates without refetching while fresh", async () => {
    clearExchangeRateCache();

    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return response({
        result: "success",
        provider: "https://www.exchangerate-api.com",
        time_last_update_utc: "Sun, 07 Jun 2026 13:30:00 +0000",
        base_code: "AUD",
        rates: {
          AUD: 1,
          USD: 0.66,
          TWD: 21.2,
        },
      });
    };

    const now = () => new Date("2026-06-07T14:00:00.000Z");

    await getCurrentExchangeRates(fetcher, now);
    await getCurrentExchangeRates(fetcher, now);

    expect(calls).toBe(1);
  });

  it("uses stale cached rates as fallback when refresh fails", async () => {
    clearExchangeRateCache();

    const successFetcher = async () =>
      response({
        result: "success",
        provider: "https://www.exchangerate-api.com",
        time_last_update_utc: "Sun, 07 Jun 2026 13:30:00 +0000",
        base_code: "AUD",
        rates: {
          AUD: 1,
          USD: 0.66,
          TWD: 21.2,
        },
      });

    await getCurrentExchangeRates(successFetcher, () =>
      new Date("2026-06-07T14:00:00.000Z")
    );

    const failingFetcher = async () => response({ result: "error" }, 500);

    await expect(
      getCurrentExchangeRates(failingFetcher, () =>
        new Date("2026-06-07T22:00:00.000Z")
      )
    ).resolves.toMatchObject({
      rates: {
        AUD: 1,
        USD: 0.66,
        TWD: 21.2,
      },
      isFallback: true,
    });
  });

  it("fetches historical rates for a selected date with an API key", async () => {
    const fetcher = vi.fn(async () =>
      response({
        meta: {
          last_updated_at: "2026-05-01T23:59:59Z",
        },
        data: {
          USD: {
            code: "USD",
            value: 0.64,
          },
          TWD: {
            code: "TWD",
            value: 20.15,
          },
        },
      })
    );

    await expect(
      fetchHistoricalProviderExchangeRates(
        "2026-05-01",
        fetcher,
        () => new Date("2026-06-12T01:30:00.000Z"),
        "test-key"
      )
    ).resolves.toEqual({
      baseCurrency: "AUD",
      rates: {
        AUD: 1,
        USD: 0.64,
        TWD: 20.15,
      },
      source: "https://currencyapi.com",
      fetchedAt: "2026-06-12T01:30:00.000Z",
      isFallback: false,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.currencyapi.com/v3/historical?date=2026-05-01&base_currency=AUD&currencies=USD%2CTWD",
      expect.objectContaining({
        headers: {
          accept: "application/json",
          apikey: "test-key",
        },
      })
    );
  });

  it("requires an API key for historical rates", async () => {
    await expect(
      fetchHistoricalProviderExchangeRates(
        "2026-05-01",
        async () => response({}),
        () => new Date("2026-06-12T01:30:00.000Z"),
        ""
      )
    ).rejects.toThrow(
      "Historical exchange-rate lookup requires CURRENCYAPI_API_KEY"
    );
  });
});
