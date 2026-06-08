export type AdminDonorInput = {
  donorType: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  countryName: string | null;
  emailAddress: string | null;
  phoneNumber: string | null;
  isAnonymousPublicly: boolean;
  notes: string | null;
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

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} is required`);
  }

  return value;
}

export function parseDonorInput(value: unknown): AdminDonorInput {
  if (!isRecord(value)) {
    throw new Error("Donor payload is required");
  }

  return {
    donorType: requireString(value.donorType, "Donor type"),
    displayName: requireString(value.displayName, "Display name"),
    firstName: optionalString(value.firstName),
    lastName: optionalString(value.lastName),
    countryName: optionalString(value.countryName),
    emailAddress: optionalString(value.emailAddress),
    phoneNumber: optionalString(value.phoneNumber),
    isAnonymousPublicly: requireBoolean(
      value.isAnonymousPublicly,
      "Anonymous public status"
    ),
    notes: optionalString(value.notes),
  };
}
