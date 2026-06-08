"use client";

import { FormEvent, useMemo, useState } from "react";
import type { AdminDonorRow, AdminDonorStatus } from "@/services/admin/donors";

type Props = {
  initialDonors: AdminDonorRow[];
  initialError?: string;
};

type FormState = {
  donorType: string;
  displayName: string;
  firstName: string;
  lastName: string;
  countryName: string;
  emailAddress: string;
  phoneNumber: string;
  isAnonymousPublicly: boolean;
  notes: string;
};

const DEFAULT_DONOR_TYPES = ["Individual", "Organization", "Family", "Other"];

const emptyForm: FormState = {
  donorType: "Individual",
  displayName: "",
  firstName: "",
  lastName: "",
  countryName: "",
  emailAddress: "",
  phoneNumber: "",
  isAnonymousPublicly: false,
  notes: "",
};

function rowToForm(row: AdminDonorRow): FormState {
  return {
    donorType: row.donor_type,
    displayName: row.display_name ?? "",
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    countryName: row.country_name ?? "",
    emailAddress: row.email_address ?? "",
    phoneNumber: row.phone_number ?? "",
    isAnonymousPublicly: row.is_anonymous_publicly,
    notes: row.notes ?? "",
  };
}

function displayName(row: AdminDonorRow): string {
  return (
    row.display_name ||
    [row.first_name, row.last_name].filter(Boolean).join(" ") ||
    `Donor #${row.donor_id}`
  );
}

function buildDonorTypeOptions(
  donors: AdminDonorRow[],
  currentValue?: string
): string[] {
  const values = new Set(DEFAULT_DONOR_TYPES);

  donors.forEach((donor) => {
    if (donor.donor_type) {
      values.add(donor.donor_type);
    }
  });

  if (currentValue) {
    values.add(currentValue);
  }

  return Array.from(values);
}

async function readJsonError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return body?.error ?? fallback;
}

