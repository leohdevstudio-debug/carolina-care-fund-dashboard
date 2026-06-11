import { requireAdminApiSession } from "@/lib/admin/auth";
import { formatAdminRouteError } from "@/lib/admin/adminDataError";
import { restoreAdminBudget } from "@/services/admin/budgets";

function parseBudgetId(id: string): number | null {
  const budgetId = Number(id);

  return Number.isInteger(budgetId) && budgetId > 0 ? budgetId : null;
}

function errorResponse(error: unknown, fallback: string): Response {
  return Response.json(
    { error: formatAdminRouteError(error, fallback) },
    { status: 400 }
  );
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const budgetId = parseBudgetId(id);

  if (!budgetId) {
    return Response.json({ error: "Invalid budget id" }, { status: 400 });
  }

  try {
    return Response.json(await restoreAdminBudget(budgetId));
  } catch (error) {
    return errorResponse(error, "Unable to restore budget");
  }
}
