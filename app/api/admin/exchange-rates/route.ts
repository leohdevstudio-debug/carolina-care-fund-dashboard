import { requireAdminApiSession } from "@/lib/admin/auth";
import { formatAdminRouteError } from "@/lib/admin/adminDataError";
import {
  parseExchangeRateInput,
  type AdminExchangeRateInput,
} from "@/lib/admin/exchangeRateValidation";
import {
  createAdminExchangeRate,
  listAdminExchangeRates,
  type AdminExchangeRateQuoteFilter,
} from "@/services/admin/exchangeRates";

function errorResponse(error: unknown, fallback: string): Response {
  return Response.json(
    { error: formatAdminRouteError(error, fallback) },
    { status: 400 }
  );
}

function parseQuoteCurrency(value: string | null): AdminExchangeRateQuoteFilter {
  if (value === "USD" || value === "TWD") {
    return value;
  }

  return "all";
}

export async function GET(request: Request): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(request.url);
    const quoteCurrencyCode = parseQuoteCurrency(
      url.searchParams.get("quoteCurrencyCode")
    );
    const search = url.searchParams.get("search") ?? undefined;

    return Response.json(
      await listAdminExchangeRates({ quoteCurrencyCode, search })
    );
  } catch (error) {
    return errorResponse(error, "Unable to list exchange rates");
  }
}

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  try {
    const input: AdminExchangeRateInput = parseExchangeRateInput(
      await request.json()
    );
    const exchangeRate = await createAdminExchangeRate(input);

    return Response.json(exchangeRate, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to create exchange rate");
  }
}
