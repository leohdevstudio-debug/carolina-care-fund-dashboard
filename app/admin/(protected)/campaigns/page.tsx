import CampaignsAdminClient from "@/components/admin/CampaignsAdminClient";
import { formatAdminDataError } from "@/lib/admin/adminDataError";
import { listAdminCampaigns } from "@/services/admin/campaigns";

async function loadAdminCampaignsPageData() {
  try {
    return {
      campaigns: await listAdminCampaigns({ status: "active" }),
      error: "",
    };
  } catch (error) {
    return {
      campaigns: [],
      error: formatAdminDataError(error),
    };
  }
}

export default async function AdminCampaignsPage() {
  const { campaigns, error } = await loadAdminCampaignsPageData();

  return (
    <CampaignsAdminClient
      initialCampaigns={campaigns}
      initialError={error}
    />
  );
}
