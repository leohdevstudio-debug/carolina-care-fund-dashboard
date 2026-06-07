import ExpensesAdminClient from "@/components/admin/ExpensesAdminClient";
import { listAdminExpenses } from "@/services/admin/expenses";

export default async function AdminExpensesPage() {
  const expenses = await listAdminExpenses({ status: "active" });

  return <ExpensesAdminClient initialExpenses={expenses} />;
}
