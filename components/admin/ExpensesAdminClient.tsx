"use client";

import { FormEvent, useMemo, useState } from "react";
import type {
  AdminExpenseRow,
  AdminExpenseStatus,
} from "@/services/admin/expenses";
import type { AdminExpenseLookups } from "@/services/admin/lookups";

type Props = {
  initialError?: string;
  initialExpenses: AdminExpenseRow[];
  initialLookups: AdminExpenseLookups;
};

type FormState = {
  campaignId: string;
  expenseDate: string;
  expenseCategoryId: string;
  expenseDescription: string;
  originalAmount: string;
  currencyCode: "AUD" | "USD" | "TWD";
};

const emptyForm: FormState = {
  campaignId: "",
  expenseDate: "",
  expenseCategoryId: "",
  expenseDescription: "",
  originalAmount: "",
  currencyCode: "AUD",
};

function rowToForm(row: AdminExpenseRow): FormState {
  return {
    campaignId: String(row.campaign_id),
    expenseDate: row.expense_date,
    expenseCategoryId: String(row.expense_category_id),
    expenseDescription: row.expense_description,
    originalAmount: String(row.original_amount),
    currencyCode: row.currency_code,
  };
}

async function readJsonError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return body?.error ?? fallback;
}

export default function ExpensesAdminClient({
  initialError = "",
  initialExpenses,
  initialLookups,
}: Props) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [status, setStatus] = useState<AdminExpenseStatus>("active");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminExpenseRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState(initialError);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mutatingExpenseId, setMutatingExpenseId] = useState<number | null>(
    null
  );

  const activeTotal = useMemo(
    () =>
      expenses.reduce(
        (sum, expense) =>
          expense.deleted_at
            ? sum
            : sum + Number(expense.base_currency_amount),
        0
      ),
    [expenses]
  );
  const campaignOptions = initialLookups.campaigns;
  const categoryOptions = initialLookups.categories;

  async function refresh(nextStatus = status, nextSearch = search) {
    setIsRefreshing(true);
    setError("");

    const params = new URLSearchParams({
      status: nextStatus,
      ...(nextSearch ? { search: nextSearch } : {}),
    });
    const response = await fetch(`/api/admin/expenses?${params}`);

    setIsRefreshing(false);

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to load expenses"));
      return;
    }

    setExpenses((await response.json()) as AdminExpenseRow[]);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setIsDrawerOpen(true);
  }

  function openEdit(row: AdminExpenseRow) {
    setEditing(row);
    setForm(rowToForm(row));
    setError("");
    setIsDrawerOpen(true);
  }

  function closeDrawer({ clearError = true }: { clearError?: boolean } = {}) {
    setIsDrawerOpen(false);
    setEditing(null);
    setForm(emptyForm);
    if (clearError) {
      setError("");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    const payload = {
      campaignId: Number(form.campaignId),
      currencyCode: form.currencyCode,
      expenseCategoryId: Number(form.expenseCategoryId),
      expenseDate: form.expenseDate,
      expenseDescription: form.expenseDescription,
      originalAmount: Number(form.originalAmount),
    };
    let response: Response;
    try {
      response = await fetch(
        editing
          ? `/api/admin/expenses/${editing.expense_id}`
          : "/api/admin/expenses",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
    } catch {
      setIsSaving(false);
      setError("Unable to save expense");
      return;
    }

    setIsSaving(false);

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to save expense"));
      return;
    }

    await refresh();
    closeDrawer({ clearError: false });
  }

  async function softDelete(row: AdminExpenseRow) {
    const reason = window.prompt("Reason for soft delete");

    if (!reason) {
      return;
    }

    let response: Response;
    try {
      setMutatingExpenseId(row.expense_id);
      response = await fetch(
        `/api/admin/expenses/${row.expense_id}/soft-delete`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );
    } catch {
      setError("Unable to delete expense");
      return;
    } finally {
      setMutatingExpenseId(null);
    }

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to delete expense"));
      return;
    }

    await refresh();
  }

  async function restore(row: AdminExpenseRow) {
    let response: Response;
    try {
      setMutatingExpenseId(row.expense_id);
      response = await fetch(
        `/api/admin/expenses/${row.expense_id}/restore`,
        {
          method: "POST",
        }
      );
    } catch {
      setError("Unable to restore expense");
      return;
    } finally {
      setMutatingExpenseId(null);
    }

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to restore expense"));
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
              Expenses
            </h1>
            <p className="mt-1 text-sm text-muted">
              Active total: AUD {activeTotal.toLocaleString("en-AU")}
            </p>
          </div>

          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={openCreate}
            type="button"
          >
            New expense
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <input
            aria-label="Search expenses"
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm md:w-72"
            onChange={(event) => setSearch(event.target.value)}
            value={search}
          />
          <select
            aria-label="Expense status"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            onChange={async (event) => {
              const nextStatus = event.target.value as AdminExpenseStatus;
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
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border bg-accent-bg text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((row) => (
                <tr
                  className={`border-b border-border last:border-b-0 ${
                    row.deleted_at ? "text-muted" : "text-foreground"
                  }`}
                  key={row.expense_id}
                >
                  <td className="px-3 py-2">{row.expense_date}</td>
                  <td className="max-w-xs truncate px-3 py-2">
                    {row.expense_description}
                  </td>
                  <td className="px-3 py-2">{row.category_name}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {row.currency_code}{" "}
                    {Number(row.original_amount).toLocaleString("en-AU")}
                  </td>
                  <td className="px-3 py-2">
                    {row.deleted_at ? "Deleted" : "Active"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="mr-3 text-primary hover:underline disabled:opacity-60"
                      disabled={mutatingExpenseId === row.expense_id}
                      onClick={() => openEdit(row)}
                      type="button"
                    >
                      Edit
                    </button>
                    {row.deleted_at ? (
                      <button
                        className="text-primary hover:underline disabled:opacity-60"
                        disabled={mutatingExpenseId === row.expense_id}
                        onClick={() => restore(row)}
                        type="button"
                      >
                        {mutatingExpenseId === row.expense_id
                          ? "Restoring..."
                          : "Restore"}
                      </button>
                    ) : (
                      <button
                        className="text-danger hover:underline disabled:opacity-60"
                        disabled={mutatingExpenseId === row.expense_id}
                        onClick={() => softDelete(row)}
                        type="button"
                      >
                        {mutatingExpenseId === row.expense_id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {expenses.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted" colSpan={6}>
                    No expenses found.
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
            aria-label="Close expense form"
            className="absolute inset-0 cursor-default"
            onClick={() => closeDrawer()}
            type="button"
          />
          <aside className="relative z-10 h-full w-full max-w-md overflow-y-auto border-l border-border bg-surface p-5 shadow-xl">
            <form className="flex flex-col gap-4" onSubmit={submit}>
            <div>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  {editing ? "Edit expense" : "New expense"}
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
                Amount changes refresh the stored FX snapshot.
              </p>
            </div>

            {error ? (
              <p className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}

            <label className="flex flex-col gap-1 text-sm font-medium">
              Campaign
              <select
                className="rounded-md border border-border bg-white px-3 py-2 text-sm"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    campaignId: event.target.value,
                  }))
                }
                required
                value={form.campaignId}
              >
                <option value="">Select campaign</option>
                {campaignOptions.map((campaign) => (
                  <option
                    key={campaign.campaign_id}
                    value={campaign.campaign_id}
                  >
                    {campaign.campaign_name}
                    {campaign.is_active ? "" : " (inactive)"} (#
                    {campaign.campaign_id})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Date
              <input
                className="rounded-md border border-border px-3 py-2 text-sm"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expenseDate: event.target.value,
                  }))
                }
                type="date"
                value={form.expenseDate}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Category
              <select
                className="rounded-md border border-border bg-white px-3 py-2 text-sm"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expenseCategoryId: event.target.value,
                  }))
                }
                required
                value={form.expenseCategoryId}
              >
                <option value="">Select category</option>
                {categoryOptions.map((category) => (
                  <option
                    key={category.expense_category_id}
                    value={category.expense_category_id}
                  >
                    {category.category_group} - {category.category_name} (#
                    {category.expense_category_id})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Description
              <input
                className="rounded-md border border-border px-3 py-2 text-sm"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expenseDescription: event.target.value,
                  }))
                }
                value={form.expenseDescription}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Amount
              <input
                className="rounded-md border border-border px-3 py-2 text-sm"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    originalAmount: event.target.value,
                  }))
                }
                type="number"
                value={form.originalAmount}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Currency
              <select
                className="rounded-md border border-border px-3 py-2 text-sm"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    currencyCode: event.target.value as "AUD" | "USD" | "TWD",
                  }))
                }
                value={form.currencyCode}
              >
                <option value="AUD">AUD</option>
                <option value="USD">USD</option>
                <option value="TWD">TWD</option>
              </select>
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
