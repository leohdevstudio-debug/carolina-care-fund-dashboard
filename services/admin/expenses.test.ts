import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/supabaseAdmin", () => ({
  adminFetch: vi.fn(),
}));

import { adminFetch } from "@/lib/admin/supabaseAdmin";
import {
  createAdminExpense,
  listAdminExpenses,
  softDeleteAdminExpense,
  updateAdminExpense,
} from "@/services/admin/expenses";

const adminFetchMock = vi.mocked(adminFetch);

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

const historicalRates = [
  {
    fetched_at: "2026-06-08T00:00:00.000Z",
    quote_currency_code: "USD",
    rate: 0.65,
    rate_date: "2026-06-08",
    source: "manual-admin",
  },
  {
    fetched_at: "2026-06-08T00:00:00.000Z",
    quote_currency_code: "TWD",
    rate: 20,
    rate_date: "2026-06-08",
    source: "manual-admin",
  },
];

describe("admin expense service", () => {
  beforeEach(() => {
    adminFetchMock.mockReset();
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
      .mockResolvedValueOnce(historicalRates)
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
      "exchange_rates",
      expect.stringContaining("rate_date=eq.2026-06-08")
    );
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      2,
      "expense",
      "select=*",
      expect.objectContaining({
        body: expect.objectContaining({
          aud_to_twd_rate: 20,
          aud_to_usd_rate: 0.65,
          base_currency_amount: 100,
          exchange_rate_date: "2026-06-08",
          exchange_rate_source: "manual-admin",
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
          p_entity_id: "7",
          p_entity_table: "expense",
        }),
      })
    );
  });

  it("updates an expense with historical rates when amount changes", async () => {
    adminFetchMock
      .mockResolvedValueOnce([insertedExpense])
      .mockResolvedValueOnce(historicalRates)
      .mockResolvedValueOnce([{ ...insertedExpense, original_amount: 130 }])
      .mockResolvedValueOnce({ audit_id: 1 });

    await updateAdminExpense(7, {
      campaignId: 1,
      expenseDate: "2026-06-08",
      expenseCategoryId: 2,
      expenseDescription: "Clinic invoice",
      originalAmount: 130,
      currencyCode: "USD",
    });

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      2,
      "exchange_rates",
      expect.stringContaining("rate_date=eq.2026-06-08")
    );
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      3,
      "expense",
      "expense_id=eq.7&select=*",
      expect.objectContaining({
        body: expect.objectContaining({
          aud_to_twd_rate: 20,
          aud_to_usd_rate: 0.65,
          base_currency_amount: 200,
          exchange_rate_date: "2026-06-08",
          exchange_rate_source: "manual-admin",
          original_amount: 130,
        }),
        method: "PATCH",
        prefer: "return=representation",
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
