export type AdminCategoryInput = {
  categoryGroup: string;
  categoryName: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }

  return value.trim();
}

export function parseCategoryInput(value: unknown): AdminCategoryInput {
  if (!isRecord(value)) {
    throw new Error("Category payload is required");
  }

  return {
    categoryGroup: requireString(value.categoryGroup, "Category group"),
    categoryName: requireString(value.categoryName, "Category name"),
  };
}
