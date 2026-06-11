import { adminFetch } from "@/lib/admin/supabaseAdmin";
import type {
  AdminCampaignInput,
  CampaignTargetAmountMode,
} from "@/lib/admin/campaignValidation";
import type { DisplayCurrency } from "@/lib/currency";
import { recalculateCampaignTarget } from "@/services/admin/campaignTargets";

export type AdminCampaignStatus = "active" | "deleted" | "all";

export type AdminCampaignRow = {
  campaign_id: number;
  campaign_name: string;
  campaign_description: string | null;
  beneficiary_name: string;
  start_date: string | null;
  end_date: string | null;
  target_amount: number;
  target_currency_code: DisplayCurrency;
  target_amount_mode: CampaignTargetAmountMode;
  target_adjustment_amount: number;
  computed_budget_target_amount: number;
  is_public: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_reason: string | null;
  deleted_by: string | null;
};

type CampaignListFilters = {
  status?: AdminCampaignStatus;
  search?: string;
};

type AuditAction = "create" | "update" | "soft_delete" | "restore";

function statusFilter(status: AdminCampaignStatus | undefined): string {
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

function buildListQuery(filters: CampaignListFilters): string {
  const query = new URLSearchParams();
  query.set("select", "*");
  query.set("order", "is_active.desc,campaign_name.asc");
  query.set("limit", "100");

  const status = statusFilter(filters.status);
  if (status) {
    query.set("deleted_at", status);
  }

  if (filters.search?.trim()) {
    const search = sanitizeSearch(filters.search);
    query.set(
      "or",
      `(campaign_name.ilike.*${search}*,beneficiary_name.ilike.*${search}*,campaign_description.ilike.*${search}*)`
    );
  }

  return query.toString();
}

function byIdQuery(campaignId: number): string {
  return `select=*&campaign_id=eq.${campaignId}&limit=1`;
}

function requireRow(
  rows: AdminCampaignRow[],
  message: string
): AdminCampaignRow {
  const row = rows[0];

  if (!row) {
    throw new Error(message);
  }

  return row;
}

async function fetchCampaign(
  campaignId: number,
  message: string
): Promise<AdminCampaignRow> {
  return requireRow(
    await adminFetch<AdminCampaignRow[]>(
      "v_admin_campaign",
      byIdQuery(campaignId)
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
      p_entity_table: "campaign",
      p_new_data: newData,
      p_old_data: oldData,
      p_reason: reason ?? null,
    },
  });
}

function targetAmountForInput(input: AdminCampaignInput): number {
  if (input.targetAmountMode === "manual") {
    return Number(input.targetAmount);
  }

  return input.targetAdjustmentAmount;
}

function campaignBody(input: AdminCampaignInput) {
  return {
    beneficiary_name: input.beneficiaryName,
    campaign_description: input.campaignDescription,
    campaign_name: input.campaignName,
    end_date: input.endDate,
    is_active: input.isActive,
    is_public: input.isPublic,
    start_date: input.startDate,
    target_adjustment_amount: input.targetAdjustmentAmount,
    target_amount: targetAmountForInput(input),
    target_amount_mode: input.targetAmountMode,
    target_currency_code: "AUD",
    updated_by: "admin",
  };
}

export async function listAdminCampaigns(
  filters: CampaignListFilters = {}
): Promise<AdminCampaignRow[]> {
  return adminFetch<AdminCampaignRow[]>(
    "v_admin_campaign",
    buildListQuery(filters)
  );
}

export async function createAdminCampaign(
  input: AdminCampaignInput
): Promise<AdminCampaignRow> {
  const insertedRows = await adminFetch<Array<{ campaign_id: number }>>(
    "campaign",
    "select=campaign_id",
    {
      method: "POST",
      prefer: "return=representation",
      body: {
        ...campaignBody(input),
        created_by: "admin",
      },
    }
  );
  const inserted = insertedRows[0];
  if (!inserted) {
    throw new Error("Campaign was not created");
  }

  if (input.targetAmountMode === "budget_auto") {
    await recalculateCampaignTarget(inserted.campaign_id);
  }

  const row = await fetchCampaign(
    inserted.campaign_id,
    "Campaign was not created"
  );

  await writeAudit(String(row.campaign_id), "create", null, row);

  return row;
}

export async function updateAdminCampaign(
  campaignId: number,
  input: AdminCampaignInput
): Promise<AdminCampaignRow> {
  const previous = await fetchCampaign(campaignId, "Campaign was not found");
  const updatedRows = await adminFetch<Array<{ campaign_id: number }>>(
    "campaign",
    `campaign_id=eq.${campaignId}&select=campaign_id`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        ...campaignBody(input),
        updated_on: new Date().toISOString(),
      },
    }
  );
  if (!updatedRows[0]) {
    throw new Error("Campaign was not updated");
  }

  if (input.targetAmountMode === "budget_auto") {
    await recalculateCampaignTarget(campaignId);
  }

  const row = await fetchCampaign(campaignId, "Campaign was not updated");

  await writeAudit(String(campaignId), "update", previous, row);

  return row;
}

export async function softDeleteAdminCampaign(
  campaignId: number,
  reason: string
): Promise<AdminCampaignRow> {
  const previous = await fetchCampaign(campaignId, "Campaign was not found");
  const deletedAt = new Date().toISOString();
  const updatedRows = await adminFetch<Array<{ campaign_id: number }>>(
    "campaign",
    `campaign_id=eq.${campaignId}&select=campaign_id`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        deleted_at: deletedAt,
        deleted_by: "admin",
        deleted_reason: reason,
        is_active: false,
        updated_by: "admin",
        updated_on: deletedAt,
      },
    }
  );
  if (!updatedRows[0]) {
    throw new Error("Campaign was not deleted");
  }

  const row = await fetchCampaign(campaignId, "Campaign was not deleted");

  await writeAudit(String(campaignId), "soft_delete", previous, row, reason);

  return row;
}

export async function restoreAdminCampaign(
  campaignId: number
): Promise<AdminCampaignRow> {
  const previous = await fetchCampaign(campaignId, "Campaign was not found");
  const updatedRows = await adminFetch<Array<{ campaign_id: number }>>(
    "campaign",
    `campaign_id=eq.${campaignId}&select=campaign_id`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        deleted_at: null,
        deleted_by: null,
        deleted_reason: null,
        is_active: false,
        updated_by: "admin",
        updated_on: new Date().toISOString(),
      },
    }
  );
  if (!updatedRows[0]) {
    throw new Error("Campaign was not restored");
  }

  const row = await fetchCampaign(campaignId, "Campaign was not restored");

  await writeAudit(String(campaignId), "restore", previous, row);

  return row;
}
