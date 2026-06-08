import { requireAdminApiSession } from "@/lib/admin/auth";
import { formatAdminRouteError } from "@/lib/admin/adminDataError";
import { restoreAdminDonation } from "@/services/admin/donations";

function parseDonationId(id: string): number | null {
  const donationId = Number(id);

  return Number.isInteger(donationId) && donationId > 0 ? donationId : null;
}

function errorResponse(error: unknown, fallback: string): Response {
  return Response.json(
    { error: formatAdminRouteError(error, fallback) },
    { status: 400 }
  );
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const donationId = parseDonationId(id);

  if (!donationId) {
    return Response.json({ error: "Invalid donation id" }, { status: 400 });
  }

  try {
    return Response.json(await restoreAdminDonation(donationId));
  } catch (error) {
    return errorResponse(error, "Unable to restore donation");
  }
}
