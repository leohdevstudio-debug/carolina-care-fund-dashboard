import DonationsAdminClient from "@/components/admin/DonationsAdminClient";
import { formatAdminDataError } from "@/lib/admin/adminDataError";
import { listAdminDonations } from "@/services/admin/donations";
import { listAdminDonationLookups } from "@/services/admin/lookups";

async function loadAdminDonationsPageData() {
  try {
    const [donations, lookups] = await Promise.all([
      listAdminDonations({ status: "active" }),
      listAdminDonationLookups(),
    ]);

    return {
      donations,
      error: "",
      lookups,
    };
  } catch (error) {
    return {
      donations: [],
      error: formatAdminDataError(error),
      lookups: {
        campaigns: [],
        donors: [],
      },
    };
  }
}

export default async function AdminDonationsPage() {
  const { donations, error, lookups } = await loadAdminDonationsPageData();

  return (
    <DonationsAdminClient
      initialDonations={donations}
      initialError={error}
      initialLookups={lookups}
    />
  );
}
