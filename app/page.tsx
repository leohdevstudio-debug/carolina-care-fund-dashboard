import DashboardClient from "@/components/DashboardClient";
import {
  getCampaignSummary,
  getExpenseByCategory,
  getBudgetVsSpent,
  getPublicDonations,
  getPublicExpenses,
} from "@/services/dashboard";

export default async function Page() {
  const [summaryRows, expenseByCategory, budgetVsSpent, donations, expenses] =
    await Promise.all([
      getCampaignSummary(),
      getExpenseByCategory(),
      getBudgetVsSpent(),
      getPublicDonations(),
      getPublicExpenses(),
    ]);

  const summary = summaryRows[0];

  if (!summary) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-6xl rounded-3xl border border-amber-200 bg-amber-50 p-8 text-amber-900">
          <h1 className="text-2xl font-semibold">No public campaign data found</h1>
          <p className="mt-3 text-sm">
            Check that the public views contain at least one active public campaign.
          </p>
        </div>
      </main>
    );
  }

  return (
    <DashboardClient
      summary={summary}
      expenseByCategory={expenseByCategory}
      budgetVsSpent={budgetVsSpent}
      donations={donations}
      expenses={expenses}
    />
  );
}