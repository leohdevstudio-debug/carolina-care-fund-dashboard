"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/format";

type ExpenseByCategory = {
  expense_category_id: number;
  category_name: string;
  category_group: string;
  total_spent_base: number;
};

type Props = {
  data: ExpenseByCategory[];
};

const COLORS = [
  "#1e293b",
  "#334155",
  "#475569",
  "#64748b",
  "#94a3b8",
  "#3b82f6",
  "#6366f1",
  "#0ea5e9",
];

export default function ExpenseCategoryChart({ data }: Props) {
  if (!data.length) {
    return <p className="text-sm text-slate-500">No expense data available yet.</p>;
  }

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="total_spent_base"
            nameKey="category_name"
            cx="50%"
            cy="50%"
            outerRadius={110}
label={(entry: any) => {
  const percent = entry.percent ?? 0;

  if (percent < 0.05) return ""; // hide very small slices

  return `${(percent * 100).toFixed(0)}%`;
}}
          >
            {data.map((item, index) => (
              <Cell
                key={item.expense_category_id}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
<Tooltip
  formatter={(value: any, name: any) => [
    formatCurrency(Number(value)),
    name,
  ]}
/>
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}