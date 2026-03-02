"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { DailyViewsPoint } from "@/types/card";

interface DailyLineChartProps {
  data: DailyViewsPoint[];
  height?: number;
}

export function DailyLineChart({ data, height = 280 }: DailyLineChartProps) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="views" name="Все просмотры" stroke="#111827" strokeWidth={2.5} dot={{ r: 2 }} />
          <Line
            type="monotone"
            dataKey="uniqueViews"
            name="Уникальные"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
