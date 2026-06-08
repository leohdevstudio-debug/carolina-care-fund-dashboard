import Link from "next/link";

const navItems = [
  { href: "/admin/expenses", label: "Expenses" },
  { href: "/admin/donations", label: "Donations" },
  { href: "/admin/donors", label: "Donors" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/budgets", label: "Budgets" },
  { href: "/admin/exchange-rates", label: "Exchange Rates" },
  { href: "/admin/audit", label: "Audit" },
];

export default function AdminShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-background">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[220px_1fr]">
        <aside className="border-b border-border bg-surface px-4 py-4 lg:border-b-0 lg:border-r lg:py-6">
          <div className="mb-4 lg:mb-8">
            <p className="font-serif text-xl font-semibold text-foreground">
              Care Fund
            </p>
            <p className="text-xs uppercase tracking-wide text-muted">Admin</p>
          </div>

          <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {navItems.map((item) => (
              <Link
                className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent-bg"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 px-4 py-5 sm:px-6 lg:py-6">
          {children}
        </section>
      </div>
    </main>
  );
}
