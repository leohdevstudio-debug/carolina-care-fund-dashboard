import { describe, expect, it } from "vitest";
import { parseCampaignInput } from "@/lib/admin/campaignValidation";

const autoInput = {
  beneficiaryName: "Carolina",
  campaignDescription: "Care support",
  campaignName: "Care campaign",
  endDate: "2026-07-31",
  isActive: true,
  isPublic: true,
  startDate: "2026-06-01",
  targetAdjustmentAmount: 100,
  targetAmount: 999,
  targetAmountMode: "budget_auto",
};

describe("campaign admin validation", () => {
  it("accepts automatic budget target campaigns and ignores manual target amount", () => {
    expect(
      parseCampaignInput({
        ...autoInput,
        campaignName: " Care campaign ",
        campaignDescription: " Care support ",
      })
    ).toEqual({
      beneficiaryName: "Carolina",
      campaignDescription: "Care support",
      campaignName: "Care campaign",
      endDate: "2026-07-31",
      isActive: true,
      isPublic: true,
      startDate: "2026-06-01",
      targetAdjustmentAmount: 100,
      targetAmount: null,
      targetAmountMode: "budget_auto",
    });
  });

  it("accepts manual target campaigns with a positive target amount", () => {
    expect(
      parseCampaignInput({
        ...autoInput,
        targetAdjustmentAmount: 0,
        targetAmount: 1500,
        targetAmountMode: "manual",
      })
    ).toMatchObject({
      targetAdjustmentAmount: 0,
      targetAmount: 1500,
      targetAmountMode: "manual",
    });
  });

  it("rejects automatic campaigns with a negative adjustment amount", () => {
    expect(() =>
      parseCampaignInput({
        ...autoInput,
        targetAdjustmentAmount: -1,
      })
    ).toThrow("Target adjustment cannot be negative");
  });

  it("rejects manual campaigns without a positive target amount", () => {
    expect(() =>
      parseCampaignInput({
        ...autoInput,
        targetAmount: 0,
        targetAmountMode: "manual",
      })
    ).toThrow("Manual target amount must be greater than zero");
  });
});
