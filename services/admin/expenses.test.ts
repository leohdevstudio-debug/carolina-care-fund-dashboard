import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/supabaseAdmin", () => ({
  adminFetch: vi.fn(),
}));

vi.mock("@/lib/exchangeRates", () => ({
  getCurrentExchangeRates: vi.fn(),
}));

import { adminFetch } from "@/lib/admin/supabaseAdmin";
import { getCurrentExchangeRates } from "@/lib/exchangeRates";
import {
  createAdminExpense,
  listAdminExpenses,
  softDeleteAdminExpense,
} from "@/services/admin/expenses";

const adminFetchMock = vi.mocked(adminFetch);
const getCurrentExchangeRatesMock = vi.mocked(getCurrentExchangeRates);

const insertedExpense = {
  expense_id: 7,
  campaign_id: 1,
  campaign_name: "Care campaign",
  expense_date: "2026-06-08",
  expense_category_id: 2,
  category_name: "Medical",
  category_group: "Care",
  expense_description: "Clinic invoice",
  original_amount: 65,
  currency_code: "USD",
  base_currency_amount: 100,
  aud_to_usd_rate: 0.65,
  aud_to_twd_rate: 20,
  exchange_rate_date: "2026-06-08",
  exchange_rate_source: "test-provider",
  exchange_rate_fetched_at: "2026-06-08T00:00:00.000Z",
  created_at: "2026-06-08T00:00:00.000Z",
  updated_at: "2026-06-08T00:00:00.000Z",
  deleted_at: null,
  deleted_reason: null,
  deleted_by: null,
};

describe("admin expense service", () => {
  beforeEach(() => {
    adminFetchMock.mockReset();
    getCurrentExchangeRatesMock.mockReset();
    getCurrentExchangeRatesMock.mockResolvedValue({
      baseCurrency: "AUD",
      rates: {
        AUD: 1,
        USD: 0.65,
        TWD: 20,
      },
      source: "test-provider",
      fetchedAt: "2026-06-08T00:00:00.000Z",
      isFallback: false,
    });
  });

  it("lists active expenses by default", async () => {
    adminFetchMock.mockResolvedValueOnce([insertedExpense]);

    await expect(listAdminExpenses()).resolves.toEqual([insertedExpense]);

    expect(adminFetchMock).toHaveBeenCalledWith(
      "v_admin_expense",
      expect.stringContaining("deleted_at=is.null")
    );
  });

  it("creates an expense with exchange-rate snapshots and AUD base amount", async () => {
    adminFetchMock
      .mockResolvedValueOnce([insertedExpense])
      .mockResolvedValueOnce({ audit_id: 1 });

    await expect(
      createAdminExpense({
        campaignId: 1,
        expenseDate: "2026-06-08",
        expenseCategoryId: 2,
        expenseDescription: "Clinic invoice",
        originalAmount: 65,
        currencyCode: "USD",
      })
    ).resolves.toEqual(insertedExpense);

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      1,
      "expenses",
      "select=*",
      expect.objectContaining({
        body: expect.objectContaining({
          aud_to_twd_rate: 20,
          aud_to_usd_rate: 0.65,
          base_currency_amount: 100,
          exchange_rate_date: "2026-06-08",
        }),
        method: "POST",
        prefer: "return=representation",
      })
    );
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      2,
      "rpc/admin_insert_audit_log",
      "",
      expect.objectContaining({
        body: expect.objectContaining({
          p_action: "create",
          p_entity_id: "7",
          p_entity_table: "expenses",
        }),
      })
    );
  });

  it("soft deletes an expense with an audit reason", async () => {
    adminFetchMock
      .mockResolvedValueOnce([insertedExpense])
      .mockResolvedValueOnce([{ ...insertedExpense, deleted_reason: "Duplicate" }])
      .mockResolvedValueOnce({ audit_id: 1 });

    await softDeleteAdminExpense(7, "Duplicate");

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      3,
      "rpc/admin_insert_audit_log",
      "",
      expect.objectContaining({
        body: expect.objectContaining({
          p_action: "soft_delete",
          p_reason: "Duplicate",
        }),
      })
    );
  });
});
