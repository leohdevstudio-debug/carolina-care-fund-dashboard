export type CampaignTargetAmountMode = "budget_auto" | "manual";

export type AdminCampaignInput = {
  campaignName: string;
  campaignDescription: string | null;
  beneficiaryName: string;
  startDate: string | null;
  endDate: string | null;
  targetAmountMode: CampaignTargetAmountMode;
  targetAdjustmentAmount: number;
  targetAmount: number | null;
  isPublic: boolean;
  isActive: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }

  return value.trim();
}

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function optionalDate(value: unknown, label: string): string | null {
  const trimmed = optionalString(value);

  if (!trimmed) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${label} must use YYYY-MM-DD`);
  }

  const parsed = Date.parse(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed)) {
    throw new Error(`${label} must be a valid date`);
  }

  return trimmed;
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be true or false`);
  }

  return value;
}

function requireTargetMode(value: unknown): CampaignTargetAmountMode {
  if (value === undefined || value === null || value === "") {
    return "budget_auto";
  }

  if (value === "budget_auto" || value === "manual") {
    return value;
  }

  throw new Error("Target mode must be budget_auto or manual");
}

function requireNonNegativeAmount(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("Target adjustment cannot be negative");
  }

  return value;
}

function requireManualTargetAmount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error("Manual target amount must be greater than zero");
  }

  return value;
}

export function parseCampaignInput(value: unknown): AdminCampaignInput {
  if (!isRecord(value)) {
    throw new Error("Campaign payload is required");
  }

  const startDate = optionalDate(value.startDate, "Start date");
  const endDate = optionalDate(value.endDate, "End date");
  if (startDate && endDate && endDate < startDate) {
    throw new Error("End date cannot be before start date");
  }

  const targetAmountMode = requireTargetMode(value.targetAmountMode);

  return {
    beneficiaryName: requireString(value.beneficiaryName, "Beneficiary"),
    campaignDescription: optionalString(value.campaignDescription),
    campaignName: requireString(value.campaignName, "Campaign name"),
    endDate,
    isActive: requireBoolean(value.isActive, "Active"),
    isPublic: requireBoolean(value.isPublic, "Public"),
    startDate,
    targetAdjustmentAmount: requireNonNegativeAmount(
      value.targetAdjustmentAmount
    ),
    targetAmount:
      targetAmountMode === "manual"
        ? requireManualTargetAmount(value.targetAmount)
        : null,
    targetAmountMode,
  };
}
