import { describe, expect, it } from "vitest";
import { parseDonorInput } from "@/lib/admin/donorValidation";

const validDonor = {
  donorType: "Individual",
  displayName: "Jane Donor",
  firstName: "Jane",
  lastName: "Donor",
  countryName: "Australia",
  emailAddress: "jane@example.com",
  phoneNumber: "+61400000000",
  isAnonymousPublicly: false,
  notes: "Monthly donor",
};

describe("parseDonorInput", () => {
  it("accepts valid donor payloads and trims text", () => {
    expect(
      parseDonorInput({
        ...validDonor,
        displayName: " Jane Donor ",
        notes: " Monthly donor ",
      })
    ).toEqual(validDonor);
  });

  it("normalizes blank optional text to null", () => {
    expect(
      parseDonorInput({
        ...validDonor,
        emailAddress: "",
        phoneNumber: " ",
      })
    ).toMatchObject({
      emailAddress: null,
      phoneNumber: null,
    });
  });

  it("rejects blank display names", () => {
    expect(() =>
      parseDonorInput({
        ...validDonor,
        displayName: "",
      })
    ).toThrow("Display name is required");
  });

  it("rejects missing anonymous status", () => {
    expect(() =>
      parseDonorInput({
        ...validDonor,
        isAnonymousPublicly: undefined,
      })
    ).toThrow("Anonymous public status is required");
  });
});