export default function DonorsAdminClient({
  initialDonors,
  initialError = "",
}: Props) {
  const [donors, setDonors] = useState(initialDonors);
  const [status, setStatus] = useState<AdminDonorStatus>("active");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminDonorRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState(initialError);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mutatingDonorId, setMutatingDonorId] = useState<number | null>(null);

  const activeCount = useMemo(
    () => donors.reduce((sum, donor) => (donor.deleted_at ? sum : sum + 1), 0),
    [donors]
  );
  const donorTypeOptions = useMemo(
    () => buildDonorTypeOptions(donors, editing?.donor_type),
    [donors, editing?.donor_type]
  );

  async function refresh(nextStatus = status, nextSearch = search) {
    setIsRefreshing(true);
    setError("");

    const params = new URLSearchParams({
      status: nextStatus,
      ...(nextSearch ? { search: nextSearch } : {}),
    });
    const response = await fetch(`/api/admin/donors?${params}`);

    setIsRefreshing(false);

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to load donors"));
      return;
    }

    setDonors((await response.json()) as AdminDonorRow[]);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setIsDrawerOpen(true);
  }

  function openEdit(row: AdminDonorRow) {
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
      donorType: form.donorType,
      displayName: form.displayName,
      firstName: form.firstName,
      lastName: form.lastName,
      countryName: form.countryName,
      emailAddress: form.emailAddress,
      phoneNumber: form.phoneNumber,
      isAnonymousPublicly: form.isAnonymousPublicly,
      notes: form.notes,
    };
    let response: Response;
    try {
      response = await fetch(
        editing ? `/api/admin/donors/${editing.donor_id}` : "/api/admin/donors",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
    } catch {
      setIsSaving(false);
      setError("Unable to save donor");
      return;
    }

    setIsSaving(false);

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to save donor"));
      return;
    }

    await refresh();
    closeDrawer({ clearError: false });
  }

  async function softDelete(row: AdminDonorRow) {
    const reason = window.prompt("Reason for soft delete");

    if (!reason) {
      return;
    }

    let response: Response;
    try {
      setMutatingDonorId(row.donor_id);
      response = await fetch(`/api/admin/donors/${row.donor_id}/soft-delete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
    } catch {
      setError("Unable to delete donor");
      return;
    } finally {
      setMutatingDonorId(null);
    }

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to delete donor"));
      return;
    }

    await refresh();
  }

  async function restore(row: AdminDonorRow) {
    let response: Response;
    try {
      setMutatingDonorId(row.donor_id);
      response = await fetch(`/api/admin/donors/${row.donor_id}/restore`, {
        method: "POST",
      });
    } catch {
      setError("Unable to restore donor");
      return;
    } finally {
      setMutatingDonorId(null);
    }

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to restore donor"));
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
              Donors
            </h1>
            <p className="mt-1 text-sm text-muted">
              Active donors: {activeCount.toLocaleString("en-AU")}
            </p>
          </div>

          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={openCreate}
            type="button"
          >
            New donor
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <input
            aria-label="Search donors"
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm md:w-72"
            onChange={(event) => setSearch(event.target.value)}
            value={search}
          />
          <select
            aria-label="Donor status"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            onChange={async (event) => {
              const nextStatus = event.target.value as AdminDonorStatus;
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
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-accent-bg text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Display name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Public</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {donors.map((row) => (
                <tr
                  className={`border-b border-border last:border-b-0 ${
                    row.deleted_at ? "text-muted" : "text-foreground"
                  }`}
                  key={row.donor_id}
                >
                  <td className="px-3 py-2">{displayName(row)}</td>
                  <td className="px-3 py-2">{row.donor_type}</td>
                  <td className="px-3 py-2">{row.country_name ?? "-"}</td>
                  <td className="px-3 py-2">{row.email_address ?? "-"}</td>
                  <td className="px-3 py-2">
                    {row.is_anonymous_publicly ? "Anonymous" : "Named"}
                  </td>
                  <td className="px-3 py-2">
                    {row.deleted_at ? "Deleted" : "Active"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="mr-3 text-primary hover:underline disabled:opacity-60"
                      disabled={mutatingDonorId === row.donor_id}
                      onClick={() => openEdit(row)}
                      type="button"
                    >
                      Edit
                    </button>
                    {row.deleted_at ? (
                      <button
                        className="text-primary hover:underline disabled:opacity-60"
                        disabled={mutatingDonorId === row.donor_id}
                        onClick={() => restore(row)}
                        type="button"
                      >
                        {mutatingDonorId === row.donor_id
                          ? "Restoring..."
                          : "Restore"}
                      </button>
                    ) : (
                      <button
                        className="text-danger hover:underline disabled:opacity-60"
                        disabled={mutatingDonorId === row.donor_id}
                        onClick={() => softDelete(row)}
                        type="button"
                      >
                        {mutatingDonorId === row.donor_id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {donors.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted" colSpan={7}>
                    No donors found.
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
            aria-label="Close donor form"
            className="absolute inset-0 cursor-default"
            onClick={() => closeDrawer()}
            type="button"
          />
          <aside className="relative z-10 h-full w-full max-w-md overflow-y-auto border-l border-border bg-surface p-5 shadow-xl">
            <form className="flex flex-col gap-4" onSubmit={submit}>
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-foreground">
                    {editing ? "Edit donor" : "New donor"}
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
                  Deleted donors are hidden from new donation forms.
                </p>
              </div>

              {error ? (
                <p className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              ) : null}

              <label className="flex flex-col gap-1 text-sm font-medium">
                Type
                <select
                  className="rounded-md border border-border bg-white px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      donorType: event.target.value,
                    }))
                  }
                  required
                  value={form.donorType}
                >
                  {donorTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Display name
                <input
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                  required
                  value={form.displayName}
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-medium">
                  First name
                  <input
                    className="rounded-md border border-border px-3 py-2 text-sm"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                    value={form.firstName}
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm font-medium">
                  Last name
                  <input
                    className="rounded-md border border-border px-3 py-2 text-sm"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                    value={form.lastName}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Country
                <input
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      countryName: event.target.value,
                    }))
                  }
                  value={form.countryName}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Email
                <input
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      emailAddress: event.target.value,
                    }))
                  }
                  type="email"
                  value={form.emailAddress}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Phone
                <input
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phoneNumber: event.target.value,
                    }))
                  }
                  value={form.phoneNumber}
                />
              </label>

              <label className="flex items-start gap-2 text-sm font-medium">
                <input
                  checked={form.isAnonymousPublicly}
                  className="mt-1"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isAnonymousPublicly: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                Show this donor as anonymous on public pages
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Notes
                <textarea
                  className="min-h-24 rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  value={form.notes}
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
