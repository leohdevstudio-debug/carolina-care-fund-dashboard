"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type BudgetVsSpentItem = {
  category_name: string;
  total_budget_base: number;
  total_spent_base: number;
};

type BudgetVsSpentChartProps = {
  data: BudgetVsSpentItem[];
  currency: string;
  labels: {
    budget: string;
    spent: string;
  };
};

export default function BudgetVsSpentChart({
  data,
  currency,
  labels,
}: BudgetVsSpentChartProps) {
  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
<BarChart
  data={data}
  margin={{ top: 8, right: 16, left: 24, bottom: 8 }}
>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
  dataKey="category_name"
  angle={-15}
  textAnchor="end"
  height={70}
  interval={0}
/>
          <YAxis
  tickFormatter={(value) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value)
  }
/>
<Tooltip
  content={({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    const budget = payload.find(p => p.dataKey === "total_budget_base")?.value;
    const spent = payload.find(p => p.dataKey === "total_spent_base")?.value;

    const format = (val: unknown) =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(typeof val === "number" ? val : Number(val ?? 0));

    return (
      <div className="rounded-lg border bg-white p-3 shadow-sm">
        <div className="mb-2 text-sm font-medium">{label}</div>
        <div className="text-sm">
          <div>
            {labels.budget}: {format(budget)}
          </div>
          <div>
            {labels.spent}: {format(spent)}
          </div>
        </div>
      </div>
    );
  }}
/>
          <Legend />
<Bar
  dataKey="total_budget_base"
  name={labels.budget}
  fill="#0f172a"
  radius={[6, 6, 0, 0]}
/>
<Bar
  dataKey="total_spent_base"
  name={labels.spent}
  fill="#38bdf8"
  radius={[6, 6, 0, 0]}
/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}