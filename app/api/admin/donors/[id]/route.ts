import { requireAdminApiSession } from "@/lib/admin/auth";
import { formatAdminRouteError } from "@/lib/admin/adminDataError";
import { parseDonorInput } from "@/lib/admin/donorValidation";
import { updateAdminDonor } from "@/services/admin/donors";

function parseDonorId(id: string): number | null {
  const donorId = Number(id);

  return Number.isInteger(donorId) && donorId > 0 ? donorId : null;
}

function errorResponse(error: unknown, fallback: string): Response {
  return Response.json(
    { error: formatAdminRouteError(error, fallback) },
    { status: 400 }
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const donorId = parseDonorId(id);

  if (!donorId) {
    return Response.json({ error: "Invalid donor id" }, { status: 400 });
  }

  try {
    const input = parseDonorInput(await request.json());

    return Response.json(await updateAdminDonor(donorId, input));
  } catch (error) {
    return errorResponse(error, "Unable to update donor");
  }
}
