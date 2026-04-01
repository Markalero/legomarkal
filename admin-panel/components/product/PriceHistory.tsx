// Gráfico de evolución de precio condition-aware de un producto (fuente BrickLink)
"use client";
import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { ProductPriceHistory, ProductPriceHistoryPoint } from "@/types";
import { ChartRangeSelector } from "@/components/ui/ChartRangeSelector";
import type { RangeKey } from "@/components/ui/ChartRangeSelector";

interface PriceHistoryProps {
  history: ProductPriceHistory;
  soldPrice?: number | null;
  soldDate?: string | null;
}

/** Selecciona el precio correcto según la condición del producto. */
function selectPrice(
  point: ProductPriceHistoryPoint,
  condition: string | null
): number | null {
  if (condition === "SEALED") return point.price_new ?? null;
  return point.price_used ?? null;
}

export function PriceHistory({ history, soldPrice, soldDate }: PriceHistoryProps) {
  const baseData = history.points.map((p) => ({
    dateTs: new Date(p.date).getTime(),
    // null permanece como null — no se convierte a 0 para no distorsionar la escala
    price: selectPrice(p, history.condition),
  }));

  const [range, setRange] = useState<RangeKey>("6m");

  function filterByRange(data: { dateTs: number; price: number | null }[]) {
    if (range === "all") return data;
    const end = data.reduce((m, d) => Math.max(m, d.dateTs), 0) || Date.now();
    const months = range === "1m" ? 1 : range === "3m" ? 3 : 6;
    const start = end - months * 30 * 24 * 60 * 60 * 1000;
    return data.filter((d) => d.dateTs >= start);
  }

  const chartData = filterByRange(baseData);

  // Estado vacío: todos los puntos son nulos
  if (chartData.every((d) => d.price === null)) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-text-muted">
        Sin historial de precios disponible.
      </div>
    );
  }

  // Dominio Y dinámico con +10% de margen visual
  const allValues = chartData
    .map((d) => d.price)
    .filter((v): v is number => v !== null);
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 100;
  const yMax = Math.ceil(maxVal * 1.1);

  const soldDateTs = soldDate ? new Date(soldDate).getTime() : null;

  return (
    <div>
      <div className="mb-2 flex items-start justify-end">
        <ChartRangeSelector value={range} onChange={(v) => setRange(v)} />
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2D" />
        <XAxis
          dataKey="dateTs"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={formatDate}
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
          width={50}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#141416",
            border: "1px solid #2A2A2D",
            borderRadius: 8,
          }}
          labelStyle={{ color: "#A1A1AA", fontSize: 12 }}
          formatter={(value: number) => [formatCurrency(value), "Precio"]}
          labelFormatter={formatDate}
        />
        {/* Marcador vertical de venta real */}
        {soldPrice != null && soldDateTs != null && (
          <ReferenceLine
            x={soldDateTs}
            stroke="#10B981"
            strokeDasharray="4 4"
            label={{
              value: `Venta ${formatCurrency(soldPrice)}`,
              position: "insideTopRight",
              fill: "#10B981",
              fontSize: 11,
            }}
          />
        )}
        {/* Una sola línea ámbar — color BrickLink */}
        <Line
          type="monotone"
          dataKey="price"
          name="Precio"
          stroke="#F59E0B"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls={false}
        />
      </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
