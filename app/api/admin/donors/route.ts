import { requireAdminApiSession } from "@/lib/admin/auth";
import { formatAdminRouteError } from "@/lib/admin/adminDataError";
import {
  parseDonorInput,
  type AdminDonorInput,
} from "@/lib/admin/donorValidation";
import {
  createAdminDonor,
  listAdminDonors,
  type AdminDonorStatus,
} from "@/services/admin/donors";

function errorResponse(error: unknown, fallback: string): Response {
  return Response.json(
    { error: formatAdminRouteError(error, fallback) },
    { status: 400 }
  );
}

function parseStatus(value: string | null): AdminDonorStatus {
  if (value === "deleted" || value === "all") {
    return value;
  }

  return "active";
}

export async function GET(request: Request): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(request.url);
    const status = parseStatus(url.searchParams.get("status"));
    const search = url.searchParams.get("search") ?? undefined;

    return Response.json(await listAdminDonors({ search, status }));
  } catch (error) {
    return errorResponse(error, "Unable to list donors");
  }
}

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  try {
    const input: AdminDonorInput = parseDonorInput(await request.json());
    const donor = await createAdminDonor(input);

    return Response.json(donor, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to create donor");
  }
}
