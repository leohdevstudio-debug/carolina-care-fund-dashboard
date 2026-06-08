import { describe, expect, it } from "vitest";
import { buildCategoryGroupOptions } from "@/lib/admin/categoryGroupOptions";

describe("buildCategoryGroupOptions", () => {
  it("returns unique trimmed groups sorted by name", () => {
    expect(
      buildCategoryGroupOptions([" Family ", "Other", "Family", "Care"])
    ).toEqual(["Care", "Family", "Other"]);
  });

  it("includes the selected group when it is not in the source list", () => {
    expect(buildCategoryGroupOptions(["Care"], "Family")).toEqual([
      "Care",
      "Family",
    ]);
  });
});
