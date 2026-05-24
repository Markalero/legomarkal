import { getDashboardMetrics } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Package, DollarSign, Activity } from "lucide-react";

// In Next.js App Router, page components can be async to fetch data server-side
export default async function DashboardPage() {
  let metrics = null;
  try {
    // Attempt to fetch metrics from the backend
    metrics = await getDashboardMetrics();
  } catch (e) {
    console.error("Could not fetch metrics. Is backend running?", e);
  }

  // Fallback data if backend is unreachable
  const m = metrics || {
    total_investment: 0,
    current_value: 0,
    total_roi: 0,
    sets_in_stock: 0,
    sets_sold: 0
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Resumen</h2>
        <p className="text-muted-foreground mt-1">
          El rendimiento de tu portafolio de LEGO de un vistazo.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inversión Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{m.total_investment.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Capital invertido en stock
            </p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Estimado</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">€{m.current_value.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Basado en precios de mercado rastreados
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ROI Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${m.total_roi >= 0 ? "text-success" : "text-destructive"}`}>
              {m.total_roi > 0 ? "+" : ""}{m.total_roi}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Retorno promedio de sets vendidos
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salud del Inventario</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{m.sets_in_stock} Sets</div>
            <p className="text-xs text-muted-foreground mt-1">
              {m.sets_sold} sets vendidos a la fecha
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for future charts */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-7">
        <Card className="lg:col-span-4 hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Evolución del Valor del Portafolio</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center border-t border-dashed m-6 rounded-md">
            <p className="text-sm text-muted-foreground text-center">
              El gráfico histórico aparecerá aquí una vez que se recopilen suficientes datos de rastreo.
            </p>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-3 hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Ventas Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {m.sets_sold === 0 ? (
                <p className="text-sm text-muted-foreground">No hay ventas recientes.</p>
              ) : (
                <p className="text-sm text-muted-foreground">El registro de ventas se listará aquí.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
