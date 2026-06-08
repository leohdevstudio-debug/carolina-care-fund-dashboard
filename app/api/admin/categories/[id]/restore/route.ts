import { requireAdminApiSession } from "@/lib/admin/auth";
import { formatAdminRouteError } from "@/lib/admin/adminDataError";
import { restoreAdminCategory } from "@/services/admin/categories";

function parseCategoryId(id: string): number | null {
  const categoryId = Number(id);

  return Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null;
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
  const categoryId = parseCategoryId(id);

  if (!categoryId) {
    return Response.json({ error: "Invalid category id" }, { status: 400 });
  }

  try {
    return Response.json(await restoreAdminCategory(categoryId));
  } catch (error) {
    return errorResponse(error, "Unable to restore category");
  }
}
