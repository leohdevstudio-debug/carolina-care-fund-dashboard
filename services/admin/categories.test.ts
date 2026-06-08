import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/supabaseAdmin", () => ({
  adminFetch: vi.fn(),
}));

import { adminFetch } from "@/lib/admin/supabaseAdmin";
import {
  createAdminCategory,
  listAdminCategories,
  restoreAdminCategory,
  softDeleteAdminCategory,
  updateAdminCategory,
} from "@/services/admin/categories";

const adminFetchMock = vi.mocked(adminFetch);

const category = {
  category_group: "Care",
  category_name: "ChildCare",
  created_at: "2026-06-08T00:00:00.000Z",
  deleted_at: null,
  deleted_by: null,
  deleted_reason: null,
  expense_category_id: 2,
  updated_at: "2026-06-08T00:00:00.000Z",
};

describe("admin category service", () => {
  beforeEach(() => {
    adminFetchMock.mockReset();
  });

  it("lists active categories by default", async () => {
    adminFetchMock.mockResolvedValueOnce([category]);

    await expect(listAdminCategories()).resolves.toEqual([category]);

    expect(adminFetchMock).toHaveBeenCalledWith(
      "v_admin_expense_category",
      expect.stringContaining("deleted_at=is.null")
    );
  });

  it("creates a category and writes audit", async () => {
    adminFetchMock
      .mockResolvedValueOnce([{ expense_category_id: 2 }])
      .mockResolvedValueOnce([category])
      .mockResolvedValueOnce({ audit_id: 1 });

    await expect(
      createAdminCategory({
        categoryGroup: "Care",
        categoryName: "ChildCare",
      })
    ).resolves.toEqual(category);

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      1,
      "expense_category",
      "select=expense_category_id",
      expect.objectContaining({
        body: expect.objectContaining({
          category_group: "Care",
          category_name: "ChildCare",
          created_by: "admin",
          updated_by: "admin",
        }),
        method: "POST",
        prefer: "return=representation",
      })
    );
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      3,
      "rpc/admin_insert_audit_log",
      "",
      expect.objectContaining({
        body: expect.objectContaining({
          p_action: "create",
          p_entity_id: "2",
          p_entity_table: "expense_category",
        }),
      })
    );
  });

  it("updates a category and writes audit", async () => {
    adminFetchMock
      .mockResolvedValueOnce([category])
      .mockResolvedValueOnce([{ expense_category_id: 2 }])
      .mockResolvedValueOnce([{ ...category, category_name: "Medical" }])
      .mockResolvedValueOnce({ audit_id: 1 });

    await updateAdminCategory(2, {
      categoryGroup: "Care",
      categoryName: "Medical",
    });

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      2,
      "expense_category",
      "expense_category_id=eq.2&select=expense_category_id",
      expect.objectContaining({
        body: expect.objectContaining({
          category_group: "Care",
          category_name: "Medical",
          updated_by: "admin",
        }),
        method: "PATCH",
        prefer: "return=representation",
      })
    );
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      4,
      "rpc/admin_insert_audit_log",
      "",
      expect.objectContaining({
        body: expect.objectContaining({
          p_action: "update",
          p_entity_table: "expense_category",
        }),
      })
    );
  });

  it("soft deletes a category with an audit reason", async () => {
    adminFetchMock
      .mockResolvedValueOnce([category])
      .mockResolvedValueOnce([{ expense_category_id: 2 }])
      .mockResolvedValueOnce([{ ...category, deleted_reason: "Duplicate" }])
      .mockResolvedValueOnce({ audit_id: 1 });

    await softDeleteAdminCategory(2, "Duplicate");

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      4,
      "rpc/admin_insert_audit_log",
      "",
      expect.objectContaining({
        body: expect.objectContaining({
          p_action: "soft_delete",
          p_reason: "Duplicate",
        }),
      })
    );
  });

  it("restores a category and writes audit", async () => {
    const deleted = {
      ...category,
      deleted_at: "2026-06-08T01:00:00.000Z",
      deleted_by: "admin",
      deleted_reason: "Duplicate",
    };
    adminFetchMock
      .mockResolvedValueOnce([deleted])
      .mockResolvedValueOnce([{ expense_category_id: 2 }])
      .mockResolvedValueOnce([category])
      .mockResolvedValueOnce({ audit_id: 1 });

    await restoreAdminCategory(2);

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      4,
      "rpc/admin_insert_audit_log",
      "",
      expect.objectContaining({
        body: expect.objectContaining({
          p_action: "restore",
        }),
      })
    );
  });
});
