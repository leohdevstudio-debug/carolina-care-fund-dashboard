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

/* Violet-to-fuchsia palette for accessible, distinct slice colours */
const COLORS = [
  "#7C3AED", // violet-700
  "#A78BFA", // violet-400
  "#C084FC", // purple-400
  "#E879F9", // fuchsia-400
  "#F0ABFC", // fuchsia-300
  "#C026D3", // fuchsia-600 (contrast break between the lighter shades)
  "#818CF8", // indigo-400
  "#DDD6FE", // violet-200
];

export default function ExpenseCategoryChart({ data }: Props) {
  if (!data.length) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        No expense data available yet.
      </p>
    );
  }

  return (
    /*
     * min-w-0 prevents grid/flex overflow that causes ResponsiveContainer
     * to measure a negative width on first render.
     * width="99%" + explicit height bypasses the Recharts -1 warning.
     */
    <div className="w-full min-w-0">
      <ResponsiveContainer width="99%" height={400}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total_spent_base"
            nameKey="category_name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            /*
             * Disable animation to prevent the double-render artefact
             * that causes labels like "00%" to appear briefly on screen.
             */
            isAnimationActive={false}
            labelLine={{ stroke: "#C4B5FD", strokeWidth: 1 }}
            label={(entry: { percent?: number }) => {
              const percent = entry.percent ?? 0;
              // Skip slices that are invalid, below 5 %, or round to zero
              if (!isFinite(percent) || percent < 0.05) return "";
              const rounded = Math.round(percent * 100);
              return rounded > 0 ? `${rounded}%` : "";
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
            formatter={(value, name) => [
              formatCurrency(Number(value)),
              String(name),
            ]}
            contentStyle={{
              borderRadius: "10px",
              border: "1px solid #E7E0D5",
              boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
              fontSize: "13px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
