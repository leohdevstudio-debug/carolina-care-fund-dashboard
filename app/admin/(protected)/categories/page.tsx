import CategoriesAdminClient from "@/components/admin/CategoriesAdminClient";
import { formatAdminDataError } from "@/lib/admin/adminDataError";
import { listAdminCategories } from "@/services/admin/categories";

async function loadAdminCategories() {
  try {
    const categories = await listAdminCategories({ status: "active" });

    return {
      categories,
      error: "",
    };
  } catch (error) {
    return {
      categories: [],
      error: formatAdminDataError(error),
    };
  }
}

export default async function AdminCategoriesPage() {
  const { categories, error } = await loadAdminCategories();

  return (
    <CategoriesAdminClient
      initialCategories={categories}
      initialError={error}
    />
  );
}
