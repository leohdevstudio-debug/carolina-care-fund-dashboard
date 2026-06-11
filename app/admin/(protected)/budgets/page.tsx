import BudgetsAdminClient from "@/components/admin/BudgetsAdminClient";
import { formatAdminDataError } from "@/lib/admin/adminDataError";
import { listAdminBudgets } from "@/services/admin/budgets";
import { listAdminExpenseLookups } from "@/services/admin/lookups";

async function loadAdminBudgetsPageData() {
  try {
    const [budgets, lookups] = await Promise.all([
      listAdminBudgets({ status: "active" }),
      listAdminExpenseLookups(),
    ]);

    return {
      budgets,
      error: "",
      lookups,
    };
  } catch (error) {
    return {
      budgets: [],
      error: formatAdminDataError(error),
      lookups: {
        campaigns: [],
        categories: [],
      },
    };
  }
}

export default async function AdminBudgetsPage() {
  const { budgets, error, lookups } = await loadAdminBudgetsPageData();

  return (
    <BudgetsAdminClient
      initialBudgets={budgets}
      initialError={error}
      initialLookups={lookups}
    />
  );
}
