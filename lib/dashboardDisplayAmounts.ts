import {
  convertFromBase,
  type DisplayCurrency,
  type ExchangeRateResponse,
} from "@/lib/currency";

type DonationAmount = {
  base_currency_amount: number;
  currency_code: string;
  original_amount: number;
};

type DashboardDisplayAmountInput = {
  displayCurrency: DisplayCurrency;
  donations: DonationAmount[];
  exchangeRates: ExchangeRateResponse;
  totalReceivedBase: number;
  totalSpentBase: number;
};

export function getDonationDisplayAmount(
  donation: DonationAmount,
  displayCurrency: DisplayCurrency,
  exchangeRates: ExchangeRateResponse
): number {
  if (donation.currency_code === displayCurrency) {
    return Number(donation.original_amount ?? 0);
  }

  return convertFromBase(
    donation.base_currency_amount,
    displayCurrency,
    exchangeRates
  );
}

export function getDashboardDisplayAmounts({
  displayCurrency,
  donations,
  exchangeRates,
  totalReceivedBase,
  totalSpentBase,
}: DashboardDisplayAmountInput) {
  const convertedBaseTotalReceived = convertFromBase(
    totalReceivedBase,
    displayCurrency,
    exchangeRates
  );
  const displayedTotalReceived = donations.reduce(
    (total, donation) =>
      total +
      getDonationDisplayAmount(donation, displayCurrency, exchangeRates),
    0
  );
  const displayedTotalSpent = convertFromBase(
    totalSpentBase,
    displayCurrency,
    exchangeRates
  );

  return {
    convertedBaseTotalReceived,
    displayedRemainingBalance: displayedTotalReceived - displayedTotalSpent,
    displayedTotalReceived,
    displayedTotalSpent,
    progressFundedAmount: displayedTotalReceived,
  };
}
