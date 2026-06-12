import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  fetchFromView: vi.fn(),
}));

import { fetchFromView } from "@/lib/supabase";
import { getPublicExpenses } from "@/services/dashboard";

const fetchFromViewMock = vi.mocked(fetchFromView);

describe("dashboard services", () => {
  beforeEach(() => {
    fetchFromViewMock.mockReset();
    fetchFromViewMock.mockResolvedValue([]);
  });

  it("fetches all public expenses for monthly summaries and exports", async () => {
    await getPublicExpenses();

    expect(fetchFromViewMock).toHaveBeenCalledWith(
      "v_public_expense",
      "select=*&order=expense_date.desc"
    );
  });
});
