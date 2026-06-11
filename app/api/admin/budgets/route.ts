import { requireAdminApiSession } from "@/lib/admin/auth";
import { formatAdminRouteError } from "@/lib/admin/adminDataError";
import {
  parseBudgetInput,
  type AdminBudgetInput,
} from "@/lib/admin/budgetValidation";
import {
  createAdminBudget,
  listAdminBudgets,
  type AdminBudgetStatus,
} from "@/services/admin/budgets";

function errorResponse(error: unknown, fallback: string): Response {
  return Response.json(
    { error: formatAdminRouteError(error, fallback) },
    { status: 400 }
  );
}

function parseStatus(value: string | null): AdminBudgetStatus {
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

    return Response.json(await listAdminBudgets({ search, status }));
  } catch (error) {
    return errorResponse(error, "Unable to list budgets");
  }
}

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  try {
    const input: AdminBudgetInput = parseBudgetInput(await request.json());
    const budget = await createAdminBudget(input);

    return Response.json(budget, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to create budget");
  }
}
