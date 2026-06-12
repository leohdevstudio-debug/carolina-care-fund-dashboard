import { requireAdminApiSession } from "@/lib/admin/auth";
import { formatAdminRouteError } from "@/lib/admin/adminDataError";
import {
  parseExchangeRateFetchInput,
  type AdminExchangeRateFetchInput,
} from "@/lib/admin/exchangeRateValidation";
import { fetchAndStoreAdminExchangeRatesForDate } from "@/services/admin/exchangeRates";

function errorResponse(error: unknown, fallback: string): Response {
  return Response.json(
    { error: formatAdminRouteError(error, fallback) },
    { status: 400 }
  );
}

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  try {
    const input: AdminExchangeRateFetchInput = parseExchangeRateFetchInput(
      await request.json()
    );
    const result = await fetchAndStoreAdminExchangeRatesForDate(input.rateDate);

    return Response.json(result, {
      status: result.createdCount > 0 ? 201 : 200,
    });
  } catch (error) {
    return errorResponse(error, "Unable to fetch exchange rates");
  }
}
