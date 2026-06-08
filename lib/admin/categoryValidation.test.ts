import { describe, expect, it } from "vitest";
import { parseCategoryInput } from "@/lib/admin/categoryValidation";

describe("parseCategoryInput", () => {
  it("accepts valid category payloads and trims text", () => {
    expect(
      parseCategoryInput({
        categoryGroup: " Care ",
        categoryName: " ChildCare ",
      })
    ).toEqual({
      categoryGroup: "Care",
      categoryName: "ChildCare",
    });
  });

  it("rejects blank category names", () => {
    expect(() =>
      parseCategoryInput({
        categoryGroup: "Care",
        categoryName: " ",
      })
    ).toThrow("Category name is required");
  });

  it("rejects blank category groups", () => {
    expect(() =>
      parseCategoryInput({
        categoryGroup: "",
        categoryName: "ChildCare",
      })
    ).toThrow("Category group is required");
  });
});
