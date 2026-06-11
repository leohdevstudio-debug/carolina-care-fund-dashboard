import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/supabaseAdmin", () => ({
  adminFetch: vi.fn(),
}));

import { adminFetch } from "@/lib/admin/supabaseAdmin";
import {
  createAdminExchangeRate,
  listAdminExchangeRates,
  updateAdminExchangeRate,
} from "@/services/admin/exchangeRates";

const adminFetchMock = vi.mocked(adminFetch);

const exchangeRate = {
  base_currency_code: "AUD",
  created_at: "2026-06-11T00:00:00.000Z",
  exchange_rate_id: 8,
  fetched_at: "2026-06-11T00:00:00.000Z",
  quote_currency_code: "USD",
  rate: 0.65,
  rate_date: "2026-06-11",
  source: "test-provider",
};

const input = {
  fetchedAt: "2026-06-11T00:00:00.000Z",
  quoteCurrencyCode: "USD",
  rate: 0.65,
  rateDate: "2026-06-11",
  source: "test-provider",
};

describe("admin exchange rate service", () => {
  beforeEach(() => {
    adminFetchMock.mockReset();
  });

  it("lists exchange rates ordered by date", async () => {
    adminFetchMock.mockResolvedValueOnce([exchangeRate]);

    await expect(listAdminExchangeRates()).resolves.toEqual([exchangeRate]);

    expect(adminFetchMock).toHaveBeenCalledWith(
      "v_admin_exchange_rate",
      expect.stringContaining("order=rate_date.desc%2Cfetched_at.desc")
    );
  });

  it("filters exchange rates by quote currency", async () => {
    adminFetchMock.mockResolvedValueOnce([exchangeRate]);

    await listAdminExchangeRates({ quoteCurrencyCode: "USD" });

    expect(adminFetchMock).toHaveBeenCalledWith(
      "v_admin_exchange_rate",
      expect.stringContaining("quote_currency_code=eq.USD")
    );
  });

  it("creates an exchange rate and writes audit", async () => {
    adminFetchMock
      .mockResolvedValueOnce([{ exchange_rate_id: 8 }])
      .mockResolvedValueOnce([exchangeRate])
      .mockResolvedValueOnce({ audit_id: 1 });

    await expect(createAdminExchangeRate(input)).resolves.toEqual(exchangeRate);

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      1,
      "exchange_rates",
      "select=exchange_rate_id",
      expect.objectContaining({
        body: expect.objectContaining({
          base_currency_code: "AUD",
          fetched_at: "2026-06-11T00:00:00.000Z",
          quote_currency_code: "USD",
          rate: 0.65,
          rate_date: "2026-06-11",
          source: "test-provider",
        }),
        method: "POST",
        prefer: "return=representation",
      })
    );
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      3,
      "rpc/admin_insert_audit_log",
      "",
      expect.objectContaining({
        body: expect.objectContaining({
          p_action: "create",
          p_entity_id: "8",
          p_entity_table: "exchange_rates",
        }),
      })
    );
  });

  it("updates an exchange rate and writes audit", async () => {
    adminFetchMock
      .mockResolvedValueOnce([exchangeRate])
      .mockResolvedValueOnce([{ exchange_rate_id: 8 }])
      .mockResolvedValueOnce([{ ...exchangeRate, rate: 0.66 }])
      .mockResolvedValueOnce({ audit_id: 1 });

    await updateAdminExchangeRate(8, {
      ...input,
      rate: 0.66,
    });

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      2,
      "exchange_rates",
      "exchange_rate_id=eq.8&select=exchange_rate_id",
      expect.objectContaining({
        body: expect.objectContaining({
          rate: 0.66,
          source: "test-provider",
        }),
        method: "PATCH",
        prefer: "return=representation",
      })
    );
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      4,
      "rpc/admin_insert_audit_log",
      "",
      expect.objectContaining({
        body: expect.objectContaining({
          p_action: "update",
          p_entity_table: "exchange_rates",
        }),
      })
    );
  });
});
