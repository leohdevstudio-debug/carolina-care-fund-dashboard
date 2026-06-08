import ExpensesAdminClient from "@/components/admin/ExpensesAdminClient";
import { formatAdminDataError } from "@/lib/admin/adminDataError";
import { listAdminExpenses } from "@/services/admin/expenses";
import { listAdminExpenseLookups } from "@/services/admin/lookups";

async function loadAdminExpensesPageData() {
  try {
    const [expenses, lookups] = await Promise.all([
      listAdminExpenses({ status: "active" }),
      listAdminExpenseLookups(),
    ]);

    return {
      expenses,
      error: "",
      lookups,
    };
  } catch (error) {
    return {
      expenses: [],
      error: formatAdminDataError(error),
      lookups: {
        campaigns: [],
        categories: [],
      },
    };
  }
}

export default async function AdminExpensesPage() {
  const { error, expenses, lookups } = await loadAdminExpensesPageData();

  return (
    <ExpensesAdminClient
      initialError={error}
      initialExpenses={expenses}
      initialLookups={lookups}
    />
  );
}
