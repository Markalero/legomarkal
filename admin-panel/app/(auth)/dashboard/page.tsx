// Página Dashboard — KPIs, gráfico de tendencias y top 5 por margen
"use client";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { AlertFeed } from "@/components/dashboard/AlertFeed";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RefreshPricesButton } from "@/components/ui/RefreshPricesButton";
import { dashboardApi, alertsApi, productsApi } from "@/lib/api-client";
import { formatCurrency, formatPct } from "@/lib/utils";
import type { DashboardSummary, TopMarginProduct, PriceTrendPoint, PriceAlert, RealProfitSummary } from "@/types";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [topMargin, setTopMargin] = useState<TopMarginProduct[]>([]);
  const [trends, setTrends] = useState<PriceTrendPoint[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [realProfits, setRealProfits] = useState<RealProfitSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [refreshStatus, setRefreshStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, t, tr, al, rp] = await Promise.all([
        dashboardApi.summary(),
        dashboardApi.topMargin(),
        dashboardApi.priceTrends(),
        alertsApi.list(),
        dashboardApi.realProfits(),
      ]);
      setSummary(s);
      setTopMargin(t);
      setTrends(tr);
      setAlerts(al);
      setRealProfits(rp);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startPredictiveProgress(totalModels: number): () => void {
    const ceiling = 82;
    const expectedDurationMs = Math.max(6000, totalModels * 2200);
    const startTs = Date.now();

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startTs;
      const ratio = Math.min(1, elapsed / expectedDurationMs);
      const eased = 1 - Math.pow(1 - ratio, 2);
      const predicted = Math.round(8 + (ceiling - 8) * eased);
      setRefreshProgress((prev) => Math.max(prev, predicted));
    }, 300);

    return () => window.clearInterval(timer);
  }

  async function handleTriggerScraper() {
    setScraping(true);
    setRefreshProgress(8);
    setRefreshStatus("Preparando sincronización");

    let stopPredictor: (() => void) | null = null;
    try {
      const totalModels = (await productsApi.list({ page: 1, size: 1 })).total || 1;
      const estimatedOps = totalModels * 2 + 4;

      setRefreshStatus(`Procesando ~${estimatedOps} operaciones (${totalModels} modelos)`);

      // 1) Refresco rápido de UI con lo ya persistido en BBDD.
      await load();
      setRefreshProgress(18);
      setRefreshStatus("Sincronizando precios de mercado");

      stopPredictor = startPredictiveProgress(totalModels);

      // 2) Refresco completo de precios y verificación de cobertura diaria.
      const execution = await dashboardApi.refreshAllPricesCompat();
      if (execution.mode === "background") {
        // En backend legado, el scraping corre en segundo plano.
        setRefreshProgress(60);
        setRefreshStatus("Esperando finalización del refresco");
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      stopPredictor?.();
      stopPredictor = null;

      setRefreshProgress(88);
      setRefreshStatus("Recalculando cartera diaria completa");
      // 3) Segunda actualización para reflejar datos recién scrapeados.
      await load();
      setRefreshProgress(100);
      setRefreshStatus("Completado");
      await new Promise((resolve) => setTimeout(resolve, 450));
    } finally {
      stopPredictor?.();
      setScraping(false);
      setRefreshProgress(0);
      setRefreshStatus("");
    }
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Dashboard"
        description="Resumen de inventario y mercado"
        actions={
          <RefreshPricesButton
            loading={scraping}
            onClick={handleTriggerScraper}
            progress={refreshProgress}
            statusText={refreshStatus}
          />
        }
      />

      <div className="flex-1 space-y-6 p-6">
        {error && (
          <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
            {error}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Artículos en stock"
            value={loading ? "…" : String(summary?.total_items ?? 0)}
          />
          <KpiCard
            title="Valor de compra"
            value={loading ? "…" : formatCurrency(summary?.total_purchase_value ?? 0)}
          />
          <KpiCard
            title="Valor de mercado"
            value={loading ? "…" : formatCurrency(summary?.total_market_value ?? 0)}
          />
          <KpiCard
            title="Margen potencial"
            value={loading ? "…" : formatCurrency(summary?.potential_margin ?? 0)}
            delta={summary?.avg_margin_pct ?? null}
          />
        </div>

        {/* Beneficios Reales — solo visible si hay ventas registradas */}
        {realProfits && realProfits.total_sold_items > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
              Beneficios reales · {realProfits.total_sold_items} unidad{realProfits.total_sold_items !== 1 ? "es" : ""} vendida{realProfits.total_sold_items !== 1 ? "s" : ""}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard
                title="Ingresos por ventas"
                value={loading ? "…" : formatCurrency(realProfits.total_sold_revenue)}
              />
              <KpiCard
                title="Beneficio neto real"
                value={loading ? "…" : formatCurrency(realProfits.total_real_profit)}
                delta={realProfits.total_real_profit > 0 ? null : null}
              />
              <KpiCard
                title="Beneficio medio / ud."
                value={loading ? "…" : formatCurrency(realProfits.avg_profit_per_item)}
              />
            </div>
          </div>
        )}

        {/* Gráfico + Top margen */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Evolución: dinero invertido vs valor de mercado</CardTitle>
              <Button variant="ghost" size="sm" onClick={load}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>
            <PriceChart data={trends} />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top 5 por margen</CardTitle>
            </CardHeader>
            {topMargin.length === 0 ? (
              <p className="text-sm text-text-muted">Sin datos disponibles.</p>
            ) : (
              <ol className="space-y-3">
                {topMargin.slice(0, 5).map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-text-muted w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm text-text-primary">{p.name}</p>
                      <p className="text-xs text-text-muted">{p.set_number ?? "—"}</p>
                    </div>
                    <span className="text-sm font-semibold text-status-success">
                      {formatPct(p.margin_pct)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        {/* Alertas */}
        <Card>
          <CardHeader>
            <CardTitle>Alertas activas ({alerts.filter(a => a.is_active).length})</CardTitle>
          </CardHeader>
          <AlertFeed alerts={alerts.filter((a) => a.is_active)} />
        </Card>
      </div>
    </div>
  );
}
