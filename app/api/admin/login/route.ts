import { cookies } from "next/headers";
import { buildAdminSessionToken, getAdminPassword } from "@/lib/admin/auth";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_MS,
  verifyAdminPassword,
} from "@/lib/admin/session";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    password?: string;
  } | null;

  if (!verifyAdminPassword(body?.password ?? "", getAdminPassword())) {
    return Response.json({ error: "Invalid password" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, buildAdminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
    path: "/",
  });

  return Response.json({ ok: true });
}
