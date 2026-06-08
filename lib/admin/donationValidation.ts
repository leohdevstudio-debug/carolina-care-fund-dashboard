import { isDisplayCurrency, type DisplayCurrency } from "@/lib/currency";

export type AdminDonationInput = {
  campaignId: number;
  donorId: number;
  receivedDate: string;
  originalAmount: number;
  currencyCode: DisplayCurrency;
  paymentMethod: string | null;
  transactionReference: string | null;
  senderNameAsReceived: string | null;
  senderCountryName: string | null;
  purposeNote: string | null;
  isConfirmed: boolean;
  receivedBy: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${label} is required`);
  }

  return Number(value);
}

function requirePositiveAmount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  return value;
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

function requireIsoDate(value: unknown, label: string): string {
  const text = requireString(value, label);
  const parsed = new Date(`${text}T00:00:00.000Z`);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== text
  ) {
    throw new Error(`${label} must be a valid ISO date`);
  }

  return text;
}

function requireCurrency(value: unknown): DisplayCurrency {
  if (!isDisplayCurrency(value)) {
    throw new Error("Currency must be AUD, USD, or TWD");
  }

  return value;
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} is required`);
  }

  return value;
}

export function parseDonationInput(value: unknown): AdminDonationInput {
  if (!isRecord(value)) {
    throw new Error("Donation payload is required");
  }

  return {
    campaignId: requirePositiveInteger(value.campaignId, "Campaign"),
    donorId: requirePositiveInteger(value.donorId, "Donor"),
    receivedDate: requireIsoDate(value.receivedDate, "Received date"),
    originalAmount: requirePositiveAmount(value.originalAmount),
    currencyCode: requireCurrency(value.currencyCode),
    paymentMethod: optionalString(value.paymentMethod),
    transactionReference: optionalString(value.transactionReference),
    senderNameAsReceived: optionalString(value.senderNameAsReceived),
    senderCountryName: optionalString(value.senderCountryName),
    purposeNote: optionalString(value.purposeNote),
    isConfirmed: requireBoolean(value.isConfirmed, "Confirmed status"),
    receivedBy: optionalString(value.receivedBy),
  };
}
