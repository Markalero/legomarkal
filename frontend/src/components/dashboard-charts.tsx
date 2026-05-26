"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ChartDataPoint = {
  date: string
  value: number
  investment?: number
}

export function PortfolioHistoryChart({ data }: { data: ChartDataPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <Card className="lg:col-span-4 bg-background/60 backdrop-blur-xl border-white/10 shadow-xl">
        <CardHeader>
          <CardTitle>Evolución del Valor (Histórico)</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center border-t border-white/5 m-6 rounded-md bg-black/5">
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Faltan datos históricos. El scraper debe ejecutarse varios días para generar la gráfica.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Format dates for display (e.g., "YYYY-MM-DD" -> "DD MMM")
  const formattedData = data.map(d => {
    const dateObj = new Date(d.date)
    return {
      ...d,
      displayDate: dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    }
  })

  const lastPoint = formattedData[formattedData.length - 1]
  
  // Calculate bounds to properly align the gradient
  const rawMin = Math.min(...formattedData.map(d => Math.min(d.value, d.investment || 0)));
  const rawMax = Math.max(...formattedData.map(d => Math.max(d.value, d.investment || 0)));
  
  const padding = (rawMax - rawMin) * 0.1;
  const yMin = Math.max(0, rawMin - padding);
  const yMax = rawMax + padding;
  
  const threshold = lastPoint?.investment || 0;
  
  // SVG gradients use objectBoundingBox, which means they map 0% to the highest point of the path
  // and 100% to the lowest point of the path.
  // The path's highest and lowest points correspond strictly to the max and min values of the line.
  const lineMax = Math.max(...formattedData.map(d => d.value));
  const lineMin = Math.min(...formattedData.map(d => d.value));
  
  let offset = 0;
  if (lineMax > lineMin) {
    offset = (lineMax - threshold) / (lineMax - lineMin);
    offset = Math.max(0, Math.min(1, offset));
  } else {
    offset = lineMax >= threshold ? 1 : 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderCustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const isProfitable = payload.value >= (payload.investment || 0);
    const color = isProfitable ? '#22c55e' : '#ef4444';
    return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={color} strokeWidth={0} />;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderActiveDot = (props: any) => {
    const { cx, cy, payload } = props;
    const isProfitable = payload.value >= (payload.investment || 0);
    const color = isProfitable ? '#22c55e' : '#ef4444';
    return <circle key={`active-dot-${cx}-${cy}`} cx={cx} cy={cy} r={6} fill={color} stroke="white" strokeWidth={2} />;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      type PayloadItem = { dataKey: string; value: number };
      const val = payload.find((p: PayloadItem) => p.dataKey === 'value')?.value || 0;
      const inv = payload.find((p: PayloadItem) => p.dataKey === 'investment')?.value || 0;
      const isProfitable = val >= inv;
      const valColor = isProfitable ? '#22c55e' : '#ef4444';

      return (
        <div className="bg-black/90 border border-white/10 rounded-lg p-3 text-sm shadow-xl min-w-[200px]">
          <p className="text-[#a1a1aa] mb-3 font-medium">{label}</p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: valColor }}></span>
                <span className="text-white/90">Valor de Mercado</span>
              </span>
              <span style={{ color: valColor }} className="font-bold tracking-tight">€{val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {payload.find((p: { dataKey: string }) => p.dataKey === 'investment') && (
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"></span>
                  <span className="text-white/90">Inversión</span>
                </span>
                <span className="text-[#3b82f6] font-bold tracking-tight">€{inv.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="lg:col-span-4 bg-background/60 backdrop-blur-xl border-white/10 shadow-xl">
      <CardHeader>
        <CardTitle>Evolución del Valor (Histórico)</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 h-[350px] w-full min-h-[350px]">
        <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={100}>
          <LineChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset={offset} stopColor="#22c55e" stopOpacity={1} />
                <stop offset={offset} stopColor="#ef4444" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis dataKey="displayDate" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis 
              stroke="#888888" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false} 
              tickFormatter={(value) => `€${value}`}
              domain={[yMin, yMax]}
              allowDataOverflow={true}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="url(#splitColor)" 
              strokeWidth={3} 
              dot={renderCustomDot} 
              activeDot={renderActiveDot} 
            />
            <Line 
              type="monotone" 
              dataKey="investment" 
              stroke="#3b82f6" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} 
              activeDot={{ r: 6, fill: '#3b82f6', stroke: 'white', strokeWidth: 2 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
