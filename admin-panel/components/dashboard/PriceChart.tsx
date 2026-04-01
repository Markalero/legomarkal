// Gráfico comparativo inversión vs mercado para el dashboard principal
"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { PriceTrendPoint } from "@/types";

interface PriceChartProps {
  data: PriceTrendPoint[];
}

// Paleta fija para temas — se rota cíclicamente
const COLORS = [
  "#F59E0B", // accent-lego
  "#3B82F6", // accent-info
  "#10B981", // success
  "#F97316", // warning
  "#A855F7", // purple
  "#EC4899", // pink
];

export function PriceChart({ data }: PriceChartProps) {
  const chartData = [...data]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({
      date: item.date,
      invested: item.invested_value,
      market: item.market_value,
    }));

  const maxValue = chartData.reduce((max, point) => {
    const localMax = Math.max(point.invested ?? 0, point.market ?? 0);
    return Math.max(max, localMax);
  }, 0);
  const yMax = maxValue > 0 ? Math.ceil(maxValue * 1.08) : 100;

  if (chartData.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-text-muted">
        Sin datos de tendencia disponibles todavía.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2D" />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => formatDate(v)}
          tick={{ fill: "#71717A", fontSize: 11 }}
          axisLine={{ stroke: "#2A2A2D" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, yMax]}
          tickFormatter={(v) => `${v}€`}
          tick={{ fill: "#71717A", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={55}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#141416",
            border: "1px solid #2A2A2D",
            borderRadius: 8,
          }}
          labelStyle={{ color: "#A1A1AA", fontSize: 12 }}
          formatter={(value: number, name: string) => [formatCurrency(value), name]}
          labelFormatter={(label) => formatDate(label)}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          formatter={(value) => (
            <span style={{ color: "#A1A1AA" }}>{value}</span>
          )}
        />
        <Line
          type="monotone"
          dataKey="invested"
          name="Invertido"
          stroke={COLORS[0]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="market"
          name="Valor de mercado"
          stroke={COLORS[1]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
