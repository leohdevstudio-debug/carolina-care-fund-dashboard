"use client";

import { FormEvent, useMemo, useState } from "react";
import type {
  AdminCampaignRow,
  AdminCampaignStatus,
} from "@/services/admin/campaigns";
import type { CampaignTargetAmountMode } from "@/lib/admin/campaignValidation";

type Props = {
  initialCampaigns: AdminCampaignRow[];
  initialError?: string;
};

type FormState = {
  campaignName: string;
  campaignDescription: string;
  beneficiaryName: string;
  startDate: string;
  endDate: string;
  targetAmountMode: CampaignTargetAmountMode;
  targetAdjustmentAmount: string;
  targetAmount: string;
  isPublic: boolean;
  isActive: boolean;
};

const emptyForm: FormState = {
  beneficiaryName: "",
  campaignDescription: "",
  campaignName: "",
  endDate: "",
  isActive: true,
  isPublic: true,
  startDate: "",
  targetAdjustmentAmount: "0",
  targetAmount: "",
  targetAmountMode: "budget_auto",
};

function rowToForm(row: AdminCampaignRow): FormState {
  return {
    beneficiaryName: row.beneficiary_name,
    campaignDescription: row.campaign_description ?? "",
    campaignName: row.campaign_name,
    endDate: row.end_date ?? "",
    isActive: row.is_active,
    isPublic: row.is_public,
    startDate: row.start_date ?? "",
    targetAdjustmentAmount: String(row.target_adjustment_amount ?? 0),
    targetAmount: String(row.target_amount ?? ""),
    targetAmountMode: row.target_amount_mode,
  };
}

