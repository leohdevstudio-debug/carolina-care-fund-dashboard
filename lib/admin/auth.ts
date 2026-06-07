import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  verifyAdminSessionToken,
} from "@/lib/admin/session";

export function getAdminSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error("Missing ADMIN_SESSION_SECRET");
  }

  return secret;
}

export function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    throw new Error("Missing ADMIN_PASSWORD");
  }

  return password;
}

export async function hasAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  return verifyAdminSessionToken(token, getAdminSessionSecret()) !== null;
}

export async function requireAdminPageSession(): Promise<void> {
  if (!(await hasAdminSession())) {
    redirect("/admin/login");
  }
}

export async function requireAdminApiSession(): Promise<Response | null> {
  if (await hasAdminSession()) {
    return null;
  }

  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function buildAdminSessionToken(): string {
  return createAdminSessionToken(getAdminSessionSecret());
}
