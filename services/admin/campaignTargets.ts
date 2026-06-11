import { adminFetch } from "@/lib/admin/supabaseAdmin";

function requireCampaignId(campaignId: number): number {
  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    throw new Error("Campaign id is required");
  }

  return campaignId;
}

export async function recalculateCampaignTarget(
  campaignId: number
): Promise<void> {
  await adminFetch("rpc/recalculate_campaign_target", "", {
    method: "POST",
    body: {
      p_campaign_id: requireCampaignId(campaignId),
    },
  });
}

export async function recalculateCampaignTargets(
  campaignIds: number[]
): Promise<void> {
  const uniqueIds = Array.from(new Set(campaignIds.map(requireCampaignId)));

  for (const campaignId of uniqueIds) {
    await recalculateCampaignTarget(campaignId);
  }
}
