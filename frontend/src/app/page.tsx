export const dynamic = 'force-dynamic';
import { getDashboardMetrics, getPortfolioHistory, getTopPerformers } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Package, DollarSign, Activity } from "lucide-react";
import { PortfolioHistoryChart } from "@/components/dashboard-charts";
import { TopPerformersCarousel } from "@/components/top-performers";



export default async function DashboardPage() {
  let metrics = null;
  let historyData = [];
  let topPerformers = [];

  try {
    const [mRes, hRes, tpRes] = await Promise.all([
      getDashboardMetrics(),
      getPortfolioHistory(),
      getTopPerformers()
    ]);
    metrics = mRes;
    historyData = hRes;
    topPerformers = tpRes;
  } catch (e) {
    console.error("Could not fetch dashboard data:", e);
  }

  const m = metrics || {
    total_investment: 0,
    current_value: 0,
    total_roi: 0,
    realized_profit: 0,
    realized_profit_1m: 0,
    realized_profit_6m: 0,
    unrealized_profit: 0,
    potential_roi: 0,
    sets_in_stock: 0,
    sets_sold: 0
  };

  // Sets near or at their target price (only IN_STOCK)
  // const opportunitySets = sets.filter((s: LegoSet) => s.status === "IN_STOCK" && s.target_price && s.current_price && s.current_price >= s.target_price);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] p-4 sm:p-8 -m-8 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Vibrant Background Gradients for Glassmorphism */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-success/20 rounded-full blur-[120px]" />
      </div>

      <div className="space-y-8 relative z-10">
        <div>
          <h2 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            Portfolio
          </h2>
          <p className="text-muted-foreground mt-2 text-lg">
            Rendimiento en tiempo real de tu colección de LEGO.
          </p>
        </div>



        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-background/60 backdrop-blur-xl border-white/10 shadow-xl hover:bg-background/80 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inversión Total</CardTitle>
              <div className="p-2 bg-primary/10 rounded-full">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">€{m.total_investment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Capital base invertido
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-background/60 backdrop-blur-xl border-white/10 shadow-xl hover:bg-background/80 transition-colors flex flex-col justify-between">
            <div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Estimado</CardTitle>
                <div className="p-2 bg-success/10 rounded-full">
                  <Activity className="h-4 w-4 text-success" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold text-success">€{m.current_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <p className={`text-xs mt-1 font-semibold ${m.unrealized_profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {m.unrealized_profit >= 0 ? '+' : ''}€{m.unrealized_profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Stock)
                </p>
              </CardContent>
            </div>
            <CardContent className="pt-0">
              <div className="flex justify-between items-center bg-background/50 border px-3 py-1.5 rounded text-xs mt-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">ROI Potencial (Stock)</span>
                <span className={`font-semibold text-sm ${m.potential_roi >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {m.potential_roi >= 0 ? '+' : ''}{m.potential_roi.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background/60 backdrop-blur-xl border-white/10 shadow-xl hover:bg-background/80 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ROI Consolidado</CardTitle>
              <div className={`p-2 rounded-full ${m.total_roi >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
                <TrendingUp className={`h-4 w-4 ${m.total_roi >= 0 ? "text-success" : "text-destructive"}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className={`text-3xl font-bold ${m.total_roi >= 0 ? "text-success" : "text-destructive"}`}>
                  {m.total_roi > 0 ? "+" : ""}{m.total_roi.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-2 gap-2 w-full">
                <div className="flex flex-col bg-background/50 border px-2 py-1.5 rounded text-xs">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Este mes</span>
                  <span className={`font-semibold ${m.realized_profit_1m >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {m.realized_profit_1m >= 0 ? '+' : ''}€{m.realized_profit_1m.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex flex-col bg-background/50 border px-2 py-1.5 rounded text-xs">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Últ. 6 meses</span>
                  <span className={`font-semibold ${m.realized_profit_6m >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {m.realized_profit_6m >= 0 ? '+' : ''}€{m.realized_profit_6m.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="col-span-2 flex justify-between items-center bg-background/50 border px-3 py-1.5 rounded text-xs mt-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Histórico Total</span>
                  <span className={`font-semibold text-sm ${m.realized_profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {m.realized_profit >= 0 ? '+' : ''}€{m.realized_profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background/60 backdrop-blur-xl border-white/10 shadow-xl hover:bg-background/80 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventario</CardTitle>
              <div className="p-2 bg-secondary/50 rounded-full">
                <Package className="h-4 w-4 text-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{m.sets_in_stock} sets</div>
              <p className="text-xs text-muted-foreground mt-1">
                {m.sets_sold} sets vendidos históricamente
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-7">
          {/* Gráfico Recharts */}
          <PortfolioHistoryChart data={historyData} />
          
          {/* Widget Top Performers */}
          <Card className="lg:col-span-3 bg-background/60 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden relative flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-full -z-10" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 px-4 pb-4">
              <TopPerformersCarousel performers={topPerformers} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
