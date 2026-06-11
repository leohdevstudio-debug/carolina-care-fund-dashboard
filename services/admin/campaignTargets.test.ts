import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/supabaseAdmin", () => ({
  adminFetch: vi.fn(),
}));

import { adminFetch } from "@/lib/admin/supabaseAdmin";
import {
  recalculateCampaignTarget,
  recalculateCampaignTargets,
} from "@/services/admin/campaignTargets";

const adminFetchMock = vi.mocked(adminFetch);

describe("campaign target recalculation service", () => {
  beforeEach(() => {
    adminFetchMock.mockReset();
    adminFetchMock.mockResolvedValue({});
  });

  it("calls the campaign target recalculation rpc for one campaign", async () => {
    await recalculateCampaignTarget(7);

    expect(adminFetchMock).toHaveBeenCalledWith(
      "rpc/recalculate_campaign_target",
      "",
      {
        method: "POST",
        body: {
          p_campaign_id: 7,
        },
      }
    );
  });

  it("deduplicates campaign ids before recalculating", async () => {
    await recalculateCampaignTargets([1, 1, 2]);

    expect(adminFetchMock).toHaveBeenCalledTimes(2);
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      1,
      "rpc/recalculate_campaign_target",
      "",
      expect.objectContaining({ body: { p_campaign_id: 1 } })
    );
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      2,
      "rpc/recalculate_campaign_target",
      "",
      expect.objectContaining({ body: { p_campaign_id: 2 } })
    );
  });
});
