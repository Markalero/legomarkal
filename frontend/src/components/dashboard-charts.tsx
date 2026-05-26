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

  // Calculate bounds for YAxis
  const rawMin = Math.min(...formattedData.map(d => Math.min(d.value, d.investment || 0)));
  const rawMax = Math.max(...formattedData.map(d => Math.max(d.value, d.investment || 0)));
  
  const padding = (rawMax - rawMin) * 0.1;
  const yMin = Math.max(0, rawMin - padding);
  const yMax = rawMax + padding;
  
  // Calculate horizontal gradient stops based on intersections
  const stops: React.ReactNode[] = [];
  
  if (formattedData.length > 1) {
    const n = formattedData.length;
    const isProfitable = (formattedData[0].value - (formattedData[0].investment || 0)) >= 0;
    let currentColor = isProfitable ? '#22c55e' : '#ef4444';
    
    stops.push(<stop key="start" offset="0%" stopColor={currentColor} stopOpacity={1} />);
    
    for (let i = 0; i < n - 1; i++) {
      const v1 = formattedData[i].value;
      const i1 = formattedData[i].investment || 0;
      const v2 = formattedData[i+1].value;
      const i2 = formattedData[i+1].investment || 0;
      
      const diff1 = v1 - i1;
      const diff2 = v2 - i2;
      
      // Check if lines cross
      if ((diff1 > 0 && diff2 < 0) || (diff1 < 0 && diff2 > 0) || (diff1 >= 0 && diff2 < 0) || (diff1 <= 0 && diff2 > 0)) {
        if (diff1 !== 0 || diff2 !== 0) { // Avoid division by zero
          const f = Math.abs(diff1) / (Math.abs(diff1) + Math.abs(diff2));
          const stopOffset = (i + f) / (n - 1);
          const offsetPct = `${(stopOffset * 100).toFixed(2)}%`;
          
          const nextColor = (diff2 >= 0) ? '#22c55e' : '#ef4444';
          
          stops.push(<stop key={`stop-${i}-1`} offset={offsetPct} stopColor={currentColor} stopOpacity={1} />);
          stops.push(<stop key={`stop-${i}-2`} offset={offsetPct} stopColor={nextColor} stopOpacity={1} />);
          
          currentColor = nextColor;
        }
      }
    }
    stops.push(<stop key="end" offset="100%" stopColor={currentColor} stopOpacity={1} />);
  } else if (formattedData.length === 1) {
    const isProfitable = (formattedData[0].value - (formattedData[0].investment || 0)) >= 0;
    const currentColor = isProfitable ? '#22c55e' : '#ef4444';
    stops.push(<stop key="start" offset="0%" stopColor={currentColor} stopOpacity={1} />);
    stops.push(<stop key="end" offset="100%" stopColor={currentColor} stopOpacity={1} />);
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
                <span style={{ color: valColor }} className="font-medium">Valor de Mercado</span>
              </span>
              <span style={{ color: valColor }} className="font-bold tracking-tight">€{val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {payload.find((p: { dataKey: string }) => p.dataKey === 'investment') && (
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"></span>
                  <span className="text-[#3b82f6] font-medium">Inversión</span>
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
              <linearGradient id="splitColor" x1="0" y1="0" x2="1" y2="0">
                {stops}
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
              type="linear" 
              dataKey="value" 
              stroke="url(#splitColor)" 
              strokeWidth={3} 
              dot={renderCustomDot} 
              activeDot={renderActiveDot} 
            />
            <Line 
              type="linear" 
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
