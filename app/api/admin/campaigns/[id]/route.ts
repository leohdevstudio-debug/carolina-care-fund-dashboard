import { requireAdminApiSession } from "@/lib/admin/auth";
import { formatAdminRouteError } from "@/lib/admin/adminDataError";
import { parseCampaignInput } from "@/lib/admin/campaignValidation";
import { updateAdminCampaign } from "@/services/admin/campaigns";

function parseCampaignId(id: string): number | null {
  const campaignId = Number(id);

  return Number.isInteger(campaignId) && campaignId > 0 ? campaignId : null;
}

function errorResponse(error: unknown, fallback: string): Response {
  return Response.json(
    { error: formatAdminRouteError(error, fallback) },
    { status: 400 }
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const campaignId = parseCampaignId(id);

  if (!campaignId) {
    return Response.json({ error: "Invalid campaign id" }, { status: 400 });
  }

  try {
    const input = parseCampaignInput(await request.json());

    return Response.json(await updateAdminCampaign(campaignId, input));
  } catch (error) {
    return errorResponse(error, "Unable to update campaign");
  }
}
