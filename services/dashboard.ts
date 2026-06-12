import { fetchFromView } from "@/lib/supabase";

export type CampaignSummary = {
  campaign_id: number;
  campaign_name: string;
  beneficiary_name: string;
  target_amount: number | null;
  target_currency_code: string | null;
  total_received_base: number;
  total_allocated_base: number;
  total_spent_base: number;
  remaining_balance_base: number;
  unallocated_balance_base: number;
};

export type ExpenseByCategory = {
  campaign_id: number;
  expense_category_id: number;
  category_name: string;
  category_group: string;
  total_spent_base: number;
};

export type BudgetVsSpent = {
  campaign_id: number;
  expense_category_id: number;
  category_name: string;
  category_group: string;
  total_budget_base: number;
  total_spent_base: number;
  variance_base: number;
};

export type PublicDonation = {
  donation_id: number;
  campaign_id: number;
  campaign_name: string;
  received_date: string;
  original_amount: number;
  currency_code: string;
  base_currency_amount: number;
  donor_display_name: string;
};

export type PublicExpense = {
  expense_id: number;
  campaign_id: number;
  campaign_name: string;
  expense_date: string;
  expense_category_id: number;
  category_name: string;
  category_group: string;
  expense_description: string;
  original_amount: number;
  currency_code: string;
  base_currency_amount: number;
};

export async function getCampaignSummary(): Promise<CampaignSummary[]> {
  return fetchFromView<CampaignSummary[]>("v_public_campaign_summary");
}

export async function getExpenseByCategory(): Promise<ExpenseByCategory[]> {
  return fetchFromView<ExpenseByCategory[]>("v_public_expense_by_category");
}

export async function getBudgetVsSpent(): Promise<BudgetVsSpent[]> {
  return fetchFromView<BudgetVsSpent[]>("v_public_budget_vs_spent");
}

export async function getPublicDonations(): Promise<PublicDonation[]> {
  return fetchFromView<PublicDonation[]>(
    "v_public_donation",
    "select=*&order=received_date.desc&limit=10"
  );
}

export async function getPublicExpenses(): Promise<PublicExpense[]> {
  return fetchFromView<PublicExpense[]>(
    "v_public_expense",
    "select=*&order=expense_date.desc"
  );
}
