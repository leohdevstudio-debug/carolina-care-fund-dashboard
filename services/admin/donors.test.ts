import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/supabaseAdmin", () => ({
  adminFetch: vi.fn(),
}));

import { adminFetch } from "@/lib/admin/supabaseAdmin";
import {
  createAdminDonor,
  listAdminDonors,
  restoreAdminDonor,
  softDeleteAdminDonor,
  updateAdminDonor,
} from "@/services/admin/donors";

const adminFetchMock = vi.mocked(adminFetch);

const donor = {
  country_name: "Australia",
  created_at: "2026-06-08T00:00:00.000Z",
  deleted_at: null,
  deleted_by: null,
  deleted_reason: null,
  display_name: "Jane Donor",
  donor_id: 3,
  donor_type: "Individual",
  email_address: "jane@example.com",
  first_name: "Jane",
  is_anonymous_publicly: false,
  last_name: "Donor",
  notes: "Monthly donor",
  phone_number: "+61400000000",
  updated_at: "2026-06-08T00:00:00.000Z",
};

const input = {
  countryName: "Australia",
  displayName: "Jane Donor",
  donorType: "Individual",
  emailAddress: "jane@example.com",
  firstName: "Jane",
  isAnonymousPublicly: false,
  lastName: "Donor",
  notes: "Monthly donor",
  phoneNumber: "+61400000000",
};

describe("admin donor service", () => {
  beforeEach(() => {
    adminFetchMock.mockReset();
  });

  it("lists active donors by default", async () => {
    adminFetchMock.mockResolvedValueOnce([donor]);

    await expect(listAdminDonors()).resolves.toEqual([donor]);

    expect(adminFetchMock).toHaveBeenCalledWith(
      "v_admin_donor",
      expect.stringContaining("deleted_at=is.null")
    );
  });

  it("creates a donor and writes audit", async () => {
    adminFetchMock
      .mockResolvedValueOnce([{ donor_id: 3 }])
      .mockResolvedValueOnce([donor])
      .mockResolvedValueOnce({ audit_id: 1 });

    await expect(createAdminDonor(input)).resolves.toEqual(donor);

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      1,
      "donor",
      "select=donor_id",
      expect.objectContaining({
        body: expect.objectContaining({
          country_name: "Australia",
          created_by: "admin",
          display_name: "Jane Donor",
          donor_type: "Individual",
          updated_by: "admin",
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
          p_entity_id: "3",
          p_entity_table: "donor",
        }),
      })
    );
  });

  it("updates a donor and writes audit", async () => {
    adminFetchMock
      .mockResolvedValueOnce([donor])
      .mockResolvedValueOnce([{ donor_id: 3 }])
      .mockResolvedValueOnce([{ ...donor, display_name: "Jane Smith" }])
      .mockResolvedValueOnce({ audit_id: 1 });

    await updateAdminDonor(3, {
      ...input,
      displayName: "Jane Smith",
    });

    expect(adminFetchMock).toHaveBeenNthCalledWith(
      2,
      "donor",
      "donor_id=eq.3&select=donor_id",
      expect.objectContaining({
        body: expect.objectContaining({
          display_name: "Jane Smith",
          updated_by: "admin",
        }),
        method: "PATCH",
        prefer: "return=representation",
      })
    );
    expect(adminFetchMock).toHaveBeenNthCalledWith(
      4,
      "rpc/admin_insert_audit_log",
      "",
      expect.objectContaining({
        body: expect.objectContaining({
          p_action: "update",
          p_entity_table: "donor",
        }),
      })
    );
  });

  it("soft deletes a donor with an audit reason", async () => {
    adminFetchMock
      .mockResolvedValueOnce([donor])
      .mockResolvedValueOnce([{ donor_id: 3 }])
      .mockResolvedValueOnce([{ ...donor, deleted_reason: "Duplicate" }])
      .mockResolvedValueOnce({ audit_id: 1 });

    await softDeleteAdminDonor(3, "Duplicate");

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

  it("restores a donor and writes audit", async () => {
    const deleted = {
      ...donor,
      deleted_at: "2026-06-08T01:00:00.000Z",
      deleted_by: "admin",
      deleted_reason: "Duplicate",
    };
    adminFetchMock
      .mockResolvedValueOnce([deleted])
      .mockResolvedValueOnce([{ donor_id: 3 }])
      .mockResolvedValueOnce([donor])
      .mockResolvedValueOnce({ audit_id: 1 });

    await restoreAdminDonor(3);

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
