import { adminFetch } from "@/lib/admin/supabaseAdmin";

export type AdminCampaignOption = {
  campaign_id: number;
  campaign_name: string;
  is_active: boolean;
};

export type AdminExpenseCategoryOption = {
  expense_category_id: number;
  category_name: string;
  category_group: string;
};

export type AdminExpenseLookups = {
  campaigns: AdminCampaignOption[];
  categories: AdminExpenseCategoryOption[];
};

function campaignQuery(): string {
  const query = new URLSearchParams();
  query.set("select", "campaign_id,campaign_name,is_active");
  query.set("order", "campaign_name.asc");

  return query.toString();
}

function categoryQuery(): string {
  const query = new URLSearchParams();
  query.set("select", "expense_category_id,category_name,category_group");
  query.set("order", "category_group.asc,category_name.asc");

  return query.toString();
}

export async function listAdminExpenseLookups(): Promise<AdminExpenseLookups> {
  const [campaigns, categories] = await Promise.all([
    adminFetch<AdminCampaignOption[]>("campaign", campaignQuery()),
    adminFetch<AdminExpenseCategoryOption[]>(
      "expense_category",
      categoryQuery()
    ),
  ]);

  return {
    campaigns,
    categories,
  };
}
