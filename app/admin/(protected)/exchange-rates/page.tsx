import ExchangeRatesAdminClient from "@/components/admin/ExchangeRatesAdminClient";
import { formatAdminDataError } from "@/lib/admin/adminDataError";
import { listAdminExchangeRates } from "@/services/admin/exchangeRates";

async function loadAdminExchangeRates() {
  try {
    const exchangeRates = await listAdminExchangeRates();

    return {
      error: "",
      exchangeRates,
    };
  } catch (error) {
    return {
      error: formatAdminDataError(error),
      exchangeRates: [],
    };
  }
}

export default async function AdminExchangeRatesPage() {
  const { error, exchangeRates } = await loadAdminExchangeRates();

  return (
    <ExchangeRatesAdminClient
      initialError={error}
      initialExchangeRates={exchangeRates}
    />
  );
}
