"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { DailyViewsPoint } from "@/types/card";

interface DailyBarChartProps {
  data: DailyViewsPoint[];
  height?: number;
}

export function DailyBarChart({ data, height = 220 }: DailyBarChartProps) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="views" name="Все просмотры" fill="#1f2937" radius={[4, 4, 0, 0]} />
          <Bar dataKey="uniqueViews" name="Уникальные" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
