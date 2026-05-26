"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function SetHistoryChart({ data }: { data: { recorded_at: string; price: number }[] }) {
  if (!data || data.length < 2) {
    return (
      <div className="h-[250px] flex items-center justify-center border-t border-white/5 m-6 rounded-md bg-black/5">
        <p className="text-sm text-muted-foreground">El gráfico estará disponible una vez haya suficientes datos históricos.</p>
      </div>
    );
  }

  // format data for chart
  const chartData = data.map(d => ({
    date: new Date(d.recorded_at).toLocaleDateString(),
    price: d.price
  }));

  return (
    <div className="h-[250px] w-full p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="rgba(255,255,255,0.5)" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
            padding={{ left: 10, right: 10 }}
          />
          <YAxis 
            domain={['auto', 'auto']}
            stroke="rgba(255,255,255,0.5)" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            tickFormatter={(value) => `€${value}`}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
            formatter={(value) => [`€${Number(value).toFixed(2)}`, 'Valor']}
            labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
          />
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke="#10b981" 
            strokeWidth={3} 
            dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
            activeDot={{ r: 6, fill: '#fff', stroke: '#10b981', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
