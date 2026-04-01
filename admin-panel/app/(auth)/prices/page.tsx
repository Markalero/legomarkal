// Página de precios — listado de productos con último precio de mercado y botón de scraping puntual
"use client";
import { useEffect, useState, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RefreshPricesButton } from "@/components/ui/RefreshPricesButton";
import { dashboardApi, pricesApi, productsApi } from "@/lib/api-client";
import { conditionLabel, formatCurrency, formatDate } from "@/lib/utils";
import type { Condition, PriceInsightProduct, PriceTrendPoint, ProductPriceHistoryPoint } from "@/types";

export default function PricesPage() {
  const [insights, setInsights] = useState<PriceInsightProduct[]>([]);
  const [globalTrends, setGlobalTrends] = useState<PriceTrendPoint[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedProductName, setSelectedProductName] = useState<string>("");
  const [selectedCondition, setSelectedCondition] = useState<Condition | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<ProductPriceHistoryPoint[]>([]);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingAll, setRefreshingAll] = useState(false);

  const loadFallback = useCallback(async () => {
    const [products, trends] = await Promise.all([
      productsApi.list({ size: 200 }),
      dashboardApi.priceTrends(),
    ]);

    const fallbackInsights: PriceInsightProduct[] = products.items
      .map((product) => {
        const currentPrice =
          product.latest_market_price?.price_new ??
          product.latest_market_price?.price_used ??
          null;
        const purchasePrice = product.purchase_price ?? null;
        const profit =
          currentPrice !== null && purchasePrice !== null
            ? Number((currentPrice - purchasePrice).toFixed(2))
            : null;

        return {
          id: product.id,
          name: product.name,
          set_number: product.set_number,
          condition: product.condition,
          purchase_price: purchasePrice,
          current_market_price: currentPrice,
          min_market_price: null,
          max_market_price: null,
          avg_market_price: currentPrice,
          profit_eur: profit,
        };
      })
      .sort((a, b) => (b.profit_eur ?? -999999) - (a.profit_eur ?? -999999));

    setInsights(fallbackInsights);
    setGlobalTrends(trends);
    setFallbackMode(true);
    setErrorMsg(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextInsights, nextTrends] = await Promise.all([
        dashboardApi.priceInsights(),
        dashboardApi.priceTrends(),
      ]);
      setInsights(nextInsights);
      setGlobalTrends(nextTrends);
      setFallbackMode(false);
      setErrorMsg(null);
    } catch {
      try {
        await loadFallback();
      } catch (fallbackError) {
        const message =
          fallbackError instanceof Error
            ? fallbackError.message
            : "No se pudieron cargar los datos de precios";
        setErrorMsg(message);
        setInsights([]);
        setGlobalTrends([]);
      }
    } finally {
      setLoading(false);
    }
  }, [loadFallback]);

  useEffect(() => { load(); }, [load]);

  async function handleRefreshAllPrices() {
    setRefreshingAll(true);
    try {
      await dashboardApi.triggerScraper();
      await load();
    } finally {
      setRefreshingAll(false);
    }
  }

  async function handleSelectProduct(product: PriceInsightProduct) {
    setSelectedProductId(product.id);
    setSelectedProductName(product.name);
    setSelectedCondition(product.condition);
    try {
      const trend = await pricesApi.trend(product.id, 6, "sold");
      setSelectedHistory(trend.points);
    } catch {
      setSelectedHistory([]);
    }
  }

  const sortedGlobalTrends = [...globalTrends].sort((a, b) => a.date.localeCompare(b.date));
  const sortedSelectedHistory = [...selectedHistory].sort((a, b) => a.date.localeCompare(b.date));
  const highlightNew = selectedCondition === "SEALED";
  const yMaxGlobal = sortedGlobalTrends.reduce((max, point) => {
    const localMax = Math.max(Number(point.invested_value ?? 0), Number(point.market_value ?? 0));
    return Math.max(max, localMax);
  }, 0);
  const yMaxSelected = sortedSelectedHistory.reduce((max, point) => {
    const localMax = Math.max(Number(point.price_new ?? 0), Number(point.price_used ?? 0));
    return Math.max(max, localMax);
  }, 0);
  const currentMax = selectedProductId ? yMaxSelected : yMaxGlobal;
  const yMax = currentMax > 0 ? Math.ceil(currentMax * 1.08) : 100;
  const maxProfit = Math.max(...insights.map(p => Math.abs(p.profit_eur ?? 0)), 1);

  return (
    <div className="flex flex-col">
      <Header
        title="Precios de mercado"
        description="Fuente oficial: BrickLink"
        actions={
          <RefreshPricesButton loading={refreshingAll} onClick={handleRefreshAllPrices} />
        }
      />

      <div className="flex-1 p-6">
        {loading ? (
          <div className="space-y-4 py-2">
            <div className="h-12 animate-pulse rounded-xl border border-border bg-bg-card" />
            <div className="h-72 animate-pulse rounded-xl border border-border bg-bg-card" />
            <div className="h-96 animate-pulse rounded-xl border border-border bg-bg-card" />
            <div className="flex items-center justify-center text-sm text-text-muted">
              Cargando precios de mercado…
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {errorMsg && (
              <Card>
                <p className="text-sm text-status-error">{errorMsg}</p>
              </Card>
            )}

            {fallbackMode && !errorMsg && (
              <Card>
                <p className="text-xs text-text-muted">
                  Mostrando modo compatible: algunas métricas avanzadas dependen de endpoints nuevos del backend.
                </p>
              </Card>
            )}

            <Card>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {selectedProductId
                      ? `Histórico 6 meses · ${selectedProductName}`
                      : "Tendencia global de cartera"}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {selectedProductId
                      ? `Guide type: sold · Línea destacada según estado (${conditionLabel(selectedCondition)})`
                      : "Misma visualización que en dashboard: invertido y valor de mercado"}
                  </p>
                </div>
                {selectedProductId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setSelectedProductId(null);
                      setSelectedProductName("");
                      setSelectedCondition(null);
                      setSelectedHistory([]);
                    }}
                  >
                    Ver gráfica global
                  </Button>
                )}
              </div>

              {!selectedProductId && sortedGlobalTrends.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">Sin datos suficientes para generar la gráfica.</p>
              ) : selectedProductId && sortedSelectedHistory.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">Sin histórico disponible para este producto en los últimos 6 meses.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={selectedProductId ? sortedSelectedHistory : sortedGlobalTrends}
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2D" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => formatDate(v)}
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
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#141416",
                        border: "1px solid #2A2A2D",
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: "#A1A1AA", fontSize: 12 }}
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      labelFormatter={(label) => formatDate(label)}
                    />
                    <Legend />

                    {selectedProductId ? (
                      <>
                        <Line
                          type="monotone"
                          dataKey="price_new"
                          name="Nuevo"
                          stroke="#F59E0B"
                          strokeWidth={highlightNew ? 3 : 1.5}
                          strokeDasharray={highlightNew ? "0" : "4 4"}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="price_used"
                          name="Usado"
                          stroke="#3B82F6"
                          strokeWidth={highlightNew ? 1.5 : 3}
                          strokeDasharray={highlightNew ? "4 4" : "0"}
                          dot={false}
                        />
                      </>
                    ) : (
                      <>
                        <Line type="monotone" dataKey="invested_value" name="Invertido" stroke="#F59E0B" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="market_value" name="Valor de mercado" stroke="#3B82F6" strokeWidth={2} dot={false} />
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card padded={false}>
            <div className="overflow-hidden rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-elevated text-left text-xs text-text-muted uppercase tracking-wider">
                  <th className="px-4 py-3">Set ID</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Compra</th>
                  <th className="px-4 py-3 text-right">Actual</th>
                  <th className="px-4 py-3 text-right text-text-muted/80">Mín.</th>
                  <th className="px-4 py-3 text-right text-text-muted/80">Máx.</th>
                  <th className="px-4 py-3 text-right">Beneficio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {insights.map((p) => (
                  <tr
                    key={p.id}
                    className={`cursor-pointer transition-colors hover:bg-bg-elevated/60 ${
                      selectedProductId === p.id
                        ? "bg-bg-elevated/40 shadow-[inset_3px_0_0_0_rgba(16,185,129,0.45)]"
                        : ""
                    }`}
                    onClick={() => handleSelectProduct(p)}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md border border-border bg-bg-elevated px-2 py-0.5 font-mono text-xs">
                        {p.set_number ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-primary max-w-48 truncate">
                      {p.name}
                    </td>
                    <td className="px-4 py-3">
                      {p.condition ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          p.condition === "SEALED"
                            ? "bg-purple-500/15 text-purple-400"
                            : p.condition === "OPEN_COMPLETE"
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-amber-500/15 text-amber-400"
                        }`}>
                          {conditionLabel(p.condition)}
                        </span>
                      ) : <span className="text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(p.purchase_price)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(p.current_market_price)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-text-muted">
                      {formatCurrency(p.min_market_price)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-text-muted">
                      {formatCurrency(p.max_market_price)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="ml-auto flex h-6 items-center justify-end gap-3">
                        {p.profit_eur !== null && (
                          <div className="w-20 h-1.5 rounded-full overflow-hidden bg-bg-elevated">
                            <div
                              className={`h-full rounded-full ${(p.profit_eur ?? 0) >= 0 ? "bg-status-success" : "bg-status-error"}`}
                              style={{ width: `${Math.min(100, Math.abs((p.profit_eur ?? 0) / (maxProfit || 1)) * 100)}%` }}
                            />
                          </div>
                        )}
                        <span className={`w-20 text-right font-medium tabular-nums leading-none ${(p.profit_eur ?? 0) >= 0 ? "text-status-success" : "text-status-error"}`}>
                          {formatCurrency(p.profit_eur)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {insights.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-text-muted">
                      Sin productos en inventario.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </Card>
          </div>
        )}
      </div>
    </div>
  );
}
