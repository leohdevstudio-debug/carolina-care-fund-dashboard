"use client";

import { useEffect, useState } from "react";
import SummaryCard from "@/components/SummaryCard";
import SectionCard from "@/components/SectionCard";
import {
  formatCurrency,
  formatDate,
  getBarWidth,
  BASE_CURRENCY,
} from "@/lib/format";
import { messages, Locale } from "@/messages";
import ExpenseCategoryChart from "@/components/ExpenseCategoryChart";
import BudgetVsSpentChart from "@/components/BudgetVsSpentChart";

type Props = {
  summary: any;
  expenseByCategory: any[];
  budgetVsSpent: any[];
  donations: any[];
  expenses: any[];
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
  const getProgressColor = (percentage: number) => {
    if (percentage < 40) return "bg-red-500";
    if (percentage < 80) return "bg-yellow-400";
    return "bg-green-500";
  };
  const remainingToTarget = Math.max(targetAmount - totalReceived, 0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progressPercentage);
    }, 150);

    return () => clearTimeout(timer);
  }, [progressPercentage]);

  const t = messages[locale];

  const maxExpenseValue = Math.max(
    ...expenseByCategory.map((item) => item.total_spent_base),
    0
  );

  const maxBudgetChartValue = Math.max(
    ...budgetVsSpent.flatMap((item) => [
      item.total_budget_base,
      item.total_spent_base,
    ]),
    0
  );

  const buttonClass = (lang: Locale) =>
    `px-3 py-1 rounded border ${
      locale === lang
        ? "bg-slate-900 text-white border-slate-900"
        : "bg-white text-slate-700 border-slate-300"
    }`;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        {/* Language selector */}
        <div className="flex justify-end gap-2">
          <button onClick={() => setLocale("en")} className={buttonClass("en")}>
            EN
          </button>
          <button onClick={() => setLocale("es")} className={buttonClass("es")}>
            ES
          </button>
          <button
            onClick={() => setLocale("zh-TW")}
            className={buttonClass("zh-TW")}
          >
            中文
          </button>
        </div>

        {/* Header */}
        <header className="rounded-[2rem] bg-slate-900 px-8 py-10 text-white shadow-sm">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-300">
            {t.header.dashboardTitle}
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            {summary.campaign_name}
          </h1>

          <p className="mt-3 max-w-3xl text-base text-slate-300">
            {t.header.descriptionLine1.replace(
              "{name}",
              summary.beneficiary_name
            )}
          </p>

          <p className="mt-3 max-w-3xl text-base text-slate-300">
            {t.header.descriptionLine2}
          </p>

          <p className="mt-3 max-w-3xl text-base font-medium text-white">
            {t.header.descriptionLine3}
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
            <span className="rounded-full border border-slate-700 px-3 py-1">
              {t.header.beneficiary}: {summary.beneficiary_name}
            </span>
            <span className="rounded-full border border-slate-700 px-3 py-1">
              {t.header.baseCurrency}: {BASE_CURRENCY}
            </span>
            <span className="rounded-full border border-slate-700 px-3 py-1">
              {t.header.targetAmount}:{" "}
              {summary.target_amount
                ? formatCurrency(summary.target_amount)
                : t.header.notSet}
            </span>
          </div>

          <div className="mt-8 space-y-3">
            <p className="text-sm font-medium text-white">{t.progress.title}</p>

            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>{formatCurrency(totalReceived)}</span>
              <span>{formatCurrency(targetAmount)}</span>
            </div>

            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${getProgressColor(
                  animatedProgress
                )}`}
                style={{ width: `${animatedProgress}%` }}
              />
            </div>

            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-white">
                  {progressPercentage.toFixed(0)}%
                </span>
                <span className="text-sm text-slate-300">
                  {t.progress.funded}
                </span>
              </div>

              <div className="text-sm text-slate-300">
                {formatCurrency(remainingToTarget)} {t.progress.remaining}
              </div>
            </div>
          </div>
        </header>

        {/* Summary */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title={t.summary.totalReceived}
            value={formatCurrency(summary.total_received_base)}
            subtitle=""
          />
          <SummaryCard
            title={t.summary.totalSpent}
            value={formatCurrency(summary.total_spent_base)}
            subtitle=""
          />
          <SummaryCard
            title={t.summary.remainingBalance}
            value={formatCurrency(summary.remaining_balance_base)}
            subtitle=""
          />
          <SummaryCard
            title={t.summary.unallocatedBalance}
            value={formatCurrency(summary.unallocated_balance_base)}
            subtitle=""
          />
        </section>

        {/* Sections */}
        <section className="grid gap-6 xl:grid-cols-2">
          <SectionCard title={t.sections.expensesByCategory} description="">
            <ExpenseCategoryChart data={expenseByCategory} />
          </SectionCard>

          <SectionCard title={t.sections.budgetVsSpent} description="">
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

        {/* Tables */}
        <section className="grid gap-6 xl:grid-cols-2">
          <SectionCard title={t.sections.recentDonations}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>{t.table.date}</th>
                  <th>{t.table.donor}</th>
                  <th>{t.table.original}</th>
                  <th>{t.table.base}</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => (
                  <tr key={d.donation_id}>
                    <td>{formatDate(d.received_date)}</td>
                    <td>{d.donor_display_name}</td>
                    <td>
                      {formatCurrency(d.original_amount, d.currency_code)}
                    </td>
                    <td>{formatCurrency(d.base_currency_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>

          <SectionCard title={t.sections.recentExpenses}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>{t.table.date}</th>
                  <th>{t.table.category}</th>
                  <th>{t.table.description}</th>
                  <th>{t.table.base}</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.expense_id}>
                    <td>{formatDate(e.expense_date)}</td>
                    <td>{e.category_name}</td>
                    <td>{e.expense_description}</td>
                    <td>{formatCurrency(e.base_currency_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </section>
      </div>
    </main>
  );
}
