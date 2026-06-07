import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieSet = vi.hoisted(() => vi.fn());
const cookieGet = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: cookieGet,
    set: cookieSet,
  })),
}));

import { POST } from "./route";

function loginRequest(password: string): Request {
  return new Request("http://localhost/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

describe("admin login route", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_PASSWORD", "admin-pass");
    vi.stubEnv("ADMIN_SESSION_SECRET", "test-secret-with-enough-length");
    vi.stubEnv("NODE_ENV", "test");
    cookieSet.mockClear();
    cookieGet.mockClear();
  });

  it("rejects an invalid password without setting a cookie", async () => {
    const response = await POST(loginRequest("wrong"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid password" });
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("sets an HTTP-only session cookie for the admin area and API", async () => {
    const response = await POST(loginRequest("admin-pass"));

    expect(response.status).toBe(200);
    expect(cookieSet).toHaveBeenCalledWith(
      "ccf_admin_session",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        maxAge: 28800,
        path: "/",
        sameSite: "lax",
        secure: false,
      })
    );
  });
});
