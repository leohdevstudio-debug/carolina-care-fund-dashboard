import { hasAdminSession } from "@/lib/admin/auth";

export async function GET(): Promise<Response> {
  return Response.json({ authenticated: await hasAdminSession() });
}
