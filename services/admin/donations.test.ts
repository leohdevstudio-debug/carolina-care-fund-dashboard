import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/supabaseAdmin", () => ({
  adminFetch: vi.fn(),
}));

vi.mock("@/lib/exchangeRates", () => ({
  getCurrentExchangeRates: vi.fn(),
}));

import { adminFetch } from "@/lib/admin/supabaseAdmin";
import { getCurrentExchangeRates } from "@/lib/exchangeRates";
import {
  createAdminDonation,
  listAdminDonations,
  restoreAdminDonation,
  softDeleteAdminDonation,
  updateAdminDonation,
} from "@/services/admin/donations";

const adminFetchMock = vi.mocked(adminFetch);
const getCurrentExchangeRatesMock = vi.mocked(getCurrentExchangeRates);

const donation = {
  aud_to_twd_rate: 20,
  aud_to_usd_rate: 0.65,
  base_currency_amount: 100,
  campaign_id: 1,
  campaign_name: "Care campaign",
  created_at: "2026-06-08T00:00:00.000Z",
  currency_code: "USD",
  deleted_at: null,
  deleted_by: null,
  deleted_reason: null,
  donation_id: 9,
  donor_display_name: "Jane Donor",
  donor_id: 3,
  exchange_rate_date: "2026-06-08",
  exchange_rate_fetched_at: "2026-06-08T00:00:00.000Z",
  exchange_rate_source: "test-provider",
  exchange_rate_to_base: 1.53846154,
  is_anonymous_publicly: false,
  is_confirmed: true,
  original_amount: 65,
  payment_method: "Bank transfer",
  purpose_note: "Monthly gift",
  received_by: "admin",
  received_date: "2026-06-08",
  sender_country_name: "Australia",
  sender_name_as_received: "Jane Donor",
  transaction_reference: "ABC123",
  updated_at: "2026-06-08T00:00:00.000Z",
};

const input = {
  campaignId: 1,
  currencyCode: "USD" as const,
  donorId: 3,
  isConfirmed: true,
  originalAmount: 65,
  paymentMethod: "Bank transfer",
  purposeNote: "Monthly gift",
  receivedBy: "admin",
  receivedDate: "2026-06-08",
  senderCountryName: "Australia",
  senderNameAsReceived: "Jane Donor",
  transactionReference: "ABC123",
};

describe("admin donation service", () => {
  beforeEach(() => {
    adminFetchMock.mockReset();
    getCurrentExchangeRatesMock.mockReset();
    getCurrentExchangeRatesMock.mockResolvedValue({
      baseCurrency: "AUD",
      rates: {
        AUD: 1,
        USD: 0.65,
        TWD: 20,
      },
      source: "test-provider",
      fetchedAt: "2026-06-08T00:00:00.000Z",
      isFallback: false,
    });
  });

  it("lists active donations by default", async () => {
    adminFetchMock.mockResolvedValueOnce([donation]);

    await expect(listAdminDonations()).resolves.toEqual([donation]);

    expect(adminFetchMock).toHaveBeenCalledWith(
      "v_admin_donation",
      expect.stringContaining("deleted_at=is.null")
    );
  });

  it("creates a donation with exchange-rate snapshots and audit", async () => {
    adminFetchMock
      .mockResolvedValueOnce([{ donation_id: 9 }])
      .mockResolvedValueOnce([donation])
      .mockResolvedValueOnce({ audit_id: 1 });

    await expect(createAdminDonation(input)).resolves.toEqual(donation);

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      1,
      "donation",
      "select=donation_id",
      expect.objectContaining({
        body: expect.objectContaining({
          aud_to_twd_rate: 20,
          aud_to_usd_rate: 0.65,
          base_currency_amount: 100,
          campaign_id: 1,
          donor_id: 3,
          exchange_rate_date: "2026-06-08",
          exchange_rate_to_base: 1.53846154,
        }),
        method: "POST",
        prefer: "return=representation",
      })
    );
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      3,
      "rpc/admin_insert_audit_log",
      "",
      expect.objectContaining({
        body: expect.objectContaining({
          p_action: "create",
          p_entity_id: "9",
          p_entity_table: "donation",
        }),
      })
    );
  });

  it("updates a donation and refreshes snapshots when amount changes", async () => {
    adminFetchMock
      .mockResolvedValueOnce([donation])
      .mockResolvedValueOnce([{ donation_id: 9 }])
      .mockResolvedValueOnce([{ ...donation, original_amount: 130 }])
      .mockResolvedValueOnce({ audit_id: 1 });

    await updateAdminDonation(9, { ...input, originalAmount: 130 });

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      2,
      "donation",
      "donation_id=eq.9&select=donation_id",
      expect.objectContaining({
        body: expect.objectContaining({
          base_currency_amount: 200,
          original_amount: 130,
        }),
        method: "PATCH",
        prefer: "return=representation",
      })
    );
  });

  it("soft deletes a donation with an audit reason", async () => {
    adminFetchMock
      .mockResolvedValueOnce([donation])
      .mockResolvedValueOnce([{ donation_id: 9 }])
      .mockResolvedValueOnce([{ ...donation, deleted_reason: "Duplicate" }])
      .mockResolvedValueOnce({ audit_id: 1 });

    await softDeleteAdminDonation(9, "Duplicate");

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      4,
      "rpc/admin_insert_audit_log",
      "",
      expect.objectContaining({
        body: expect.objectContaining({
          p_action: "soft_delete",
          p_reason: "Duplicate",
        }),
      })
    );
  });

  it("restores a donation and writes audit", async () => {
    adminFetchMock
      .mockResolvedValueOnce([{ ...donation, deleted_at: "2026-06-08" }])
      .mockResolvedValueOnce([{ donation_id: 9 }])
      .mockResolvedValueOnce([donation])
      .mockResolvedValueOnce({ audit_id: 1 });

    await restoreAdminDonation(9);

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      4,
      "rpc/admin_insert_audit_log",
      "",
      expect.objectContaining({
        body: expect.objectContaining({
          p_action: "restore",
        }),
      })
    );
  });
});
