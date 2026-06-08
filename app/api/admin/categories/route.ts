import { requireAdminApiSession } from "@/lib/admin/auth";
import { formatAdminRouteError } from "@/lib/admin/adminDataError";
import {
  parseCategoryInput,
  type AdminCategoryInput,
} from "@/lib/admin/categoryValidation";
import {
  createAdminCategory,
  listAdminCategories,
  type AdminCategoryStatus,
} from "@/services/admin/categories";

function errorResponse(error: unknown, fallback: string): Response {
  return Response.json(
    { error: formatAdminRouteError(error, fallback) },
    { status: 400 }
  );
}

function parseStatus(value: string | null): AdminCategoryStatus {
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

    return Response.json(await listAdminCategories({ search, status }));
  } catch (error) {
    return errorResponse(error, "Unable to list categories");
  }
}

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  try {
    const input: AdminCategoryInput = parseCategoryInput(await request.json());
    const category = await createAdminCategory(input);

    return Response.json(category, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to create category");
  }
}
