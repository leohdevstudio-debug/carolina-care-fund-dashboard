import { requireAdminApiSession } from "@/lib/admin/auth";
import { formatAdminRouteError } from "@/lib/admin/adminDataError";
import { parseSoftDeleteInput } from "@/lib/admin/expenseValidation";
import { softDeleteAdminDonation } from "@/services/admin/donations";

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
  request: Request,
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
    const { reason } = parseSoftDeleteInput(await request.json());

    return Response.json(await softDeleteAdminDonation(donationId, reason));
  } catch (error) {
    return errorResponse(error, "Unable to delete donation");
  }
}
