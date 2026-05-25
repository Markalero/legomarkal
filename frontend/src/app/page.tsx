export const dynamic = 'force-dynamic';
import { getDashboardMetrics, getSets } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Package, DollarSign, Activity, Target } from "lucide-react";

type LegoSet = {
  id: number;
  product_id: string;
  name: string;
  theme: string;
  buy_price: number;
  current_price: number;
  target_price: number | null;
  status: string;
};

export default async function DashboardPage() {
  let metrics = null;
  let sets = [];
  try {
    metrics = await getDashboardMetrics();
    sets = await getSets();
  } catch (e) {
    console.error("Could not fetch data. Is backend running?", e);
  }

  const m = metrics || {
    total_investment: 0,
    current_value: 0,
    total_roi: 0,
    sets_in_stock: 0,
    sets_sold: 0
  };

  // Find sets that have reached their target price
  const opportunitySets = sets.filter((s: LegoSet) => s.status === "IN_STOCK" && s.target_price && s.current_price && s.current_price >= s.target_price);

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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-background/60 backdrop-blur-xl border-white/10 shadow-xl hover:bg-background/80 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inversión Total</CardTitle>
              <div className="p-2 bg-primary/10 rounded-full">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">€{m.total_investment.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Capital base invertido
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-background/60 backdrop-blur-xl border-white/10 shadow-xl hover:bg-background/80 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Estimado</CardTitle>
              <div className="p-2 bg-success/10 rounded-full">
                <Activity className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">€{m.current_value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Según mercado actual
              </p>
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
              <div className={`text-3xl font-bold ${m.total_roi >= 0 ? "text-success" : "text-destructive"}`}>
                {m.total_roi > 0 ? "+" : ""}{m.total_roi}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Beneficio de ventas cerradas
              </p>
            </CardContent>
          </Card>

          <Card className="bg-background/60 backdrop-blur-xl border-white/10 shadow-xl hover:bg-background/80 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock</CardTitle>
              <div className="p-2 bg-secondary/50 rounded-full">
                <Package className="h-4 w-4 text-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{m.sets_in_stock}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {m.sets_sold} sets vendidos históricamente
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-7">
          <Card className="lg:col-span-4 bg-background/60 backdrop-blur-xl border-white/10 shadow-xl">
            <CardHeader>
              <CardTitle>Evolución del Valor (Histórico)</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center border-t border-white/5 m-6 rounded-md bg-black/5">
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                El gráfico de series temporales de la tabla <code>price_history</code> aparecerá aquí tras recopilar suficientes datos nocturnos.
              </p>
            </CardContent>
          </Card>
          
          <Card className="lg:col-span-3 bg-background/60 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-success/10 rounded-bl-full -z-10" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-success" />
                Oportunidades de Venta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {opportunitySets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="p-3 bg-muted rounded-full mb-3">
                      <Target className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">Ningún set ha alcanzado su precio objetivo todavía.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {opportunitySets.map((s: LegoSet) => (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
                        <div>
                          <p className="font-medium text-sm text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground">#{s.product_id}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-success">€{s.current_price.toFixed(2)}</p>
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-success/70">Target: €{s.target_price!.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
