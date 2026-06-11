import { requireAdminApiSession } from "@/lib/admin/auth";
import { formatAdminRouteError } from "@/lib/admin/adminDataError";
import {
  parseCampaignInput,
  type AdminCampaignInput,
} from "@/lib/admin/campaignValidation";
import {
  createAdminCampaign,
  listAdminCampaigns,
  type AdminCampaignStatus,
} from "@/services/admin/campaigns";

function errorResponse(error: unknown, fallback: string): Response {
  return Response.json(
    { error: formatAdminRouteError(error, fallback) },
    { status: 400 }
  );
}

function parseStatus(value: string | null): AdminCampaignStatus {
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

    return Response.json(await listAdminCampaigns({ search, status }));
  } catch (error) {
    return errorResponse(error, "Unable to list campaigns");
  }
}

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  try {
    const input: AdminCampaignInput = parseCampaignInput(await request.json());
    const campaign = await createAdminCampaign(input);

    return Response.json(campaign, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to create campaign");
  }
}
