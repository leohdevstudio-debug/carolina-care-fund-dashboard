import { requireAdminApiSession } from "@/lib/admin/auth";
import {
  parseExpenseInput,
  type AdminExpenseInput,
} from "@/lib/admin/expenseValidation";
import {
  createAdminExpense,
  listAdminExpenses,
  type AdminExpenseStatus,
} from "@/services/admin/expenses";

function errorResponse(error: unknown, fallback: string): Response {
  return Response.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 400 }
  );
}

function parseStatus(value: string | null): AdminExpenseStatus {
  if (value === "deleted" || value === "all") {
    return value;
  }

  return "active";
}

export async function GET(request: Request): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(request.url);
    const status = parseStatus(url.searchParams.get("status"));
    const search = url.searchParams.get("search") ?? undefined;

    return Response.json(await listAdminExpenses({ search, status }));
  } catch (error) {
    return errorResponse(error, "Unable to list expenses");
  }
}

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  try {
    const input: AdminExpenseInput = parseExpenseInput(await request.json());
    const expense = await createAdminExpense(input);

    return Response.json(expense, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to create expense");
  }
}
