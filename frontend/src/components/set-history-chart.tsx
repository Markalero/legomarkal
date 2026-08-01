"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export function SetHistoryChart({ 
  data, 
  condition 
}: { 
  data: { recorded_at: string; price: number; used_price?: number }[],
  condition?: string
}) {
  const [viewMode, setViewMode] = useState<"new" | "used">(condition && condition !== "MISB" ? "used" : "new");

  if (!data || data.length < 2) {
    return (
      <div className="h-[250px] flex items-center justify-center border-t border-muted m-6 rounded-md bg-muted/50">
        <p className="text-sm text-muted-foreground">El gráfico estará disponible una vez haya suficientes datos históricos.</p>
      </div>
    );
  }

  // format data for chart
  const chartData = data.map(d => ({
    date: new Date(d.recorded_at).toLocaleDateString(),
    price: viewMode === "used" ? (d.used_price || d.price) : d.price
  }));

  return (
    <div className="flex flex-col w-full">
      <div className="px-6 flex justify-end">
        <div className="inline-flex bg-muted p-1 rounded-md">
          <button
            onClick={() => setViewMode("new")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-sm transition-colors",
              viewMode === "new" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Nuevo
          </button>
          <button
            onClick={() => setViewMode("used")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-sm transition-colors",
              viewMode === "used" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Usado/Abierto
          </button>
        </div>
      </div>
      <div className="h-[250px] w-full p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#888888" strokeOpacity={0.2} vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="#888888" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false}
              padding={{ left: 10, right: 10 }}
            />
            <YAxis 
              domain={['auto', 'auto']}
              stroke="#888888" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false} 
              tickFormatter={(value) => `€${value}`}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
              formatter={(value) => [`€${Number(value).toFixed(2)}`, 'Valor']}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="#10b981" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
              activeDot={{ r: 6, fill: 'hsl(var(--background))', stroke: '#10b981', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
