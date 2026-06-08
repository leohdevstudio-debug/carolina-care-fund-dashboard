import DonorsAdminClient from "@/components/admin/DonorsAdminClient";
import { formatAdminDataError } from "@/lib/admin/adminDataError";
import { listAdminDonors } from "@/services/admin/donors";

async function loadAdminDonors() {
  try {
    const donors = await listAdminDonors({ status: "active" });

    return {
      donors,
      error: "",
    };
  } catch (error) {
    return {
      donors: [],
      error: formatAdminDataError(error),
    };
  }
}

export default async function AdminDonorsPage() {
  const { donors, error } = await loadAdminDonors();

  return <DonorsAdminClient initialDonors={donors} initialError={error} />;
}
