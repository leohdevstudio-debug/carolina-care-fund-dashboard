import type { DisplayCurrency } from "@/lib/currency";
import { getCurrentExchangeRates } from "@/lib/exchangeRates";
import { adminFetch } from "@/lib/admin/supabaseAdmin";
import type { AdminDonationInput } from "@/lib/admin/donationValidation";

export type AdminDonationStatus = "active" | "deleted" | "all";

export type AdminDonationRow = {
  donation_id: number;
  campaign_id: number;
  campaign_name: string;
  donor_id: number | null;
  donor_display_name: string | null;
  is_anonymous_publicly: boolean | null;
  received_date: string;
  original_amount: number;
  currency_code: DisplayCurrency;
  exchange_rate_to_base: number | null;
  base_currency_amount: number;
  aud_to_usd_rate: number | null;
  aud_to_twd_rate: number | null;
  exchange_rate_date: string | null;
  exchange_rate_source: string | null;
  exchange_rate_fetched_at: string | null;
  payment_method: string | null;
  transaction_reference: string | null;
  sender_name_as_received: string | null;
  sender_country_name: string | null;
  purpose_note: string | null;
  is_confirmed: boolean;
  received_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_reason: string | null;
  deleted_by: string | null;
};

type DonationListFilters = {
  status?: AdminDonationStatus;
  search?: string;
};

type AuditAction = "create" | "update" | "soft_delete" | "restore";

function statusFilter(status: AdminDonationStatus | undefined): string {
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

function buildListQuery(filters: DonationListFilters): string {
  const query = new URLSearchParams();
  query.set("select", "*");
  query.set("order", "received_date.desc");
  query.set("limit", "100");

  const status = statusFilter(filters.status);
  if (status) {
    query.set("deleted_at", status);
  }

  if (filters.search?.trim()) {
    const search = sanitizeSearch(filters.search);
    query.set(
      "or",
      `(donor_display_name.ilike.*${search}*,sender_name_as_received.ilike.*${search}*,transaction_reference.ilike.*${search}*,campaign_name.ilike.*${search}*)`
    );
  }

  return query.toString();
}

function byIdQuery(donationId: number): string {
  return `select=*&donation_id=eq.${donationId}&limit=1`;
}

function calculateBaseCurrencyAmount(
  amount: number,
  currency: DisplayCurrency,
  rates: Record<DisplayCurrency, number>
): number {
  const rate = rates[currency];

  if (!rate || rate <= 0) {
    throw new Error(`Missing exchange rate for ${currency}`);
  }

  return Number((amount / rate).toFixed(2));
}

function calculateExchangeRateToBase(
  currency: DisplayCurrency,
  rates: Record<DisplayCurrency, number>
): number {
  const rate = rates[currency];

  if (!rate || rate <= 0) {
    throw new Error(`Missing exchange rate for ${currency}`);
  }

  return Number((1 / rate).toFixed(8));
}

function requireRow(
  rows: AdminDonationRow[],
  message: string
): AdminDonationRow {
  const row = rows[0];

  if (!row) {
    throw new Error(message);
  }

  return row;
}

async function fetchDonation(
  donationId: number,
  message: string
): Promise<AdminDonationRow> {
  return requireRow(
    await adminFetch<AdminDonationRow[]>("v_admin_donation", byIdQuery(donationId)),
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
      p_entity_table: "donation",
      p_new_data: newData,
      p_old_data: oldData,
      p_reason: reason ?? null,
    },
  });
}

function donationBody(input: AdminDonationInput) {
  return {
    campaign_id: input.campaignId,
    donor_id: input.donorId,
    received_date: input.receivedDate,
    original_amount: input.originalAmount,
    currency_code: input.currencyCode,
    payment_method: input.paymentMethod,
    transaction_reference: input.transactionReference,
    sender_name_as_received: input.senderNameAsReceived,
    sender_country_name: input.senderCountryName,
    purpose_note: input.purposeNote,
    is_confirmed: input.isConfirmed,
    received_by: input.receivedBy,
    updated_by: "admin",
  };
}

