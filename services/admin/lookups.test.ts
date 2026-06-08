import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/supabaseAdmin", () => ({
  adminFetch: vi.fn(),
}));

import { adminFetch } from "@/lib/admin/supabaseAdmin";
import { listAdminExpenseLookups } from "@/services/admin/lookups";

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
});
