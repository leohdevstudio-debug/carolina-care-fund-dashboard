import { requireAdminApiSession } from "@/lib/admin/auth";
import { formatAdminRouteError } from "@/lib/admin/adminDataError";
import { parseExchangeRateInput } from "@/lib/admin/exchangeRateValidation";
import { updateAdminExchangeRate } from "@/services/admin/exchangeRates";

function parseExchangeRateId(id: string): number | null {
  const exchangeRateId = Number(id);

  return Number.isInteger(exchangeRateId) && exchangeRateId > 0
    ? exchangeRateId
    : null;
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
  const exchangeRateId = parseExchangeRateId(id);

  if (!exchangeRateId) {
    return Response.json(
      { error: "Invalid exchange rate id" },
      { status: 400 }
    );
  }

  try {
    const input = parseExchangeRateInput(await request.json());

    return Response.json(await updateAdminExchangeRate(exchangeRateId, input));
  } catch (error) {
    return errorResponse(error, "Unable to update exchange rate");
  }
}
