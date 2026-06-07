import { describe, expect, it, vi } from "vitest";
import {
  SupabaseAdminRequestError,
  adminFetch,
} from "@/lib/admin/supabaseAdmin";

describe("adminFetch", () => {
  it("uses service role headers and fund schema profile", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_SCHEMA", "fund");

    const fetcher = vi.fn(async () => Response.json([{ ok: true }]));

    await adminFetch("v_admin_expense", "select=*", { fetcher });

    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/v_admin_expense?select=*",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({
          Accept: "application/json",
          "Accept-Profile": "fund",
          apikey: "service-key",
          Authorization: "Bearer service-key",
          "Content-Profile": "fund",
        }),
      })
    );
  });

  it("throws structured errors for failed admin requests", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_SCHEMA", "fund");

    const fetcher = vi.fn(async () => new Response("bad request", { status: 400 }));

    await expect(
      adminFetch("v_admin_expense", "select=*", { fetcher })
    ).rejects.toMatchObject({
      message: "bad request",
      status: 400,
    });
    await expect(
      adminFetch("v_admin_expense", "select=*", { fetcher })
    ).rejects.toBeInstanceOf(SupabaseAdminRequestError);
  });
});
