import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/supabaseAdmin", () => ({
  adminFetch: vi.fn(),
}));

import { adminFetch } from "@/lib/admin/supabaseAdmin";
import {
  listAdminDonationLookups,
  listAdminExpenseLookups,
} from "@/services/admin/lookups";

const adminFetchMock = vi.mocked(adminFetch);

describe("admin lookup service", () => {
  beforeEach(() => {
    adminFetchMock.mockReset();
  });

  it("loads campaign and expense category options for expense forms", async () => {
    const campaigns = [
      {
        campaign_id: 1,
        campaign_name: "Carolina care",
        is_active: true,
      },
    ];
    const categories = [
      {
        category_group: "Care",
        category_name: "ChildCare",
        expense_category_id: 2,
      },
    ];

    adminFetchMock
      .mockResolvedValueOnce(campaigns)
      .mockResolvedValueOnce(categories);

    await expect(listAdminExpenseLookups()).resolves.toEqual({
      campaigns,
      categories,
    });

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      1,
      "campaign",
      "select=campaign_id%2Ccampaign_name%2Cis_active&order=campaign_name.asc"
    );
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      2,
      "v_admin_expense_category",
      "select=expense_category_id%2Ccategory_name%2Ccategory_group&deleted_at=is.null&order=category_group.asc%2Ccategory_name.asc"
    );
  });

  it("loads campaign and donor options for donation forms", async () => {
    const campaigns = [
      {
        campaign_id: 1,
        campaign_name: "Carolina care",
        is_active: true,
      },
    ];
    const donors = [
      {
        country_name: "Australia",
        display_name: "Jane Donor",
        donor_id: 3,
        first_name: "Jane",
        is_anonymous_publicly: false,
        last_name: "Donor",
      },
    ];

    adminFetchMock.mockResolvedValueOnce(campaigns).mockResolvedValueOnce(donors);

    await expect(listAdminDonationLookups()).resolves.toEqual({
      campaigns,
      donors,
    });

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      1,
      "campaign",
      "select=campaign_id%2Ccampaign_name%2Cis_active&order=campaign_name.asc"
    );
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      2,
      "donor",
      "select=donor_id%2Cdisplay_name%2Cfirst_name%2Clast_name%2Ccountry_name%2Cis_anonymous_publicly&order=display_name.asc"
    );
  });
});
