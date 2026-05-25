"use client";

import { useEffect, useState } from "react";
import SummaryCard from "@/components/SummaryCard";
import SectionCard from "@/components/SectionCard";
import { formatCurrency, formatDate, BASE_CURRENCY } from "@/lib/format";
import { messages, Locale } from "@/messages";
import ExpenseCategoryChart from "@/components/ExpenseCategoryChart";
import BudgetVsSpentChart from "@/components/BudgetVsSpentChart";
import type {
  CampaignSummary,
  ExpenseByCategory,
  BudgetVsSpent,
  PublicDonation,
  PublicExpense,
} from "@/services/dashboard";

type Props = {
  summary: CampaignSummary;
  expenseByCategory: ExpenseByCategory[];
  budgetVsSpent: BudgetVsSpent[];
  donations: PublicDonation[];
  expenses: PublicExpense[];
};

export default function DashboardClient({
  summary,
  expenseByCategory,
  budgetVsSpent,
  donations,
  expenses,
}: Props) {
  const [locale, setLocale] = useState<Locale>("en");
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;

    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocale(saved);
      return;
    }

    const browserLang = navigator.language.toLowerCase();

    if (browserLang.startsWith("es")) {
      setLocale("es");
    } else if (browserLang.includes("tw") || browserLang.includes("zh")) {
      setLocale("zh-TW");
    } else {
      setLocale("en");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("locale", locale);
  }, [locale]);

  const targetAmount = Number(summary.target_amount ?? 0);
  const totalReceived = Number(summary.total_received_base ?? 0);

  const progressPercentage =
    targetAmount > 0 ? Math.min((totalReceived / targetAmount) * 100, 100) : 0;

  const remainingToTarget = Math.max(targetAmount - totalReceived, 0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progressPercentage);
    }, 150);

    return () => clearTimeout(timer);
  }, [progressPercentage]);

  const t = messages[locale];

  const buttonClass = (lang: Locale) =>
    `px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1 ${
      locale === lang
        ? "bg-violet-400 text-violet-950 shadow-sm"
        : "text-muted hover:text-foreground"
    }`;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 md:py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">

        {/* Language selector */}
        <div className="flex justify-end">
          <div
            role="group"
            aria-label="Select language"
            className="flex items-center gap-0.5 rounded-full border border-border bg-surface px-1.5 py-1.5 shadow-sm"
          >
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={buttonClass("en")}
              aria-pressed={locale === "en"}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLocale("es")}
              className={buttonClass("es")}
              aria-pressed={locale === "es"}
            >
              ES
            </button>
            <button
              type="button"
              onClick={() => setLocale("zh-TW")}
              className={buttonClass("zh-TW")}
              aria-pressed={locale === "zh-TW"}
            >
              中文
            </button>
          </div>
        </div>

        {/* Hero header */}
        <header className="relative overflow-hidden rounded-3xl bg-violet-400 px-8 py-12 shadow-lg md:px-12 md:py-14">
          {/* Decorative circles */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-80 w-80 -translate-y-1/3 translate-x-1/3 rounded-full bg-white/15"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-1/2 h-56 w-56 translate-y-2/3 rounded-full bg-white/15"
          />

          <div className="relative">
            {/* Category label */}
            <div className="flex items-center gap-2">
              <svg
                aria-hidden
                className="h-3.5 w-3.5 text-violet-800"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
              </svg>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-violet-800">
                {t.header.dashboardTitle}
              </p>
            </div>

            {/* Campaign name — serif display */}
            <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight tracking-tight text-violet-950 md:text-5xl">
              {summary.campaign_name}
            </h1>

            {/* Description */}
            <div className="mt-5 max-w-2xl space-y-2">
              <p className="text-sm leading-relaxed text-violet-900">
                {t.header.descriptionLine1.replace(
                  "{name}",
                  summary.beneficiary_name
                )}
              </p>
              <p className="text-sm leading-relaxed text-violet-900">
                {t.header.descriptionLine2}
              </p>
              <p className="text-sm font-medium text-violet-950">
                {t.header.descriptionLine3}
              </p>
            </div>

            {/* Metadata badges */}
            <div className="mt-7 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-violet-950/15 bg-violet-950/10 px-4 py-1.5 text-xs font-medium text-violet-900 backdrop-blur-sm">
                {t.header.beneficiary}: {summary.beneficiary_name}
              </span>
              <span className="inline-flex items-center rounded-full border border-violet-950/15 bg-violet-950/10 px-4 py-1.5 text-xs font-medium text-violet-900 backdrop-blur-sm">
                {t.header.baseCurrency}: {BASE_CURRENCY}
              </span>
              <span className="inline-flex items-center rounded-full border border-violet-950/15 bg-violet-950/10 px-4 py-1.5 text-xs font-medium text-violet-900 backdrop-blur-sm">
                {t.header.targetAmount}:{" "}
                {summary.target_amount
                  ? formatCurrency(summary.target_amount)
                  : t.header.notSet}
              </span>
            </div>

            {/* Fundraising progress */}
            <div className="mt-10 space-y-3.5">
              <div className="flex items-end justify-between gap-4">
                <p className="text-sm font-medium text-violet-900">
                  {t.progress.title}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-3xl font-bold tabular-nums text-violet-950">
                    {progressPercentage.toFixed(0)}%
                  </span>
                  <span className="text-xs text-violet-800">{t.progress.funded}</span>
                </div>
              </div>

              {/* Progress track */}
              <div
                role="progressbar"
                aria-label={t.progress.title}
                aria-valuenow={Math.round(progressPercentage)}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 w-full overflow-hidden rounded-full bg-violet-950/15"
              >
                <div
                  className="h-full rounded-full bg-white transition-all duration-1000 ease-out"
                  style={{ width: `${animatedProgress}%` }}
                />
              </div>

              {/* Progress footnotes */}
              <div className="flex items-center justify-between gap-4 text-xs text-violet-800">
                <span className="font-mono tabular-nums">
                  {formatCurrency(totalReceived)} {t.progress.funded}
                </span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(remainingToTarget)} {t.progress.remaining}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Summary metric cards */}
        <section
          aria-label="Financial summary"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <SummaryCard
            title={t.summary.totalReceived}
            value={formatCurrency(summary.total_received_base)}
          />
          <SummaryCard
            title={t.summary.totalSpent}
            value={formatCurrency(summary.total_spent_base)}
          />
          <SummaryCard
            title={t.summary.remainingBalance}
            value={formatCurrency(summary.remaining_balance_base)}
          />
          <SummaryCard
            title={t.summary.unallocatedBalance}
            value={formatCurrency(summary.unallocated_balance_base)}
          />
        </section>

        {/* Charts */}
        <section
          aria-label="Expense charts"
          className="grid gap-6 xl:grid-cols-2"
        >
          <SectionCard title={t.sections.expensesByCategory}>
            <ExpenseCategoryChart data={expenseByCategory} />
          </SectionCard>

          <SectionCard title={t.sections.budgetVsSpent}>
            <BudgetVsSpentChart
              data={budgetVsSpent}
              currency={BASE_CURRENCY}
              labels={{
                budget: t.charts.budget,
                spent: t.charts.spent,
              }}
            />
          </SectionCard>
        </section>

        {/* Transaction tables */}
        <section
          aria-label="Recent transactions"
          className="grid gap-6 xl:grid-cols-2"
        >
          {/* Donations table */}
          <SectionCard title={t.sections.recentDonations}>
            {/* Mobile stacked rows */}
            <div className="divide-y divide-border sm:hidden">
              {donations.map((d) => (
                <div key={d.donation_id} className="flex items-center justify-between gap-3 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {d.donor_display_name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDate(d.received_date)}
                      {d.currency_code !== BASE_CURRENCY && (
                        <span className="ml-1.5 font-mono">
                          · {formatCurrency(d.original_amount, d.currency_code)}
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-sm font-medium tabular-nums text-foreground">
                    {formatCurrency(d.base_currency_amount)}
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[440px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="pb-3 pr-5 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                      {t.table.date}
                    </th>
                    <th scope="col" className="pb-3 pr-5 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                      {t.table.donor}
                    </th>
                    <th scope="col" className="pb-3 pr-5 text-right text-xs font-semibold uppercase tracking-wider text-muted">
                      {t.table.original}
                    </th>
                    <th scope="col" className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-muted">
                      {t.table.base}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {donations.map((d) => (
                    <tr key={d.donation_id} className="transition-colors duration-150 hover:bg-background">
                      <td className="py-3.5 pr-5 text-sm text-muted">{formatDate(d.received_date)}</td>
                      <td className="py-3.5 pr-5 text-sm font-medium text-foreground">{d.donor_display_name}</td>
                      <td className="py-3.5 pr-5 text-right font-mono text-sm tabular-nums text-foreground">
                        {formatCurrency(d.original_amount, d.currency_code)}
                      </td>
                      <td className="py-3.5 text-right font-mono text-sm font-medium tabular-nums text-foreground">
                        {formatCurrency(d.base_currency_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Expenses table */}
          <SectionCard title={t.sections.recentExpenses}>
            {/* Mobile stacked rows */}
            <div className="divide-y divide-border sm:hidden">
              {expenses.map((e) => (
                <div key={e.expense_id} className="flex items-center justify-between gap-3 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {e.expense_description || e.category_name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {e.category_name} · {formatDate(e.expense_date)}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-sm font-medium tabular-nums text-foreground">
                    {formatCurrency(e.base_currency_amount)}
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[440px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="pb-3 pr-5 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                      {t.table.date}
                    </th>
                    <th scope="col" className="pb-3 pr-5 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                      {t.table.category}
                    </th>
                    <th scope="col" className="pb-3 pr-5 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                      {t.table.description}
                    </th>
                    <th scope="col" className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-muted">
                      {t.table.base}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {expenses.map((e) => (
                    <tr key={e.expense_id} className="transition-colors duration-150 hover:bg-background">
                      <td className="py-3.5 pr-5 text-sm text-muted">{formatDate(e.expense_date)}</td>
                      <td className="py-3.5 pr-5 text-sm text-foreground">{e.category_name}</td>
                      <td className="py-3.5 pr-5 text-sm text-muted">{e.expense_description}</td>
                      <td className="py-3.5 text-right font-mono text-sm font-medium tabular-nums text-foreground">
                        {formatCurrency(e.base_currency_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </section>

        {/* Footer */}
        <footer className="pb-6 text-center">
          <p className="text-xs text-muted">
            {t.footer.note.replace("{currency}", BASE_CURRENCY)}
          </p>
        </footer>
      </div>
    </main>
  );
}
