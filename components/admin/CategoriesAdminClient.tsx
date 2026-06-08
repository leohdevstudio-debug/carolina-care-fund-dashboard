"use client";

import { FormEvent, useMemo, useState } from "react";
import { buildCategoryGroupOptions } from "@/lib/admin/categoryGroupOptions";
import type {
  AdminCategoryRow,
  AdminCategoryStatus,
} from "@/services/admin/categories";

type Props = {
  initialCategories: AdminCategoryRow[];
  initialError?: string;
};

type FormState = {
  categoryGroup: string;
  categoryName: string;
};

const emptyForm: FormState = {
  categoryGroup: "",
  categoryName: "",
};
const CUSTOM_GROUP_VALUE = "__custom_group__";

function rowToForm(row: AdminCategoryRow): FormState {
  return {
    categoryGroup: row.category_group,
    categoryName: row.category_name,
  };
}

async function readJsonError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return body?.error ?? fallback;
}

export default function CategoriesAdminClient({
  initialCategories,
  initialError = "",
}: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [status, setStatus] = useState<AdminCategoryStatus>("active");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminCategoryRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isCustomGroup, setIsCustomGroup] = useState(false);
  const [error, setError] = useState(initialError);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mutatingCategoryId, setMutatingCategoryId] = useState<number | null>(
    null
  );

  const activeCount = useMemo(
    () =>
      categories.reduce(
        (sum, category) => (category.deleted_at ? sum : sum + 1),
        0
      ),
    [categories]
  );
  const categoryGroupOptions = useMemo(
    () =>
      buildCategoryGroupOptions(
        categories.map((category) => category.category_group),
        editing?.category_group
      ),
    [categories, editing?.category_group]
  );
  const groupSelectValue = isCustomGroup
    ? CUSTOM_GROUP_VALUE
    : form.categoryGroup;

  async function refresh(nextStatus = status, nextSearch = search) {
    setIsRefreshing(true);
    setError("");

    const params = new URLSearchParams({
      status: nextStatus,
      ...(nextSearch ? { search: nextSearch } : {}),
    });
    const response = await fetch(`/api/admin/categories?${params}`);

    setIsRefreshing(false);

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to load categories"));
      return;
    }

    setCategories((await response.json()) as AdminCategoryRow[]);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setIsCustomGroup(false);
    setError("");
    setIsDrawerOpen(true);
  }

  function openEdit(row: AdminCategoryRow) {
    setEditing(row);
    setForm(rowToForm(row));
    setIsCustomGroup(false);
    setError("");
    setIsDrawerOpen(true);
  }

  function closeDrawer({ clearError = true }: { clearError?: boolean } = {}) {
    setIsDrawerOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setIsCustomGroup(false);
    if (clearError) {
      setError("");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    const payload = {
      categoryGroup: form.categoryGroup,
      categoryName: form.categoryName,
    };
    let response: Response;
    try {
      response = await fetch(
        editing
          ? `/api/admin/categories/${editing.expense_category_id}`
          : "/api/admin/categories",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
    } catch {
      setIsSaving(false);
      setError("Unable to save category");
      return;
    }

    setIsSaving(false);

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to save category"));
      return;
    }

    await refresh();
    closeDrawer({ clearError: false });
  }

  async function softDelete(row: AdminCategoryRow) {
    const reason = window.prompt("Reason for soft delete");

    if (!reason) {
      return;
    }

    let response: Response;
    try {
      setMutatingCategoryId(row.expense_category_id);
      response = await fetch(
        `/api/admin/categories/${row.expense_category_id}/soft-delete`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );
    } catch {
      setError("Unable to delete category");
      return;
    } finally {
      setMutatingCategoryId(null);
    }

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to delete category"));
      return;
    }

    await refresh();
  }

  async function restore(row: AdminCategoryRow) {
    let response: Response;
    try {
      setMutatingCategoryId(row.expense_category_id);
      response = await fetch(
        `/api/admin/categories/${row.expense_category_id}/restore`,
        {
          method: "POST",
        }
      );
    } catch {
      setError("Unable to restore category");
      return;
    } finally {
      setMutatingCategoryId(null);
    }

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to restore category"));
      return;
    }

    await refresh();
  }

  return (
    <div className="min-h-[calc(100vh-3rem)]">
      <section className="min-w-0">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-foreground">
              Categories
            </h1>
            <p className="mt-1 text-sm text-muted">
              Active categories: {activeCount.toLocaleString("en-AU")}
            </p>
          </div>

          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={openCreate}
            type="button"
          >
            New category
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <input
            aria-label="Search categories"
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm md:w-72"
            onChange={(event) => setSearch(event.target.value)}
            value={search}
          />
          <select
            aria-label="Category status"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            onChange={async (event) => {
              const nextStatus = event.target.value as AdminCategoryStatus;
              setStatus(nextStatus);
              await refresh(nextStatus);
            }}
            value={status}
          >
            <option value="active">Active</option>
            <option value="deleted">Deleted</option>
            <option value="all">All</option>
          </select>
          <button
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium disabled:opacity-60"
            disabled={isRefreshing}
            onClick={() => refresh()}
            type="button"
          >
            {isRefreshing ? "Loading..." : "Apply"}
          </button>
        </div>

        {error ? (
          <p className="mb-4 rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-border bg-accent-bg text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Group</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((row) => (
                <tr
                  className={`border-b border-border last:border-b-0 ${
                    row.deleted_at ? "text-muted" : "text-foreground"
                  }`}
                  key={row.expense_category_id}
                >
                  <td className="px-3 py-2">{row.category_group}</td>
                  <td className="px-3 py-2">{row.category_name}</td>
                  <td className="px-3 py-2">
                    {row.deleted_at ? "Deleted" : "Active"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="mr-3 text-primary hover:underline disabled:opacity-60"
                      disabled={mutatingCategoryId === row.expense_category_id}
                      onClick={() => openEdit(row)}
                      type="button"
                    >
                      Edit
                    </button>
                    {row.deleted_at ? (
                      <button
                        className="text-primary hover:underline disabled:opacity-60"
                        disabled={
                          mutatingCategoryId === row.expense_category_id
                        }
                        onClick={() => restore(row)}
                        type="button"
                      >
                        {mutatingCategoryId === row.expense_category_id
                          ? "Restoring..."
                          : "Restore"}
                      </button>
                    ) : (
                      <button
                        className="text-danger hover:underline disabled:opacity-60"
                        disabled={
                          mutatingCategoryId === row.expense_category_id
                        }
                        onClick={() => softDelete(row)}
                        type="button"
                      >
                        {mutatingCategoryId === row.expense_category_id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {categories.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted" colSpan={4}>
                    No categories found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {isDrawerOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-end bg-foreground/20"
          role="dialog"
        >
          <button
            aria-label="Close category form"
            className="absolute inset-0 cursor-default"
            onClick={() => closeDrawer()}
            type="button"
          />
          <aside className="relative z-10 h-full w-full max-w-md overflow-y-auto border-l border-border bg-surface p-5 shadow-xl">
            <form className="flex flex-col gap-4" onSubmit={submit}>
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-foreground">
                    {editing ? "Edit category" : "New category"}
                  </h2>
                  <button
                    className="rounded-md border border-border px-3 py-1 text-sm font-medium"
                    onClick={() => closeDrawer()}
                    type="button"
                  >
                    Close
                  </button>
                </div>
                <p className="text-sm text-muted">
                  Deleted categories are hidden from new expense forms.
                </p>
              </div>

              {error ? (
                <p className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              ) : null}

              <label className="flex flex-col gap-1 text-sm font-medium">
                Group
                <select
                  className="rounded-md border border-border bg-white px-3 py-2 text-sm"
                  onChange={(event) => {
                    const value = event.target.value;

                    if (value === CUSTOM_GROUP_VALUE) {
                      setIsCustomGroup(true);
                      setForm((current) => ({
                        ...current,
                        categoryGroup: "",
                      }));
                      return;
                    }

                    setIsCustomGroup(false);
                    setForm((current) => ({
                      ...current,
                      categoryGroup: value,
                    }));
                  }}
                  required
                  value={groupSelectValue}
                >
                  <option value="">Select group</option>
                  {categoryGroupOptions.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                  <option value={CUSTOM_GROUP_VALUE}>New group...</option>
                </select>
              </label>

              {isCustomGroup ? (
                <label className="flex flex-col gap-1 text-sm font-medium">
                  New group name
                  <input
                    className="rounded-md border border-border px-3 py-2 text-sm"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        categoryGroup: event.target.value,
                      }))
                    }
                    required
                    value={form.categoryGroup}
                  />
                </label>
              ) : null}

              <label className="flex flex-col gap-1 text-sm font-medium">
                Name
                <input
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      categoryName: event.target.value,
                    }))
                  }
                  required
                  value={form.categoryName}
                />
              </label>

              <div className="flex gap-2">
                <button
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium"
                  onClick={() => closeDrawer()}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
