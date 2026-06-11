import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/supabaseAdmin", () => ({
  adminFetch: vi.fn(),
}));

vi.mock("@/lib/exchangeRates", () => ({
  getCurrentExchangeRates: vi.fn(),
}));

vi.mock("@/services/admin/campaignTargets", () => ({
  recalculateCampaignTargets: vi.fn(),
}));

import { adminFetch } from "@/lib/admin/supabaseAdmin";
import { getCurrentExchangeRates } from "@/lib/exchangeRates";
import { recalculateCampaignTargets } from "@/services/admin/campaignTargets";
import {
  createAdminBudget,
  listAdminBudgets,
  restoreAdminBudget,
  softDeleteAdminBudget,
  updateAdminBudget,
} from "@/services/admin/budgets";

const adminFetchMock = vi.mocked(adminFetch);
const getCurrentExchangeRatesMock = vi.mocked(getCurrentExchangeRates);
const recalculateCampaignTargetsMock = vi.mocked(recalculateCampaignTargets);

const budget = {
  base_currency_amount: 100,
  budget_description: "Childcare weekly budget",
  budget_id: 5,
  campaign_id: 1,
  campaign_name: "Care campaign",
  category_group: "Care",
  category_name: "ChildCare",
  created_at: "2026-06-11T00:00:00.000Z",
  currency_code: "USD",
  deleted_at: null,
  deleted_by: null,
  deleted_reason: null,
  estimated_amount: 65,
  exchange_rate_to_base: 1.53846154,
  expense_category_id: 2,
  notes: "Expected weekly cost",
  updated_at: "2026-06-11T00:00:00.000Z",
};

const input = {
  budgetDescription: "Childcare weekly budget",
  campaignId: 1,
  currencyCode: "USD",
  estimatedAmount: 65,
  expenseCategoryId: 2,
  notes: "Expected weekly cost",
};

describe("admin budget service", () => {
  beforeEach(() => {
    adminFetchMock.mockReset();
    getCurrentExchangeRatesMock.mockReset();
    recalculateCampaignTargetsMock.mockReset();
    recalculateCampaignTargetsMock.mockResolvedValue();
    getCurrentExchangeRatesMock.mockResolvedValue({
      baseCurrency: "AUD",
      rates: {
        AUD: 1,
        USD: 0.65,
        TWD: 20,
      },
      source: "test-provider",
      fetchedAt: "2026-06-11T00:00:00.000Z",
      isFallback: false,
    });
  });

  it("lists active budgets by default", async () => {
    adminFetchMock.mockResolvedValueOnce([budget]);

    await expect(listAdminBudgets()).resolves.toEqual([budget]);

    expect(adminFetchMock).toHaveBeenCalledWith(
      "v_admin_budget",
      expect.stringContaining("deleted_at=is.null")
    );
  });

  it("creates a budget with exchange-rate snapshots and writes audit", async () => {
    adminFetchMock
      .mockResolvedValueOnce([{ budget_id: 5 }])
      .mockResolvedValueOnce([budget])
      .mockResolvedValueOnce({ audit_id: 1 });

    await expect(createAdminBudget(input)).resolves.toEqual(budget);

    expect(recalculateCampaignTargetsMock).toHaveBeenCalledWith([1]);
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      1,
      "budget",
      "select=budget_id",
      expect.objectContaining({
        body: expect.objectContaining({
          base_currency_amount: 100,
          budget_description: "Childcare weekly budget",
          created_by: "admin",
          exchange_rate_to_base: 1.53846154,
          updated_by: "admin",
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
          p_entity_id: "5",
          p_entity_table: "budget",
        }),
      })
    );
  });

  it("updates a budget and refreshes rates when amount changes", async () => {
    adminFetchMock
      .mockResolvedValueOnce([budget])
      .mockResolvedValueOnce([{ budget_id: 5 }])
      .mockResolvedValueOnce([{ ...budget, estimated_amount: 130 }])
      .mockResolvedValueOnce({ audit_id: 1 });

    await updateAdminBudget(5, {
      ...input,
      estimatedAmount: 130,
    });

    expect(recalculateCampaignTargetsMock).toHaveBeenCalledWith([1]);
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      2,
      "budget",
      "budget_id=eq.5&select=budget_id",
      expect.objectContaining({
        body: expect.objectContaining({
          base_currency_amount: 200,
          estimated_amount: 130,
          exchange_rate_to_base: 1.53846154,
          updated_by: "admin",
        }),
        method: "PATCH",
        prefer: "return=representation",
      })
    );
  });

  it("soft deletes a budget with an audit reason", async () => {
    adminFetchMock
      .mockResolvedValueOnce([budget])
      .mockResolvedValueOnce([{ budget_id: 5 }])
      .mockResolvedValueOnce([{ ...budget, deleted_reason: "Duplicate" }])
      .mockResolvedValueOnce({ audit_id: 1 });

    await softDeleteAdminBudget(5, "Duplicate");

    expect(recalculateCampaignTargetsMock).toHaveBeenCalledWith([1]);
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      4,
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

  it("restores a budget and writes audit", async () => {
    const deleted = {
      ...budget,
      deleted_at: "2026-06-11T01:00:00.000Z",
      deleted_by: "admin",
      deleted_reason: "Duplicate",
    };
    adminFetchMock
      .mockResolvedValueOnce([deleted])
      .mockResolvedValueOnce([{ budget_id: 5 }])
      .mockResolvedValueOnce([budget])
      .mockResolvedValueOnce({ audit_id: 1 });

    await restoreAdminBudget(5);

    expect(recalculateCampaignTargetsMock).toHaveBeenCalledWith([1]);
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      4,
      "rpc/admin_insert_audit_log",
      "",
      expect.objectContaining({
        body: expect.objectContaining({
          p_action: "restore",
        }),
      })
    );
  });
});
