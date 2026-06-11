import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/supabaseAdmin", () => ({
  adminFetch: vi.fn(),
}));

vi.mock("@/services/admin/campaignTargets", () => ({
  recalculateCampaignTarget: vi.fn(),
}));

import { adminFetch } from "@/lib/admin/supabaseAdmin";
import { recalculateCampaignTarget } from "@/services/admin/campaignTargets";
import {
  createAdminCampaign,
  listAdminCampaigns,
  restoreAdminCampaign,
  softDeleteAdminCampaign,
  updateAdminCampaign,
} from "@/services/admin/campaigns";

const adminFetchMock = vi.mocked(adminFetch);
const recalculateCampaignTargetMock = vi.mocked(recalculateCampaignTarget);

const campaign = {
  beneficiary_name: "Carolina",
  campaign_description: "Care support",
  campaign_id: 3,
  campaign_name: "Care campaign",
  computed_budget_target_amount: 1100,
  created_at: "2026-06-11T00:00:00.000Z",
  deleted_at: null,
  deleted_by: null,
  deleted_reason: null,
  end_date: "2026-07-31",
  is_active: true,
  is_public: true,
  start_date: "2026-06-01",
  target_adjustment_amount: 100,
  target_amount: 1100,
  target_amount_mode: "budget_auto",
  target_currency_code: "AUD",
  updated_at: "2026-06-11T00:00:00.000Z",
};

const input = {
  beneficiaryName: "Carolina",
  campaignDescription: "Care support",
  campaignName: "Care campaign",
  endDate: "2026-07-31",
  isActive: true,
  isPublic: true,
  startDate: "2026-06-01",
  targetAdjustmentAmount: 100,
  targetAmount: null,
  targetAmountMode: "budget_auto" as const,
};

describe("admin campaign service", () => {
  beforeEach(() => {
    adminFetchMock.mockReset();
    recalculateCampaignTargetMock.mockReset();
    recalculateCampaignTargetMock.mockResolvedValue();
  });

  it("lists active campaigns by default", async () => {
    adminFetchMock.mockResolvedValueOnce([campaign]);

    await expect(listAdminCampaigns()).resolves.toEqual([campaign]);

    expect(adminFetchMock).toHaveBeenCalledWith(
      "v_admin_campaign",
      expect.stringContaining("deleted_at=is.null")
    );
  });

  it("creates an automatic campaign, recalculates target, and writes audit", async () => {
    adminFetchMock
      .mockResolvedValueOnce([{ campaign_id: 3 }])
      .mockResolvedValueOnce([campaign])
      .mockResolvedValueOnce({ audit_id: 1 });

    await expect(createAdminCampaign(input)).resolves.toEqual(campaign);

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      1,
      "campaign",
      "select=campaign_id",
      expect.objectContaining({
        body: expect.objectContaining({
          campaign_name: "Care campaign",
          created_by: "admin",
          target_adjustment_amount: 100,
          target_amount: 100,
          target_amount_mode: "budget_auto",
          target_currency_code: "AUD",
          updated_by: "admin",
        }),
        method: "POST",
        prefer: "return=representation",
      })
    );
    expect(recalculateCampaignTargetMock).toHaveBeenCalledWith(3);
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      3,
      "rpc/admin_insert_audit_log",
      "",
      expect.objectContaining({
        body: expect.objectContaining({
          p_action: "create",
          p_entity_id: "3",
          p_entity_table: "campaign",
        }),
      })
    );
  });

  it("updates a manual campaign target without automatic recalculation", async () => {
    adminFetchMock
      .mockResolvedValueOnce([campaign])
      .mockResolvedValueOnce([{ campaign_id: 3 }])
      .mockResolvedValueOnce([
        {
          ...campaign,
          target_amount: 1500,
          target_amount_mode: "manual",
        },
      ])
      .mockResolvedValueOnce({ audit_id: 1 });

    await updateAdminCampaign(3, {
      ...input,
      targetAdjustmentAmount: 0,
      targetAmount: 1500,
      targetAmountMode: "manual",
    });

    expect(recalculateCampaignTargetMock).not.toHaveBeenCalled();
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      2,
      "campaign",
      "campaign_id=eq.3&select=campaign_id",
      expect.objectContaining({
        body: expect.objectContaining({
          target_adjustment_amount: 0,
          target_amount: 1500,
          target_amount_mode: "manual",
        }),
        method: "PATCH",
        prefer: "return=representation",
      })
    );
  });

  it("soft deletes a campaign and makes it inactive", async () => {
    adminFetchMock
      .mockResolvedValueOnce([campaign])
      .mockResolvedValueOnce([{ campaign_id: 3 }])
      .mockResolvedValueOnce([
        {
          ...campaign,
          deleted_at: "2026-06-11T01:00:00.000Z",
          is_active: false,
        },
      ])
      .mockResolvedValueOnce({ audit_id: 1 });

    await softDeleteAdminCampaign(3, "Closed");

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      2,
      "campaign",
      "campaign_id=eq.3&select=campaign_id",
      expect.objectContaining({
        body: expect.objectContaining({
          deleted_by: "admin",
          deleted_reason: "Closed",
          is_active: false,
        }),
      })
    );
  });

  it("restores a campaign without automatically publishing it", async () => {
    const deleted = {
      ...campaign,
      deleted_at: "2026-06-11T01:00:00.000Z",
      deleted_by: "admin",
      deleted_reason: "Closed",
      is_active: false,
    };
    adminFetchMock
      .mockResolvedValueOnce([deleted])
      .mockResolvedValueOnce([{ campaign_id: 3 }])
      .mockResolvedValueOnce([{ ...deleted, deleted_at: null }])
      .mockResolvedValueOnce({ audit_id: 1 });

    await restoreAdminCampaign(3);

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      2,
      "campaign",
      "campaign_id=eq.3&select=campaign_id",
      expect.objectContaining({
        body: expect.objectContaining({
          deleted_at: null,
          deleted_by: null,
          deleted_reason: null,
          is_active: false,
        }),
      })
    );
  });
});
