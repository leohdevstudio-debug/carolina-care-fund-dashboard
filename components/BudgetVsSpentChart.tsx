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
  if (!data.length) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        No budget data available yet.
      </p>
    );
  }

  const formatAmount = (val: unknown) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(typeof val === "number" ? val : Number(val ?? 0));

  const formatAxisAmount = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);

  return (
    /*
     * min-w-0 prevents grid/flex children from overflowing their cell,
     * which would otherwise cause ResponsiveContainer to measure a
     * negative or zero width on initial render.
     * width="99%" + explicit height avoids the Recharts -1 warning.
     */
    <div className="w-full min-w-0">
      <ResponsiveContainer width="99%" height={420}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, left: 24, bottom: 16 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E7E0D5" vertical={false} />
          <XAxis
            dataKey="category_name"
            angle={-45}
            textAnchor="end"
            height={90}
            interval={0}
            /* Truncate labels longer than 13 chars so they don't overlap on narrow screens */
            tickFormatter={(value) => {
              const label = String(value);
              return label.length > 13 ? `${label.slice(0, 13)}…` : label;
            }}
            tick={{ fontSize: 10, fill: "#78716C" }}
            axisLine={{ stroke: "#E7E0D5" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatAxisAmount}
            tick={{ fontSize: 11, fill: "#78716C" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;

              const budget = payload.find(
                (p) => p.dataKey === "total_budget_base"
              )?.value;
              const spent = payload.find(
                (p) => p.dataKey === "total_spent_base"
              )?.value;

              return (
                <div
                  style={{
                    borderRadius: "10px",
                    border: "1px solid #E7E0D5",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                    background: "#FFFFFF",
                    padding: "10px 14px",
                    fontSize: "13px",
                  }}
                >
                  <div
                    style={{
                      marginBottom: "8px",
                      fontWeight: 600,
                      color: "#1C1917",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      color: "#78716C",
                    }}
                  >
                    <span>
                      {labels.budget}:{" "}
                      <span style={{ color: "#1C1917", fontWeight: 500 }}>
                        {formatAmount(budget)}
                      </span>
                    </span>
                    <span>
                      {labels.spent}:{" "}
                      <span style={{ color: "#1C1917", fontWeight: 500 }}>
                        {formatAmount(spent)}
                      </span>
                    </span>
                  </div>
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }} />
          <Bar
            dataKey="total_budget_base"
            name={labels.budget}
            fill="#A78BFA"
            radius={[5, 5, 0, 0]}
          />
          <Bar
            dataKey="total_spent_base"
            name={labels.spent}
            fill="#E879F9"
            radius={[5, 5, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
