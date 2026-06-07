import { requireAdminApiSession } from "@/lib/admin/auth";
import { formatAdminRouteError } from "@/lib/admin/adminDataError";
import { parseSoftDeleteInput } from "@/lib/admin/expenseValidation";
import { softDeleteAdminExpense } from "@/services/admin/expenses";

function parseExpenseId(id: string): number | null {
  const expenseId = Number(id);

  return Number.isInteger(expenseId) && expenseId > 0 ? expenseId : null;
}

function errorResponse(error: unknown, fallback: string): Response {
  return Response.json(
    { error: formatAdminRouteError(error, fallback) },
    { status: 400 }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const expenseId = parseExpenseId(id);

  if (!expenseId) {
    return Response.json({ error: "Invalid expense id" }, { status: 400 });
  }

  try {
    const { reason } = parseSoftDeleteInput(await request.json());

    return Response.json(await softDeleteAdminExpense(expenseId, reason));
  } catch (error) {
    return errorResponse(error, "Unable to delete expense");
  }
}
