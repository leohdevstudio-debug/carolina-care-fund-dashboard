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
      <main className="min-h-screen bg-background px-6 py-16 flex items-start justify-center">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-border bg-surface p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 rounded-full bg-warning/10 p-2.5">
              <svg
                className="h-5 w-5 text-warning"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">
                No public campaign data found
              </h1>
              <p className="mt-2 text-sm text-muted">
                Check that the public views contain at least one active public
                campaign.
              </p>
            </div>
          </div>
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
