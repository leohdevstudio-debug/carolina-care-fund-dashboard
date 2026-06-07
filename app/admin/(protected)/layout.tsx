import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPageSession } from "@/lib/admin/auth";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdminPageSession();

  return <AdminShell>{children}</AdminShell>;
}
