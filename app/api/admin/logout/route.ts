import { cookies } from "next/headers";
import { shouldUseSecureAdminCookie } from "@/lib/admin/cookieOptions";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/session";

export async function POST(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureAdminCookie(request),
  });

  return Response.json({ ok: true });
}
