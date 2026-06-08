import { requireAdminApiSession } from "@/lib/admin/auth";
import { formatAdminRouteError } from "@/lib/admin/adminDataError";
import {
  parseDonationInput,
  type AdminDonationInput,
} from "@/lib/admin/donationValidation";
import {
  createAdminDonation,
  listAdminDonations,
  type AdminDonationStatus,
} from "@/services/admin/donations";

function errorResponse(error: unknown, fallback: string): Response {
  return Response.json(
    { error: formatAdminRouteError(error, fallback) },
    { status: 400 }
  );
}

function parseStatus(value: string | null): AdminDonationStatus {
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

    return Response.json(await listAdminDonations({ search, status }));
  } catch (error) {
    return errorResponse(error, "Unable to list donations");
  }
}

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  try {
    const input: AdminDonationInput = parseDonationInput(await request.json());
    const donation = await createAdminDonation(input);

    return Response.json(donation, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to create donation");
  }
}