function formatAud(value: number | string | null | undefined): string {
  return `AUD ${Number(value ?? 0).toLocaleString("en-AU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

async function readJsonError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return body?.error ?? fallback;
}

export default function CampaignsAdminClient({
  initialCampaigns,
  initialError = "",
}: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [status, setStatus] = useState<AdminCampaignStatus>("active");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminCampaignRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState(initialError);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mutatingCampaignId, setMutatingCampaignId] = useState<number | null>(
    null
  );

  const activeTargetTotal = useMemo(
    () =>
      campaigns.reduce(
        (sum, campaign) =>
          campaign.deleted_at || !campaign.is_active
            ? sum
            : sum + Number(campaign.target_amount),
        0
      ),
    [campaigns]
  );

  async function refresh(nextStatus = status, nextSearch = search) {
    setIsRefreshing(true);
    setError("");

    const params = new URLSearchParams({
      status: nextStatus,
      ...(nextSearch ? { search: nextSearch } : {}),
    });
    const response = await fetch(`/api/admin/campaigns?${params}`);

    setIsRefreshing(false);

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to load campaigns"));
      return;
    }

    setCampaigns((await response.json()) as AdminCampaignRow[]);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setIsDrawerOpen(true);
  }

  function openEdit(row: AdminCampaignRow) {
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
      beneficiaryName: form.beneficiaryName,
      campaignDescription: form.campaignDescription,
      campaignName: form.campaignName,
      endDate: form.endDate || null,
      isActive: form.isActive,
      isPublic: form.isPublic,
      startDate: form.startDate || null,
      targetAdjustmentAmount: Number(form.targetAdjustmentAmount || 0),
      targetAmount:
        form.targetAmountMode === "manual" ? Number(form.targetAmount) : null,
      targetAmountMode: form.targetAmountMode,
    };
    let response: Response;
    try {
      response = await fetch(
        editing
          ? `/api/admin/campaigns/${editing.campaign_id}`
          : "/api/admin/campaigns",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
    } catch {
      setIsSaving(false);
      setError("Unable to save campaign");
      return;
    }

    setIsSaving(false);

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to save campaign"));
      return;
    }

    await refresh();
    closeDrawer({ clearError: false });
  }

  async function softDelete(row: AdminCampaignRow) {
    const reason = window.prompt("Reason for soft delete");

    if (!reason) {
      return;
    }

    let response: Response;
    try {
      setMutatingCampaignId(row.campaign_id);
      response = await fetch(
        `/api/admin/campaigns/${row.campaign_id}/soft-delete`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );
    } catch {
      setError("Unable to delete campaign");
      return;
    } finally {
      setMutatingCampaignId(null);
    }

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to delete campaign"));
      return;
    }

    await refresh();
  }

  async function restore(row: AdminCampaignRow) {
    let response: Response;
    try {
      setMutatingCampaignId(row.campaign_id);
      response = await fetch(
        `/api/admin/campaigns/${row.campaign_id}/restore`,
        {
          method: "POST",
        }
      );
    } catch {
      setError("Unable to restore campaign");
      return;
    } finally {
      setMutatingCampaignId(null);
    }

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to restore campaign"));
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
              Campaigns
            </h1>
            <p className="mt-1 text-sm text-muted">
              Active target total: {formatAud(activeTargetTotal)}
            </p>
          </div>

          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={openCreate}
            type="button"
          >
            New campaign
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <input
            aria-label="Search campaigns"
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm md:w-72"
            onChange={(event) => setSearch(event.target.value)}
            value={search}
          />
          <select
            aria-label="Campaign status"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            onChange={async (event) => {
              const nextStatus = event.target.value as AdminCampaignStatus;
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
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-border bg-accent-bg text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Campaign</th>
                <th className="px-3 py-2">Beneficiary</th>
                <th className="px-3 py-2">Target mode</th>
                <th className="px-3 py-2 text-right">Budget target</th>
                <th className="px-3 py-2 text-right">Public target</th>
                <th className="px-3 py-2">Public</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((row) => (
                <tr
                  className={`border-b border-border last:border-b-0 ${
                    row.deleted_at ? "text-muted" : "text-foreground"
                  }`}
                  key={row.campaign_id}
                >
                  <td className="px-3 py-2">{row.campaign_name}</td>
                  <td className="px-3 py-2">{row.beneficiary_name}</td>
                  <td className="px-3 py-2">
                    {row.target_amount_mode === "budget_auto"
                      ? "Auto"
                      : "Manual"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatAud(row.computed_budget_target_amount)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatAud(row.target_amount)}
                  </td>
                  <td className="px-3 py-2">
                    {row.is_public ? "Public" : "Private"}
                  </td>
                  <td className="px-3 py-2">
                    {row.is_active ? "Active" : "Inactive"}
                  </td>
                  <td className="px-3 py-2">
                    {row.deleted_at ? "Deleted" : "Available"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="mr-3 text-primary hover:underline disabled:opacity-60"
                      disabled={mutatingCampaignId === row.campaign_id}
                      onClick={() => openEdit(row)}
                      type="button"
                    >
                      Edit
                    </button>
                    {row.deleted_at ? (
                      <button
                        className="text-primary hover:underline disabled:opacity-60"
                        disabled={mutatingCampaignId === row.campaign_id}
                        onClick={() => restore(row)}
                        type="button"
                      >
                        {mutatingCampaignId === row.campaign_id
                          ? "Restoring..."
                          : "Restore"}
                      </button>
                    ) : (
                      <button
                        className="text-danger hover:underline disabled:opacity-60"
                        disabled={mutatingCampaignId === row.campaign_id}
                        onClick={() => softDelete(row)}
                        type="button"
                      >
                        {mutatingCampaignId === row.campaign_id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted" colSpan={9}>
                    No campaigns found.
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
            aria-label="Close campaign form"
            className="absolute inset-0 cursor-default"
            onClick={() => closeDrawer()}
            type="button"
          />
          <aside className="relative z-10 h-full w-full max-w-lg overflow-y-auto border-l border-border bg-surface p-5 shadow-xl">
            <form className="flex flex-col gap-4" onSubmit={submit}>
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-foreground">
                    {editing ? "Edit campaign" : "New campaign"}
                  </h2>
                  <button
                    className="rounded-md border border-border px-3 py-1 text-sm font-medium"
                    onClick={() => closeDrawer()}
                    type="button"
                  >
                    Close
                  </button>
                </div>
              </div>

              {error ? (
                <p className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              ) : null}

              <label className="flex flex-col gap-1 text-sm font-medium">
                Campaign name
                <input
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      campaignName: event.target.value,
                    }))
                  }
                  required
                  value={form.campaignName}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Beneficiary
                <input
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      beneficiaryName: event.target.value,
                    }))
                  }
                  required
                  value={form.beneficiaryName}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Description
                <textarea
                  className="min-h-24 rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      campaignDescription: event.target.value,
                    }))
                  }
                  value={form.campaignDescription}
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Start date
                  <input
                    className="rounded-md border border-border px-3 py-2 text-sm"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }))
                    }
                    type="date"
                    value={form.startDate}
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm font-medium">
                  End date
                  <input
                    className="rounded-md border border-border px-3 py-2 text-sm"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        endDate: event.target.value,
                      }))
                    }
                    type="date"
                    value={form.endDate}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Target mode
                <select
                  className="rounded-md border border-border bg-white px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      targetAmountMode: event.target
                        .value as CampaignTargetAmountMode,
                    }))
                  }
                  value={form.targetAmountMode}
                >
                  <option value="budget_auto">Auto from budgets</option>
                  <option value="manual">Manual</option>
                </select>
              </label>

              {form.targetAmountMode === "budget_auto" ? (
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Target adjustment
                  <input
                    className="rounded-md border border-border px-3 py-2 text-sm"
                    min="0"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        targetAdjustmentAmount: event.target.value,
                      }))
                    }
                    required
                    step="0.01"
                    type="number"
                    value={form.targetAdjustmentAmount}
                  />
                </label>
              ) : (
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Target amount
                  <input
                    className="rounded-md border border-border px-3 py-2 text-sm"
                    min="0"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        targetAmount: event.target.value,
                      }))
                    }
                    required
                    step="0.01"
                    type="number"
                    value={form.targetAmount}
                  />
                </label>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex items-start gap-2 text-sm font-medium">
                  <input
                    checked={form.isPublic}
                    className="mt-1"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        isPublic: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  Public
                </label>

                <label className="flex items-start gap-2 text-sm font-medium">
                  <input
                    checked={form.isActive}
                    className="mt-1"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  Active
                </label>
              </div>

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
