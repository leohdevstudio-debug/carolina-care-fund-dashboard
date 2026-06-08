"use client";

import { FormEvent, useMemo, useState } from "react";
import type {
  AdminDonationRow,
  AdminDonationStatus,
} from "@/services/admin/donations";
import type { AdminDonationLookups, AdminDonorOption } from "@/services/admin/lookups";

type Props = {
  initialDonations: AdminDonationRow[];
  initialError?: string;
  initialLookups: AdminDonationLookups;
};

type FormState = {
  campaignId: string;
  donorId: string;
  receivedDate: string;
  originalAmount: string;
  currencyCode: "AUD" | "USD" | "TWD";
  paymentMethod: string;
  transactionReference: string;
  senderNameAsReceived: string;
  senderCountryName: string;
  purposeNote: string;
  isConfirmed: boolean;
  receivedBy: string;
};

const emptyForm: FormState = {
  campaignId: "",
  donorId: "",
  receivedDate: "",
  originalAmount: "",
  currencyCode: "AUD",
  paymentMethod: "",
  transactionReference: "",
  senderNameAsReceived: "",
  senderCountryName: "",
  purposeNote: "",
  isConfirmed: true,
  receivedBy: "admin",
};

function rowToForm(row: AdminDonationRow): FormState {
  return {
    campaignId: String(row.campaign_id),
    donorId: row.donor_id ? String(row.donor_id) : "",
    receivedDate: row.received_date,
    originalAmount: String(row.original_amount),
    currencyCode: row.currency_code,
    paymentMethod: row.payment_method ?? "",
    transactionReference: row.transaction_reference ?? "",
    senderNameAsReceived: row.sender_name_as_received ?? "",
    senderCountryName: row.sender_country_name ?? "",
    purposeNote: row.purpose_note ?? "",
    isConfirmed: row.is_confirmed,
    receivedBy: row.received_by ?? "admin",
  };
}

function donorLabel(donor: AdminDonorOption): string {
  const name =
    donor.display_name?.trim() ||
    [donor.first_name, donor.last_name]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ") ||
    `Donor #${donor.donor_id}`;
  const country = donor.country_name ? ` - ${donor.country_name}` : "";
  const anonymous = donor.is_anonymous_publicly ? " (anonymous public)" : "";

  return `${name}${country}${anonymous} (#${donor.donor_id})`;
}

function donationDisplayName(row: AdminDonationRow): string {
  return (
    row.donor_display_name ||
    row.sender_name_as_received ||
    (row.donor_id ? `Donor #${row.donor_id}` : "Unknown donor")
  );
}

async function readJsonError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return body?.error ?? fallback;
}

