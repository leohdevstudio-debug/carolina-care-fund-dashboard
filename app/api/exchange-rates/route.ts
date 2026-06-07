import { getCurrentExchangeRates } from "@/lib/exchangeRates";

export async function GET(): Promise<Response> {
  try {
    const exchangeRates = await getCurrentExchangeRates();

    return Response.json(exchangeRates, {
      headers: {
        "cache-control": "public, max-age=300, stale-while-revalidate=3600",
      },
    });
  } catch {
    return Response.json(
      {
        error: "Exchange rates are temporarily unavailable",
      },
      { status: 503 }
    );
  }
}
