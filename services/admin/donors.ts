import { adminFetch } from "@/lib/admin/supabaseAdmin";
import type { AdminDonorInput } from "@/lib/admin/donorValidation";

export type AdminDonorStatus = "active" | "deleted" | "all";

export type AdminDonorRow = {
  donor_id: number;
  donor_type: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  country_name: string | null;
  email_address: string | null;
  phone_number: string | null;
  is_anonymous_publicly: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_reason: string | null;
  deleted_by: string | null;
};

type DonorListFilters = {
  status?: AdminDonorStatus;
  search?: string;
};

type AuditAction = "create" | "update" | "soft_delete" | "restore";

function statusFilter(status: AdminDonorStatus | undefined): string {
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

function buildListQuery(filters: DonorListFilters): string {
  const query = new URLSearchParams();
  query.set("select", "*");
  query.set("order", "display_name.asc");
  query.set("limit", "100");

  const status = statusFilter(filters.status);
  if (status) {
    query.set("deleted_at", status);
  }

  if (filters.search?.trim()) {
    const search = sanitizeSearch(filters.search);
    query.set(
      "or",
      `(display_name.ilike.*${search}*,first_name.ilike.*${search}*,last_name.ilike.*${search}*,country_name.ilike.*${search}*,email_address.ilike.*${search}*)`
    );
  }

  return query.toString();
}

function byIdQuery(donorId: number): string {
  return `select=*&donor_id=eq.${donorId}&limit=1`;
}

function requireRow(rows: AdminDonorRow[], message: string): AdminDonorRow {
  const row = rows[0];

  if (!row) {
    throw new Error(message);
  }

  return row;
}

async function fetchDonor(
  donorId: number,
  message: string
): Promise<AdminDonorRow> {
  return requireRow(
    await adminFetch<AdminDonorRow[]>("v_admin_donor", byIdQuery(donorId)),
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
      p_entity_table: "donor",
      p_new_data: newData,
      p_old_data: oldData,
      p_reason: reason ?? null,
    },
  });
}

function donorBody(input: AdminDonorInput) {
  return {
    donor_type: input.donorType,
    display_name: input.displayName,
    first_name: input.firstName,
    last_name: input.lastName,
    country_name: input.countryName,
    email_address: input.emailAddress,
    phone_number: input.phoneNumber,
    is_anonymous_publicly: input.isAnonymousPublicly,
    notes: input.notes,
    updated_by: "admin",
  };
}

export async function listAdminDonors(
  filters: DonorListFilters = {}
): Promise<AdminDonorRow[]> {
  return adminFetch<AdminDonorRow[]>("v_admin_donor", buildListQuery(filters));
}

export async function createAdminDonor(
  input: AdminDonorInput
): Promise<AdminDonorRow> {
  const insertedRows = await adminFetch<Array<{ donor_id: number }>>(
    "donor",
    "select=donor_id",
    {
      method: "POST",
      prefer: "return=representation",
      body: {
        ...donorBody(input),
        created_by: "admin",
      },
    }
  );
  const inserted = insertedRows[0];
  if (!inserted) {
    throw new Error("Donor was not created");
  }

  const row = await fetchDonor(inserted.donor_id, "Donor was not created");

  await writeAudit(String(row.donor_id), "create", null, row);

  return row;
}

export async function updateAdminDonor(
  donorId: number,
  input: AdminDonorInput
): Promise<AdminDonorRow> {
  const previous = await fetchDonor(donorId, "Donor was not found");
  const updatedRows = await adminFetch<Array<{ donor_id: number }>>(
    "donor",
    `donor_id=eq.${donorId}&select=donor_id`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        ...donorBody(input),
        updated_on: new Date().toISOString(),
      },
    }
  );
  if (!updatedRows[0]) {
    throw new Error("Donor was not updated");
  }

  const row = await fetchDonor(donorId, "Donor was not updated");

  await writeAudit(String(donorId), "update", previous, row);

  return row;
}

export async function softDeleteAdminDonor(
  donorId: number,
  reason: string
): Promise<AdminDonorRow> {
  const previous = await fetchDonor(donorId, "Donor was not found");
  const deletedAt = new Date().toISOString();
  const updatedRows = await adminFetch<Array<{ donor_id: number }>>(
    "donor",
    `donor_id=eq.${donorId}&select=donor_id`,
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
    throw new Error("Donor was not deleted");
  }

  const row = await fetchDonor(donorId, "Donor was not deleted");

  await writeAudit(String(donorId), "soft_delete", previous, row, reason);

  return row;
}

export async function restoreAdminDonor(
  donorId: number
): Promise<AdminDonorRow> {
  const previous = await fetchDonor(donorId, "Donor was not found");
  const updatedRows = await adminFetch<Array<{ donor_id: number }>>(
    "donor",
    `donor_id=eq.${donorId}&select=donor_id`,
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
    throw new Error("Donor was not restored");
  }

  const row = await fetchDonor(donorId, "Donor was not restored");

  await writeAudit(String(donorId), "restore", previous, row);

  return row;
}