export default function DonationsAdminClient({
  initialDonations,
  initialError = "",
  initialLookups,
}: Props) {
  const [donations, setDonations] = useState(initialDonations);
  const [status, setStatus] = useState<AdminDonationStatus>("active");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminDonationRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState(initialError);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mutatingDonationId, setMutatingDonationId] = useState<number | null>(
    null
  );

  const confirmedActiveTotal = useMemo(
    () =>
      donations.reduce(
        (sum, donation) =>
          donation.deleted_at || !donation.is_confirmed
            ? sum
            : sum + Number(donation.base_currency_amount),
        0
      ),
    [donations]
  );

  async function refresh(nextStatus = status, nextSearch = search) {
    setIsRefreshing(true);
    setError("");

    const params = new URLSearchParams({
      status: nextStatus,
      ...(nextSearch ? { search: nextSearch } : {}),
    });
    const response = await fetch(`/api/admin/donations?${params}`);

    setIsRefreshing(false);

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to load donations"));
      return;
    }

    setDonations((await response.json()) as AdminDonationRow[]);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setIsDrawerOpen(true);
  }

  function openEdit(row: AdminDonationRow) {
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
      donorId: Number(form.donorId),
      receivedDate: form.receivedDate,
      originalAmount: Number(form.originalAmount),
      currencyCode: form.currencyCode,
      paymentMethod: form.paymentMethod,
      transactionReference: form.transactionReference,
      senderNameAsReceived: form.senderNameAsReceived,
      senderCountryName: form.senderCountryName,
      purposeNote: form.purposeNote,
      isConfirmed: form.isConfirmed,
      receivedBy: form.receivedBy,
    };
    let response: Response;
    try {
      response = await fetch(
        editing
          ? `/api/admin/donations/${editing.donation_id}`
          : "/api/admin/donations",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
    } catch {
      setIsSaving(false);
      setError("Unable to save donation");
      return;
    }

    setIsSaving(false);

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to save donation"));
      return;
    }

    await refresh();
    closeDrawer({ clearError: false });
  }

  async function softDelete(row: AdminDonationRow) {
    const reason = window.prompt("Reason for soft delete");

    if (!reason) {
      return;
    }

    let response: Response;
    try {
      setMutatingDonationId(row.donation_id);
      response = await fetch(
        `/api/admin/donations/${row.donation_id}/soft-delete`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );
    } catch {
      setError("Unable to delete donation");
      return;
    } finally {
      setMutatingDonationId(null);
    }

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to delete donation"));
      return;
    }

    await refresh();
  }

  async function restore(row: AdminDonationRow) {
    let response: Response;
    try {
      setMutatingDonationId(row.donation_id);
      response = await fetch(`/api/admin/donations/${row.donation_id}/restore`, {
        method: "POST",
      });
    } catch {
      setError("Unable to restore donation");
      return;
    } finally {
      setMutatingDonationId(null);
    }

    if (!response.ok) {
      setError(await readJsonError(response, "Unable to restore donation"));
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
              Donations
            </h1>
            <p className="mt-1 text-sm text-muted">
              Confirmed active total: AUD{" "}
              {confirmedActiveTotal.toLocaleString("en-AU")}
            </p>
          </div>

          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={openCreate}
            type="button"
          >
            New donation
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <input
            aria-label="Search donations"
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm md:w-72"
            onChange={(event) => setSearch(event.target.value)}
            value={search}
          />
          <select
            aria-label="Donation status"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            onChange={async (event) => {
              const nextStatus = event.target.value as AdminDonationStatus;
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
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Donor</th>
                <th className="px-3 py-2">Campaign</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Confirmed</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((row) => (
                <tr
                  className={`border-b border-border last:border-b-0 ${
                    row.deleted_at ? "text-muted" : "text-foreground"
                  }`}
                  key={row.donation_id}
                >
                  <td className="px-3 py-2">{row.received_date}</td>
                  <td className="px-3 py-2">{donationDisplayName(row)}</td>
                  <td className="px-3 py-2">{row.campaign_name}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {row.currency_code}{" "}
                    {Number(row.original_amount).toLocaleString("en-AU")}
                  </td>
                  <td className="px-3 py-2">
                    {row.is_confirmed ? "Yes" : "No"}
                  </td>
                  <td className="px-3 py-2">
                    {row.deleted_at ? "Deleted" : "Active"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="mr-3 text-primary hover:underline disabled:opacity-60"
                      disabled={mutatingDonationId === row.donation_id}
                      onClick={() => openEdit(row)}
                      type="button"
                    >
                      Edit
                    </button>
                    {row.deleted_at ? (
                      <button
                        className="text-primary hover:underline disabled:opacity-60"
                        disabled={mutatingDonationId === row.donation_id}
                        onClick={() => restore(row)}
                        type="button"
                      >
                        {mutatingDonationId === row.donation_id
                          ? "Restoring..."
                          : "Restore"}
                      </button>
                    ) : (
                      <button
                        className="text-danger hover:underline disabled:opacity-60"
                        disabled={mutatingDonationId === row.donation_id}
                        onClick={() => softDelete(row)}
                        type="button"
                      >
                        {mutatingDonationId === row.donation_id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {donations.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted" colSpan={7}>
                    No donations found.
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
            aria-label="Close donation form"
            className="absolute inset-0 cursor-default"
            onClick={() => closeDrawer()}
            type="button"
          />
          <aside className="relative z-10 h-full w-full max-w-md overflow-y-auto border-l border-border bg-surface p-5 shadow-xl">
            <form className="flex flex-col gap-4" onSubmit={submit}>
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-foreground">
                    {editing ? "Edit donation" : "New donation"}
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
                  {initialLookups.campaigns.map((campaign) => (
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
                Donor
                <select
                  className="rounded-md border border-border bg-white px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      donorId: event.target.value,
                    }))
                  }
                  required
                  value={form.donorId}
                >
                  <option value="">Select donor</option>
                  {initialLookups.donors.map((donor) => (
                    <option key={donor.donor_id} value={donor.donor_id}>
                      {donorLabel(donor)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Received date
                <input
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      receivedDate: event.target.value,
                    }))
                  }
                  required
                  type="date"
                  value={form.receivedDate}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
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
                    required
                    type="number"
                    value={form.originalAmount}
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm font-medium">
                  Currency
                  <select
                    className="rounded-md border border-border bg-white px-3 py-2 text-sm"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        currencyCode: event.target.value as
                          | "AUD"
                          | "USD"
                          | "TWD",
                      }))
                    }
                    value={form.currencyCode}
                  >
                    <option value="AUD">AUD</option>
                    <option value="USD">USD</option>
                    <option value="TWD">TWD</option>
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Sender name as received
                <input
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      senderNameAsReceived: event.target.value,
                    }))
                  }
                  value={form.senderNameAsReceived}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Sender country
                <input
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      senderCountryName: event.target.value,
                    }))
                  }
                  value={form.senderCountryName}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Payment method
                <input
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      paymentMethod: event.target.value,
                    }))
                  }
                  value={form.paymentMethod}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Transaction reference
                <input
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      transactionReference: event.target.value,
                    }))
                  }
                  value={form.transactionReference}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Purpose note
                <textarea
                  className="min-h-24 rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      purposeNote: event.target.value,
                    }))
                  }
                  value={form.purposeNote}
                />
              </label>

              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  checked={form.isConfirmed}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isConfirmed: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                Confirmed
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Received by
                <input
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      receivedBy: event.target.value,
                    }))
                  }
                  value={form.receivedBy}
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
