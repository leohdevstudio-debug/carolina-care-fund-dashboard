import { adminFetch } from "@/lib/admin/supabaseAdmin";
import type { AdminCategoryInput } from "@/lib/admin/categoryValidation";

export type AdminCategoryStatus = "active" | "deleted" | "all";

export type AdminCategoryRow = {
  expense_category_id: number;
  category_name: string;
  category_group: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_reason: string | null;
  deleted_by: string | null;
};

type CategoryListFilters = {
  status?: AdminCategoryStatus;
  search?: string;
};

type AuditAction = "create" | "update" | "soft_delete" | "restore";

function statusFilter(status: AdminCategoryStatus | undefined): string {
  if (status === "deleted") {
    return "not.is.null";
  }

  if (status === "all") {
    return "";
  }

  return "is.null";
}

function sanitizeSearch(value: string): string {
  return value.trim().replace(/[(),*]/g, " ");
}

function buildListQuery(filters: CategoryListFilters): string {
  const query = new URLSearchParams();
  query.set("select", "*");
  query.set("order", "category_group.asc,category_name.asc");
  query.set("limit", "100");

  const status = statusFilter(filters.status);
  if (status) {
    query.set("deleted_at", status);
  }

  if (filters.search?.trim()) {
    const search = sanitizeSearch(filters.search);
    query.set(
      "or",
      `(category_name.ilike.*${search}*,category_group.ilike.*${search}*)`
    );
  }

  return query.toString();
}

function byIdQuery(categoryId: number): string {
  return `select=*&expense_category_id=eq.${categoryId}&limit=1`;
}

function requireRow(
  rows: AdminCategoryRow[],
  message: string
): AdminCategoryRow {
  const row = rows[0];

  if (!row) {
    throw new Error(message);
  }

  return row;
}

async function fetchCategory(
  categoryId: number,
  message: string
): Promise<AdminCategoryRow> {
  return requireRow(
    await adminFetch<AdminCategoryRow[]>(
      "v_admin_expense_category",
      byIdQuery(categoryId)
    ),
    message
  );
}

async function writeAudit(
  entityId: string,
  action: AuditAction,
  oldData: unknown,
  newData: unknown,
  reason?: string
): Promise<void> {
  await adminFetch("rpc/admin_insert_audit_log", "", {
    method: "POST",
    body: {
      p_action: action,
      p_entity_id: entityId,
      p_entity_table: "expense_category",
      p_new_data: newData,
      p_old_data: oldData,
      p_reason: reason ?? null,
    },
  });
}

export async function listAdminCategories(
  filters: CategoryListFilters = {}
): Promise<AdminCategoryRow[]> {
  return adminFetch<AdminCategoryRow[]>(
    "v_admin_expense_category",
    buildListQuery(filters)
  );
}

export async function createAdminCategory(
  input: AdminCategoryInput
): Promise<AdminCategoryRow> {
  const insertedRows = await adminFetch<Array<{ expense_category_id: number }>>(
    "expense_category",
    "select=expense_category_id",
    {
      method: "POST",
      prefer: "return=representation",
      body: {
        category_group: input.categoryGroup,
        category_name: input.categoryName,
        created_by: "admin",
        updated_by: "admin",
      },
    }
  );
  const inserted = insertedRows[0];
  if (!inserted) {
    throw new Error("Category was not created");
  }

  const row = await fetchCategory(
    inserted.expense_category_id,
    "Category was not created"
  );

  await writeAudit(String(row.expense_category_id), "create", null, row);

  return row;
}

export async function updateAdminCategory(
  categoryId: number,
  input: AdminCategoryInput
): Promise<AdminCategoryRow> {
  const previous = await fetchCategory(categoryId, "Category was not found");
  const updatedRows = await adminFetch<Array<{ expense_category_id: number }>>(
    "expense_category",
    `expense_category_id=eq.${categoryId}&select=expense_category_id`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        category_group: input.categoryGroup,
        category_name: input.categoryName,
        updated_by: "admin",
        updated_on: new Date().toISOString(),
      },
    }
  );
  if (!updatedRows[0]) {
    throw new Error("Category was not updated");
  }

  const row = await fetchCategory(categoryId, "Category was not updated");

  await writeAudit(String(categoryId), "update", previous, row);

  return row;
}

export async function softDeleteAdminCategory(
  categoryId: number,
  reason: string
): Promise<AdminCategoryRow> {
  const previous = await fetchCategory(categoryId, "Category was not found");
  const deletedAt = new Date().toISOString();
  const updatedRows = await adminFetch<Array<{ expense_category_id: number }>>(
    "expense_category",
    `expense_category_id=eq.${categoryId}&select=expense_category_id`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        deleted_at: deletedAt,
        deleted_by: "admin",
        deleted_reason: reason,
        updated_by: "admin",
        updated_on: deletedAt,
      },
    }
  );
  if (!updatedRows[0]) {
    throw new Error("Category was not deleted");
  }

  const row = await fetchCategory(categoryId, "Category was not deleted");

  await writeAudit(String(categoryId), "soft_delete", previous, row, reason);

  return row;
}

export async function restoreAdminCategory(
  categoryId: number
): Promise<AdminCategoryRow> {
  const previous = await fetchCategory(categoryId, "Category was not found");
  const updatedRows = await adminFetch<Array<{ expense_category_id: number }>>(
    "expense_category",
    `expense_category_id=eq.${categoryId}&select=expense_category_id`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        deleted_at: null,
        deleted_by: null,
        deleted_reason: null,
        updated_by: "admin",
        updated_on: new Date().toISOString(),
      },
    }
  );
  if (!updatedRows[0]) {
    throw new Error("Category was not restored");
  }

  const row = await fetchCategory(categoryId, "Category was not restored");

  await writeAudit(String(categoryId), "restore", previous, row);

  return row;
}
