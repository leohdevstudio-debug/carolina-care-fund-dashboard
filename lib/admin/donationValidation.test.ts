import { describe, expect, it } from "vitest";
import { parseDonationInput } from "@/lib/admin/donationValidation";

const validDonation = {
  campaignId: 1,
  donorId: 3,
  receivedDate: "2026-06-08",
  originalAmount: 65,
  currencyCode: "USD",
  paymentMethod: "Bank transfer",
  transactionReference: "ABC123",
  senderNameAsReceived: "Jane Donor",
  senderCountryName: "Australia",
  purposeNote: "Monthly gift",
  isConfirmed: true,
  receivedBy: "admin",
};

describe("parseDonationInput", () => {
  it("accepts valid donation payloads and trims optional text", () => {
    expect(
      parseDonationInput({
        ...validDonation,
        paymentMethod: " Bank transfer ",
        purposeNote: " Monthly gift ",
      })
    ).toEqual({
      ...validDonation,
      paymentMethod: "Bank transfer",
      purposeNote: "Monthly gift",
    });
  });

  it("normalizes blank optional text to null", () => {
    expect(
      parseDonationInput({
        ...validDonation,
        paymentMethod: "",
        transactionReference: " ",
      })
    ).toMatchObject({
      paymentMethod: null,
      transactionReference: null,
    });
  });

  it("rejects invalid donation dates", () => {
    expect(() =>
      parseDonationInput({ ...validDonation, receivedDate: "2026-02-31" })
    ).toThrow("Received date must be a valid ISO date");
  });

  it("rejects unsupported currencies", () => {
    expect(() =>
      parseDonationInput({ ...validDonation, currencyCode: "EUR" })
    ).toThrow("Currency must be AUD, USD, or TWD");
  });
});
