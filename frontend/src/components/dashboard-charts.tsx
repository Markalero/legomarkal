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
  const isProfitable = lastPoint ? lastPoint.value >= (lastPoint.investment || 0) : true
  const valueColor = isProfitable ? '#22c55e' : '#ef4444'

  return (
    <Card className="lg:col-span-4 bg-background/60 backdrop-blur-xl border-white/10 shadow-xl">
      <CardHeader>
        <CardTitle>Evolución del Valor (Histórico)</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 h-[350px] w-full min-h-[350px]">
        <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={100}>
          <LineChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis dataKey="displayDate" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis 
              stroke="#888888" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false} 
              tickFormatter={(value) => `€${value}`}
              domain={['auto', 'auto']}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', color: 'white' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(val: any, name: any) => {
                const num = typeof val === 'number' ? val : Number(val);
                const formatted = `€${isNaN(num) ? '0.00' : num.toFixed(2)}`;
                return [formatted, name === 'value' ? 'Valor de Mercado' : 'Inversión'];
              }}
              labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={valueColor} 
              strokeWidth={3} 
              dot={{ r: 4, fill: valueColor, strokeWidth: 0 }} 
              activeDot={{ r: 6, fill: valueColor, stroke: 'white', strokeWidth: 2 }} 
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