export async function listAdminDonations(
  filters: DonationListFilters = {}
): Promise<AdminDonationRow[]> {
  return adminFetch<AdminDonationRow[]>("v_admin_donation", buildListQuery(filters));
}

export async function createAdminDonation(
  input: AdminDonationInput
): Promise<AdminDonationRow> {
  const rates = await getCurrentExchangeRates();
  const insertedRows = await adminFetch<Array<{ donation_id: number }>>(
    "donation",
    "select=donation_id",
    {
      method: "POST",
      prefer: "return=representation",
      body: {
        ...donationBody(input),
        aud_to_twd_rate: rates.rates.TWD,
        aud_to_usd_rate: rates.rates.USD,
        base_currency_amount: calculateBaseCurrencyAmount(
          input.originalAmount,
          input.currencyCode,
          rates.rates
        ),
        created_by: "admin",
        exchange_rate_date: input.receivedDate,
        exchange_rate_fetched_at: rates.fetchedAt,
        exchange_rate_source: rates.source,
        exchange_rate_to_base: calculateExchangeRateToBase(
          input.currencyCode,
          rates.rates
        ),
      },
    }
  );
  const inserted = insertedRows[0];
  if (!inserted) {
    throw new Error("Donation was not created");
  }

  const row = await fetchDonation(inserted.donation_id, "Donation was not created");

  await writeAudit(String(row.donation_id), "create", null, row);

  return row;
}

export async function updateAdminDonation(
  donationId: number,
  input: AdminDonationInput
): Promise<AdminDonationRow> {
  const previous = await fetchDonation(donationId, "Donation was not found");
  const needsRateSnapshot =
    previous.received_date !== input.receivedDate ||
    previous.original_amount !== input.originalAmount ||
    previous.currency_code !== input.currencyCode;
  const rates = needsRateSnapshot ? await getCurrentExchangeRates() : null;
  const updatedRows = await adminFetch<Array<{ donation_id: number }>>(
    "donation",
    `donation_id=eq.${donationId}&select=donation_id`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        ...donationBody(input),
        updated_on: new Date().toISOString(),
        ...(rates
          ? {
              aud_to_twd_rate: rates.rates.TWD,
              aud_to_usd_rate: rates.rates.USD,
              base_currency_amount: calculateBaseCurrencyAmount(
                input.originalAmount,
                input.currencyCode,
                rates.rates
              ),
              exchange_rate_date: input.receivedDate,
              exchange_rate_fetched_at: rates.fetchedAt,
              exchange_rate_source: rates.source,
              exchange_rate_to_base: calculateExchangeRateToBase(
                input.currencyCode,
                rates.rates
              ),
            }
          : {}),
      },
    }
  );
  if (!updatedRows[0]) {
    throw new Error("Donation was not updated");
  }

  const row = await fetchDonation(donationId, "Donation was not updated");

  await writeAudit(String(donationId), "update", previous, row);

  return row;
}

export async function softDeleteAdminDonation(
  donationId: number,
  reason: string
): Promise<AdminDonationRow> {
  const previous = await fetchDonation(donationId, "Donation was not found");
  const deletedAt = new Date().toISOString();
  const updatedRows = await adminFetch<Array<{ donation_id: number }>>(
    "donation",
    `donation_id=eq.${donationId}&select=donation_id`,
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
    throw new Error("Donation was not deleted");
  }

  const row = await fetchDonation(donationId, "Donation was not deleted");

  await writeAudit(String(donationId), "soft_delete", previous, row, reason);

  return row;
}

export async function restoreAdminDonation(
  donationId: number
): Promise<AdminDonationRow> {
  const previous = await fetchDonation(donationId, "Donation was not found");
  const updatedRows = await adminFetch<Array<{ donation_id: number }>>(
    "donation",
    `donation_id=eq.${donationId}&select=donation_id`,
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
    throw new Error("Donation was not restored");
  }

  const row = await fetchDonation(donationId, "Donation was not restored");

  await writeAudit(String(donationId), "restore", previous, row);

  return row;
}
