import ExpensesAdminClient from "@/components/admin/ExpensesAdminClient";
import { formatAdminDataError } from "@/lib/admin/adminDataError";
import { listAdminExpenses } from "@/services/admin/expenses";

async function loadAdminExpenses() {
  try {
    const expenses = await listAdminExpenses({ status: "active" });

    return {
      expenses,
      error: "",
    };
  } catch (error) {
    return {
      expenses: [],
      error: formatAdminDataError(error),
    };
  }
}

export default async function AdminExpensesPage() {
  const { error, expenses } = await loadAdminExpenses();

  return <ExpensesAdminClient initialError={error} initialExpenses={expenses} />;
}
