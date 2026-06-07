import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/session";

export async function POST(): Promise<Response> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return Response.json({ ok: true });
}
